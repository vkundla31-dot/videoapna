require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const session = require("express-session");
const bcrypt = require("bcryptjs");


// ============================================================
// VCDN VIDEO UPLOAD HELPER
// ============================================================

async function uploadVideoToVcdn(filePath, title = "VideoApna Video") {
  const apiKey = String(process.env.VCDN_API_KEY || "").trim();

  if (!apiKey) {
    throw new Error("VCDN_API_KEY is not configured");
  }

  const stat = await fs.promises.stat(filePath);
  const fileSize = stat.size;

  if (!fileSize || fileSize <= 0) {
    throw new Error("VCDN upload file is empty");
  }

  const fileName = path.basename(filePath);

  // 1. Initialize chunked upload
  const initResponse = await fetch(
    "https://cdn.vcdn.me/api/v1/upload/init",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        filename: fileName,
        size: fileSize,
        title: String(title || "VideoApna Video")
      })
    }
  );

  const initText = await initResponse.text();

  if (!initResponse.ok) {
    throw new Error(
      `VCDN init failed (${initResponse.status}): ${initText}`
    );
  }

  let initData;

  try {
    initData = JSON.parse(initText);
  } catch {
    throw new Error("VCDN init returned invalid JSON");
  }

  const uploadId = initData.uploadId || initData.videoId;

  if (!uploadId) {
    throw new Error("VCDN init did not return uploadId");
  }

  // 2. Upload file in 5 MiB chunks
  const CHUNK_SIZE = 5 * 1024 * 1024;
  let offset = 0;
  let chunkIndex = 0;

  const fileHandle = await fs.promises.open(filePath, "r");

  try {
    while (offset < fileSize) {
      const remaining = fileSize - offset;
      const currentSize = Math.min(CHUNK_SIZE, remaining);
      const buffer = Buffer.allocUnsafe(currentSize);

      let totalRead = 0;

      while (totalRead < currentSize) {
        const result = await fileHandle.read(
          buffer,
          totalRead,
          currentSize - totalRead,
          offset + totalRead
        );

        if (!result.bytesRead) {
          throw new Error("Unexpected end of file during VCDN upload");
        }

        totalRead += result.bytesRead;
      }

      const chunkResponse = await fetch(
        `https://cdn.vcdn.me/api/v1/upload/${uploadId}/chunk`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/octet-stream",
            "X-Chunk-Index": String(chunkIndex)
          },
          body: buffer
        }
      );

      const chunkText = await chunkResponse.text();

      if (!chunkResponse.ok) {
        throw new Error(
          `VCDN chunk ${chunkIndex} failed (${chunkResponse.status}): ${chunkText}`
        );
      }

      offset += currentSize;
      chunkIndex += 1;
    }
  } finally {
    await fileHandle.close();
  }

  // 3. Complete upload
  const completeResponse = await fetch(
    "https://cdn.vcdn.me/api/v1/upload/complete",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        uploadId
      })
    }
  );

  const completeText = await completeResponse.text();

  if (!completeResponse.ok) {
    throw new Error(
      `VCDN complete failed (${completeResponse.status}): ${completeText}`
    );
  }

  let completeData;

  try {
    completeData = JSON.parse(completeText);
  } catch {
    throw new Error("VCDN complete returned invalid JSON");
  }

  // 4. Wait for VCDN transcoding/playback to become ready.
  const vcdnVideoId = completeData.videoId || uploadId;

  let videoData = null;

  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 2000));

    const statusResponse = await fetch(
      `https://cdn.vcdn.me/api/v1/videos/${vcdnVideoId}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`
        }
      }
    );

    const statusText = await statusResponse.text();

    if (!statusResponse.ok) {
      throw new Error(
        `VCDN status failed (${statusResponse.status}): ${statusText}`
      );
    }

    try {
      videoData = JSON.parse(statusText);
    } catch {
      throw new Error("VCDN status returned invalid JSON");
    }

    console.log(
      "VCDN VIDEO STATUS:",
      videoData.status || "unknown",
      videoData.transcode_progress ?? videoData.progress ?? ""
    );

    if (
      videoData.playback_ready === true ||
      videoData.status === "ready"
    ) {
      break;
    }

    if (
      videoData.status === "failed" ||
      videoData.status === "error"
    ) {
      throw new Error(
        `VCDN video processing failed: ${statusText}`
      );
    }
  }

  if (!videoData) {
    throw new Error("VCDN status response was empty");
  }

  const playbackSource =
    Array.isArray(videoData.playback_sources) &&
    videoData.playback_sources.length > 0
      ? videoData.playback_sources[0]
      : null;

  const masterUrl =
    (playbackSource && playbackSource.masterUrl) ||
    videoData.legacy_playback_url ||
    "";

  const embedUrl =
    videoData.embed_url || "";

  if (!masterUrl && !embedUrl) {
    throw new Error(
      "VCDN processing completed but no playback URL was returned"
    );
  }

  return {
    vcdnVideoId,
    vcdnUploadId: completeData.uploadId || uploadId,
    vcdnStatus: videoData.status || completeData.status || "ready",
    vcdnPlaybackUrl: masterUrl,
    vcdnEmbedUrl: embedUrl,
    vcdnPosterUrl:
      videoData.poster_url ||
      (playbackSource && playbackSource.posterUrl) ||
      ""
  };
}

const app = express();
const PORT = process.env.PORT || 8080;

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const UPLOADS = path.join(ROOT, "uploads");
const DATA = path.join(ROOT, "data");
const DB = path.join(DATA, "videos.json");
const SOUNDS_DB = path.join(DATA, "sounds.json");

fs.mkdirSync(UPLOADS, { recursive: true });
fs.mkdirSync(DATA, { recursive: true });

if (!fs.existsSync(DB)) {
  fs.writeFileSync(DB, "[]");
}

if (!fs.existsSync(SOUNDS_DB)) {
  fs.writeFileSync(SOUNDS_DB, "[]");
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".mp4";
    const name = Date.now() + "-" +
      Math.random().toString(36).slice(2, 8) + ext;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("केवल वीडियो फ़ाइल upload करें।"));
    }
  }
});

const photoUpload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("केवल फोटो फ़ाइल upload करें।"));
    }
  }
});

const audioUpload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("केवल audio फ़ाइल upload करें।"));
    }
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================================
   VIDEOAPNA OWNER SESSION
========================================= */

const OWNER_EMAIL =
  String(process.env.VIDEOAPNA_OWNER_EMAIL || "").trim();

const OWNER_PASSWORD =
  String(process.env.VIDEOAPNA_OWNER_PASSWORD || "");

const SESSION_SECRET =
  String(process.env.VIDEOAPNA_SESSION_SECRET || "").trim();

if (!OWNER_EMAIL || !OWNER_PASSWORD || !SESSION_SECRET) {
  console.warn(
    "⚠️ Owner login environment variables पूरी तरह configured नहीं हैं।"
  );
}

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 1000 * 60 * 60 * 12
    }
  })
);

/* =========================================
   VIDEOAPNA PUBLIC USER ACCOUNT SYSTEM
========================================= */

const USERS_DB = path.join(DATA, "users.json");

if (!fs.existsSync(USERS_DB)) {
  fs.writeFileSync(USERS_DB, "[]", "utf8");
}

function readUsers() {
  try {
    const data = JSON.parse(
      fs.readFileSync(USERS_DB, "utf8")
    );
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("USERS DB READ ERROR:", error);
    return [];
  }
}

function saveUsers(users) {
  try {
    fs.writeFileSync(
      USERS_DB,
      JSON.stringify(users, null, 2),
      "utf8"
    );
    return true;
  } catch (error) {
    console.error("USERS DB SAVE ERROR:", error);
    return false;
  }
}

/* Public user registration */
app.post("/api/auth/register", async (req, res) => {
  try {
    const email =
      String(req.body?.email || "").trim().toLowerCase();

    const password =
      String(req.body?.password || "");

    const displayName =
      String(req.body?.displayName || "").trim().slice(0, 100);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email और Password जरूरी हैं।"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password कम से कम 8 characters का होना चाहिए।"
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "सही Email address डालें।"
      });
    }

    if (email === OWNER_EMAIL.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: "यह Email Owner account के लिए reserved है।"
      });
    }

    const users = readUsers();

    const existing = users.find(
      user => String(user.email || "").toLowerCase() === email
    );

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "इस Email से account पहले से बना हुआ है।"
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = {
      id:
        "user-" +
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2, 10),
      email,
      passwordHash,
      displayName: displayName || "VideoApna User",
      provider: "password",
      createdAt: new Date().toISOString()
    };

    users.push(user);

    if (!saveUsers(users)) {
      return res.status(500).json({
        success: false,
        message: "Account save नहीं हो पाया।"
      });
    }

    req.session.userAuthenticated = true;
    req.session.userId = user.id;
    req.session.userEmail = user.email;

    req.session.save(error => {
      if (error) {
        console.error("PUBLIC USER SESSION SAVE ERROR:", error);
        return res.status(500).json({
          success: false,
          message: "Account बना है लेकिन session शुरू नहीं हो पाया।"
        });
      }

      res.json({
        success: true,
        message: "Account सफलतापूर्वक बन गया।",
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName
        }
      });
    });

  } catch (error) {
    console.error("PUBLIC REGISTER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Account बनाने में समस्या हुई।"
    });
  }
});

/* Public user login */
app.post("/api/auth/login", async (req, res) => {
  try {
    const email =
      String(req.body?.email || "").trim().toLowerCase();

    const password =
      String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email और Password जरूरी हैं।"
      });
    }

    const users = readUsers();

    const user = users.find(
      item => String(item.email || "").toLowerCase() === email
    );

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        success: false,
        message: "Email या Password गलत है।"
      });
    }

    const passwordOk = await bcrypt.compare(
      password,
      String(user.passwordHash)
    );

    if (!passwordOk) {
      return res.status(401).json({
        success: false,
        message: "Email या Password गलत है।"
      });
    }

    req.session.userAuthenticated = true;
    req.session.userId = user.id;
    req.session.userEmail = user.email;

    req.session.save(error => {
      if (error) {
        console.error("PUBLIC LOGIN SESSION SAVE ERROR:", error);
        return res.status(500).json({
          success: false,
          message: "Login session save नहीं हो पाया।"
        });
      }

      res.json({
        success: true,
        message: "Login सफल है।",
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName || "VideoApna User"
        }
      });
    });

  } catch (error) {
    console.error("PUBLIC LOGIN ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Login में समस्या हुई।"
    });
  }
});

/* Public user current session */
app.get("/api/auth/me", (req, res) => {
  try {
    if (
      !req.session ||
      req.session.userAuthenticated !== true ||
      !req.session.userId
    ) {
      return res.json({
        success: true,
        authenticated: false,
        user: null
      });
    }

    const users = readUsers();

    const user = users.find(
      item => String(item.id) === String(req.session.userId)
    );

    if (!user) {
      req.session.userAuthenticated = false;
      req.session.userId = null;
      req.session.userEmail = null;

      return res.json({
        success: true,
        authenticated: false,
        user: null
      });
    }

    res.json({
      success: true,
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName || "VideoApna User"
      }
    });

  } catch (error) {
    console.error("PUBLIC SESSION CHECK ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Session check में समस्या हुई।"
    });
  }
});

/* Public user logout */
app.post("/api/auth/logout", (req, res) => {
  if (!req.session) {
    return res.json({
      success: true,
      message: "Logout हो गया।"
    });
  }

  req.session.userAuthenticated = false;
  req.session.userId = null;
  req.session.userEmail = null;

  req.session.save(error => {
    if (error) {
      console.error("PUBLIC LOGOUT ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Logout नहीं हो पाया।"
      });
    }

    res.json({
      success: true,
      message: "Logout हो गया।"
    });
  });
});




/* Owner login */
app.post("/api/owner/login", (req, res) => {
  try {
    const email =
      String(req.body?.email || "").trim();

    const password =
      String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email और Password जरूरी हैं।"
      });
    }

    if (
      email !== OWNER_EMAIL ||
      password !== OWNER_PASSWORD
    ) {
      return res.status(401).json({
        success: false,
        message: "Owner Email या Password गलत है।"
      });
    }

    req.session.ownerAuthenticated = true;
    req.session.ownerEmail = OWNER_EMAIL;

    req.session.save((error) => {
      if (error) {
        console.error(
          "OWNER SESSION SAVE ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message: "Owner session save नहीं हो पाया।"
        });
      }

      res.json({
        success: true,
        message: "Owner Login सफल है।",
        owner: {
          email: OWNER_EMAIL
        }
      });
    });

  } catch (error) {
    console.error(
      "OWNER LOGIN ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Owner Login में समस्या हुई।"
    });
  }
});

/* Owner session check */
app.get("/api/owner/me", (req, res) => {
  const authenticated =
    req.session &&
    req.session.ownerAuthenticated === true &&
    req.session.ownerEmail === OWNER_EMAIL;

  res.json({
    success: true,
    authenticated,
    owner: authenticated
      ? {
          email: OWNER_EMAIL
        }
      : null
  });
});

/* Owner logout */
app.post("/api/owner/logout", (req, res) => {
  if (!req.session) {
    return res.json({
      success: true,
      message: "Owner Logout हो गया।"
    });
  }

  req.session.destroy((error) => {
    if (error) {
      console.error(
        "OWNER LOGOUT ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Logout नहीं हो पाया।"
      });
    }

    res.clearCookie("connect.sid");

    res.json({
      success: true,
      message: "Owner Logout हो गया।"
    });
  });
});

/* Protected Owner API के लिए */
function requireOwner(req, res, next) {
  const authenticated =
    req.session &&
    req.session.ownerAuthenticated === true &&
    req.session.ownerEmail === OWNER_EMAIL;

  if (!authenticated) {
    return res.status(401).json({
      success: false,
      message: "Owner Login जरूरी है।"
    });
  }

  next();
}

/* =========================================
   VIDEOAPNA OWNER REPORT PANEL API
========================================= */

/* सभी reports केवल Owner देख सकता है */
app.get("/api/owner/reports", requireOwner, (req, res) => {
  try {
    const reports = readVideoReports();

    const sortedReports = [...reports].sort((a, b) => {
      return (
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
      );
    });

    res.json({
      success: true,
      reports: sortedReports
    });
  } catch (error) {
    console.error("OWNER REPORT LIST ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Reports लोड नहीं हो पाईं।"
    });
  }
});


/* Owner report पर Action */
app.post("/api/owner/reports/:id/action", requireOwner, (req, res) => {
  try {
    const reportId = String(req.params.id || "").trim();
    const action = String(req.body?.action || "").trim().toLowerCase();
    const moderatorNote = String(
      req.body?.moderatorNote || ""
    ).trim();

    if (!reportId) {
      return res.status(400).json({
        success: false,
        message: "Report ID जरूरी है।"
      });
    }

    const allowedActions = [
      "private",
      "delete",
      "resolve",
      "reject",
      "restore"
    ];

    if (!allowedActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid moderation action।"
      });
    }

    const reports = readVideoReports();

    const reportIndex = reports.findIndex(
      report => String(report.id) === reportId
    );

    if (reportIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Report नहीं मिली।"
      });
    }

    const report = reports[reportIndex];

    const videoId = String(report.videoId || "").trim();

    /*
      PeerTube source को VideoApna से delete नहीं करेंगे।
      Owner केवल report को moderation status दे सकता है।
    */
    const isPeerTube =
      String(report.source || "").toLowerCase() === "peertube" ||
      videoId.startsWith("pt-");

    if (isPeerTube && (action === "delete" || action === "private")) {
      report.status = "resolved";
      report.action =
        action === "delete"
          ? "hide_from_videoapna"
          : "private_on_videoapna";

      report.moderatorNote = moderatorNote;
      report.reviewedBy = OWNER_EMAIL;
      report.reviewedAt = new Date().toISOString();

      if (!saveVideoReports(reports)) {
        return res.status(500).json({
          success: false,
          message: "Report action save नहीं हो पाया।"
        });
      }

      return res.json({
        success: true,
        message:
          action === "delete"
            ? "PeerTube वीडियो को VideoApna moderation में हटाने के लिए mark कर दिया गया।"
            : "PeerTube वीडियो को VideoApna moderation में Private mark कर दिया गया।",
        report
      });
    }

    // =========================================
    // VIDEOAPNA PEERTUBE RESTORE
    // PeerTube video videos.json में नहीं होता,
    // इसलिए Restore को सीधे report moderation में handle करें।
    // =========================================
    if (action === "restore" && String(report.source || "").toLowerCase() === "peertube") {
      report.status = "resolved";
      report.action = "restore";
      report.moderatorNote = moderatorNote;
      report.reviewedBy = OWNER_EMAIL;
      report.reviewedAt = new Date().toISOString();

      if (!saveVideoReports(reports)) {
        return res.status(500).json({
          success: false,
          message: "PeerTube Restore save नहीं हो पाया।"
        });
      }

      return res.json({
        success: true,
        message: "PeerTube वीडियो को VideoApna में Restore कर दिया गया।",
        report
      });
    }

    const videos = readVideos();

    const videoIndex = videos.findIndex(
      video => String(video.id) === videoId
    );

    if (action === "delete") {
      if (videoIndex === -1) {
        report.status = "resolved";
        report.action = "delete";
        report.moderatorNote =
          moderatorNote || "Video पहले से मौजूद नहीं है।";
        report.reviewedBy = OWNER_EMAIL;
        report.reviewedAt = new Date().toISOString();

        saveVideoReports(reports);

        return res.json({
          success: true,
          message: "Video पहले से मौजूद नहीं है। Report resolve कर दी गई।",
          report
        });
      }

      const video = videos[videoIndex];

      if (video.url && video.url.startsWith("/uploads/")) {
        const filePath = path.join(
          UPLOADS,
          path.basename(video.url)
        );

        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (fileError) {
          console.error(
            "OWNER MODERATION FILE DELETE ERROR:",
            fileError
          );
        }
      }

      videos.splice(videoIndex, 1);
      saveVideos(videos);

      report.status = "resolved";
      report.action = "delete";
      report.moderatorNote = moderatorNote;
      report.reviewedBy = OWNER_EMAIL;
      report.reviewedAt = new Date().toISOString();

      saveVideoReports(reports);

      return res.json({
        success: true,
        message: "Video Delete कर दिया गया।",
        report
      });
    }

    if (videoIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Video नहीं मिला।"
      });
    }

    const video = videos[videoIndex];

    if (action === "private") {
      video.visibility = "private";
      video.moderationStatus = "private";
      video.moderationReason =
        moderatorNote || "Owner moderation";
      
      saveVideos(videos);

      report.status = "resolved";
      report.action = "private";
      report.moderatorNote = moderatorNote;
      report.reviewedBy = OWNER_EMAIL;
      report.reviewedAt = new Date().toISOString();

      saveVideoReports(reports);

      return res.json({
        success: true,
        message: "Video Private कर दिया गया।",
        report
      });
    }

    if (action === "restore") {
      video.visibility = "public";
      video.moderationStatus = "restored";
      video.moderationReason = "";

      saveVideos(videos);

      report.status = "resolved";
      report.action = "restore";
      report.moderatorNote = moderatorNote;
      report.reviewedBy = OWNER_EMAIL;
      report.reviewedAt = new Date().toISOString();

      saveVideoReports(reports);

      return res.json({
        success: true,
        message: "Video Public/Restore कर दिया गया।",
        report
      });
    }

    if (action === "reject") {
      report.status = "rejected";
      report.action = "reject";
      report.moderatorNote = moderatorNote;
      report.reviewedBy = OWNER_EMAIL;
      report.reviewedAt = new Date().toISOString();

      saveVideoReports(reports);

      return res.json({
        success: true,
        message: "Report Reject कर दी गई।",
        report
      });
    }

    if (action === "resolve") {
      report.status = "resolved";
      report.action = "resolve";
      report.moderatorNote = moderatorNote;
      report.reviewedBy = OWNER_EMAIL;
      report.reviewedAt = new Date().toISOString();

      saveVideoReports(reports);

      return res.json({
        success: true,
        message: "Report Resolve कर दी गई।",
        report
      });
    }

  } catch (error) {
    console.error("OWNER REPORT ACTION ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Moderation action में समस्या हुई।"
    });
  }
});


app.use("/uploads", express.static(UPLOADS));
app.use(express.static(PUBLIC));

function readVideos() {
  try {
    return JSON.parse(fs.readFileSync(DB, "utf8"));
  } catch {
    return [];
  }
}

function saveVideos(videos) {
  fs.writeFileSync(DB, JSON.stringify(videos, null, 2));
}


/* ==========================================
   VIDEOAPNA CURATED MUSIC LIBRARY
   CC0 music bundled with VideoApna
========================================== */

const CURATED_MUSIC_LIBRARY = [
  {
    id: "cc0-dream-ambience",
    title: "Dream Ambience",
    channel: "VideoApna • CC0 Music",
    url: "/music/Dream-Ambience.mp3",
    license: "CC0",
    source: "OpenGameArt"
  },
  {
    id: "cc0-chase",
    title: "Chase",
    channel: "VideoApna • CC0 Music",
    url: "/music/Chase.mp3",
    license: "CC0",
    source: "OpenGameArt"
  },
  {
    id: "cc0-perces",
    title: "Perces",
    channel: "VideoApna • CC0 Music",
    url: "/music/Perces.mp3",
    license: "CC0",
    source: "OpenGameArt"
  },
  {
    id: "cc0-joining-forces",
    title: "Joining Forces",
    channel: "VideoApna • CC0 Music",
    url: "/music/Joining-Forces.mp3",
    license: "CC0",
    source: "OpenGameArt"
  },
  {
    id: "cc0-our-expanse",
    title: "Our Expanse",
    channel: "VideoApna • CC0 Music",
    url: "/music/Our-Expanse.mp3",
    license: "CC0",
    source: "OpenGameArt"
  }
];

function getAllSounds() {
  const userSounds = readSounds().filter(
    sound => sound.visibility !== "private"
  );

  return [
    ...CURATED_MUSIC_LIBRARY,
    ...userSounds
  ];
}


function resolveSoundFile(sound) {
  if (!sound || !sound.url) {
    return null;
  }

  const url = String(sound.url);

  let baseDir = null;
  let relativePath = null;

  if (url.startsWith("/music/")) {
    baseDir = PUBLIC;
    relativePath = url.slice("/music/".length);
  } else if (url.startsWith("/uploads/")) {
    baseDir = UPLOADS;
    relativePath = url.slice("/uploads/".length);
  } else {
    return null;
  }

  const fullPath = path.resolve(
    baseDir,
    relativePath
  );

  const rootPath =
    path.resolve(baseDir) + path.sep;

  if (!fullPath.startsWith(rootPath)) {
    return null;
  }

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  return fullPath;
}

async function mergeAudioIntoVideo(
  videoPath,
  soundPath,
  outputPath,
  durationSeconds = null
) {
  return new Promise((resolve, reject) => {

    const args = [
      "-y",

      "-i",
      videoPath,

      "-stream_loop",
      "-1",

      "-i",
      soundPath,

      "-map",
      "0:v:0",

      "-map",
      "1:a:0",

      "-c:v",
      "copy",

      "-c:a",
      "aac",

      "-b:a",
      "128k"
    ];

    if (durationSeconds) {
      args.push(
        "-t",
        String(durationSeconds)
      );
    } else {
      args.push("-shortest");
    }

    args.push(
      "-movflags",
      "+faststart",
      outputPath
    );

    execFile(
      "ffmpeg",
      args,
      {
        maxBuffer: 20 * 1024 * 1024
      },
      (error, stdout, stderr) => {

        if (error) {
          console.error(
            "AUDIO MERGE ERROR:",
            stderr || error.message
          );

          reject(
            new Error(
              "Video में Music जोड़ना असफल हुआ।"
            )
          );

          return;
        }

        console.log(
          "AUDIO MERGED INTO VIDEO:",
          outputPath
        );

        resolve();
      }
    );
  });
}

function findAllowedSound(soundId) {
  const id = String(soundId || "").trim();

  if (!id) return null;

  const curated = CURATED_MUSIC_LIBRARY.find(
    sound => String(sound.id) === id
  );

  if (curated) return curated;

  const userSounds = readSounds();

  return userSounds.find(
    sound => String(sound.id) === id
  ) || null;
}

function readSounds() {
  try {
    return JSON.parse(fs.readFileSync(SOUNDS_DB, "utf8"));
  } catch {
    return [];
  }
}

function saveSounds(sounds) {
  fs.writeFileSync(SOUNDS_DB, JSON.stringify(sounds, null, 2));
}

app.get("/api/videos", (req, res) => {
  const videos = readVideos();

  // My Videos/Profile के लिए केवल logged-in session userId इस्तेमाल करें।
  const requestedUserId =
    String(req.query.userId || "").trim();

  if (requestedUserId) {
    const authenticated =
      req.session &&
      req.session.userAuthenticated === true;

    const sessionUserId =
      authenticated
        ? String(req.session.userId || "").trim()
        : "";

    if (!authenticated || !sessionUserId) {
      return res.status(401).json({
        success: false,
        message: "My Videos देखने के लिए पहले Login करें।"
      });
    }

    return res.json(
      videos.filter(video =>
        String(video.userId || "") === sessionUserId
      )
    );
  }

  // Home/Search के लिए केवल Public videos.
  // पुराने records जिनमें visibility नहीं है,
  // उन्हें backward compatibility के लिए public माना जाएगा.
  const publicVideos = videos.filter(video => {
    const visibility =
      String(video.visibility || "public")
        .toLowerCase();

    return visibility !== "private";
  });

  res.json(publicVideos);
});

/* ================================
   VIDEOAPNA ORIGINAL SOUNDS
================================ */

app.get("/api/sounds", (req, res) => {
  try {
    res.json(getAllSounds());
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Sounds load नहीं हो पाए।"
    });
  }
});


app.post("/api/private-sound", audioUpload.single("audio"), (req, res) => {
  try {

    const authenticated =
      req.session &&
      req.session.userAuthenticated === true;

    const sessionUserId =
      authenticated
        ? String(req.session.userId || "").trim()
        : "";

    if (!authenticated || !sessionUserId) {

      if (req.file) {
        try {
          if (
            req.file.path &&
            fs.existsSync(req.file.path)
          ) {
            fs.unlinkSync(req.file.path);
          }
        } catch {}
      }

      return res.status(401).json({
        success: false,
        message:
          "Private Sound के लिए पहले Login करें।"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Audio चुनें।"
      });
    }

    const title =
      String(
        req.body.title ||
        req.file.originalname ||
        "My Sound"
      ).trim();

    const sound = {
      id:
        "private-" +
        Date.now() +
        "-" +
        Math.random()
          .toString(36)
          .slice(2, 8),

      userId: sessionUserId,

      ownerUserId: sessionUserId,

      title:
        title || "My Sound",

      channel:
        "My Sound",

      url:
        "/uploads/" +
        req.file.filename,

      fileName:
        req.file.originalname,

      visibility:
        "private",

      createdAt:
        new Date().toISOString(),

      uses: 0
    };

    const sounds =
      readSounds();

    sounds.unshift(sound);

    saveSounds(sounds);

    res.json({
      success: true,

      message:
        "Private Sound तैयार है।",

      sound
    });

  } catch (error) {

    console.error(
      "PRIVATE SOUND ERROR:",
      error
    );

    if (req.file) {
      try {
        if (
          req.file.path &&
          fs.existsSync(req.file.path)
        ) {
          fs.unlinkSync(req.file.path);
        }
      } catch {}
    }

    res.status(500).json({
      success: false,

      message:
        "Private Sound upload नहीं हो पाया।"
    });
  }
});

app.post("/api/sounds", audioUpload.single("audio"), (req, res) => {
  try {
    // Original Sound upload करने के लिए Login जरूरी है।
    // Owner केवल server-side session से लिया जाएगा।
    const authenticated =
      req.session &&
      req.session.userAuthenticated === true;

    const sessionUserId =
      authenticated
        ? String(req.session.userId || "").trim()
        : "";

    if (!authenticated || !sessionUserId) {
      if (req.file) {
        try {
          if (req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
        } catch {}
      }

      return res.status(401).json({
        success: false,
        message: "Original Sound upload करने के लिए पहले VideoApna Account में Login करें।"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Audio चुनें।"
      });
    }

    const title =
      String(req.body.title || req.file.originalname || "Original Sound")
        .trim();

    const sound = {
      id: Date.now(),
      userId: sessionUserId,
      ownerUserId: sessionUserId,
      title,
      channel: "VideoApna",
      url: "/uploads/" + req.file.filename,
      fileName: req.file.originalname,
      createdAt: new Date().toISOString(),
      uses: 0
    };

    const sounds = readSounds();
    sounds.unshift(sound);
    saveSounds(sounds);

    res.json({
      success: true,
      message: "Original Sound upload हो गया!",
      sound
    });

  } catch (error) {
    console.error(error);

    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {}
    }

    res.status(500).json({
      success: false,
      message: "Sound upload नहीं हो पाया।"
    });
  }
});


function applyVideoTemplate(inputPath, outputPath, template) {
  return new Promise((resolve, reject) => {

    const filters = {
      normal: null,

      cinematic:
        "eq=contrast=1.18:saturation=1.12:brightness=-0.02",

      bright:
        "eq=brightness=0.08:contrast=1.08:saturation=1.10",

      vintage:
        "eq=contrast=1.05:saturation=0.78:brightness=0.02," +
        "colorbalance=rs=.08:gs=.03:bs=-.04",

      cool:
        "eq=contrast=1.05:saturation=1.08:brightness=0.01," +
        "colorbalance=rs=-.04:gs=.01:bs=.10"
    };

    const filter = filters[template] || filters.normal;

    // Normal template = original video, no FFmpeg processing.
    if (!filter) {
      fs.copyFile(inputPath, outputPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
      return;
    }

    const args = [
      "-y",
      "-i", inputPath,
      "-map", "0:v:0",
      "-map", "0:a?",
      "-vf", filter,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "23",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      outputPath
    ];

    console.log("FFmpeg template:", template);
    console.log("FFmpeg filter:", filter);

    execFile("ffmpeg", args, {
      maxBuffer: 10 * 1024 * 1024
    }, (error, stdout, stderr) => {

      if (error) {
        console.error("FFmpeg ERROR:", stderr || error.message);
        reject(new Error("वीडियो Template processing failed"));
        return;
      }

      console.log("FFmpeg template processing complete:", template);
      resolve();
    });
  });
}

app.post("/api/upload", upload.single("video"), async (req, res) => {
  let originalPath = null;
  let processedPath = null;
  let soundMergedPath = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "वीडियो चुनें।"
      });
    }

    originalPath = req.file.path;

    const title = String(req.body.title || "").trim();

    if (!title) {
      fs.unlinkSync(originalPath);

      return res.status(400).json({
        success: false,
        message: "वीडियो का Title लिखें।"
      });
    }

    // केवल logged-in session user ही video upload कर सकता है।
    const sessionUserAuthenticated =
      req.session && req.session.userAuthenticated === true;

    const userId =
      sessionUserAuthenticated
        ? String(req.session.userId || "").trim()
        : "";

    if (!sessionUserAuthenticated || !userId) {
      fs.unlinkSync(originalPath);

      return res.status(401).json({
        success: false,
        message:
          "वीडियो Upload करने के लिए पहले अपने VideoApna Account में Login करें।"
      });
    }

    // ------------------------------------------------------------
    // Video Template
    // ------------------------------------------------------------
    const template =
      String(req.body.template || "normal").trim();

    const allowedTemplates = [
      "normal",
      "cinematic",
      "bright",
      "vintage",
      "cool"
    ];

    const safeTemplate =
      allowedTemplates.includes(template)
        ? template
        : "normal";

    // ------------------------------------------------------------
    // Selected Music को server-side validate करें।
    // Client के भेजे soundUrl पर भरोसा नहीं करेंगे।
    // ------------------------------------------------------------
    const requestedSoundId =
      String(req.body.soundId || "").trim();

    const selectedSound =
      findAllowedSound(requestedSoundId);

    if (requestedSoundId && !selectedSound) {
      fs.unlinkSync(originalPath);

      return res.status(400).json({
        success: false,
        message: "Selected Sound उपलब्ध नहीं है।"
      });
    }

    let selectedSoundPath = null;

    if (selectedSound) {

      // Private Sound केवल उसके owner को इस्तेमाल करने दें।
      if (
        selectedSound.visibility === "private" &&
        String(
          selectedSound.ownerUserId ||
          selectedSound.userId ||
          ""
        ) !== String(userId)
      ) {
        fs.unlinkSync(originalPath);

        return res.status(403).json({
          success: false,
          message: "यह Private Sound आपके खाते का नहीं है।"
        });
      }

      selectedSoundPath =
        resolveSoundFile(selectedSound);

      if (!selectedSoundPath) {
        fs.unlinkSync(originalPath);

        return res.status(400).json({
          success: false,
          message: "Selected Sound file उपलब्ध नहीं है।"
        });
      }
    }

    // ------------------------------------------------------------
    // Template Apply
    // ------------------------------------------------------------
    const ext =
      path.extname(req.file.filename) || ".mp4";

    const processedFilename =
      path.basename(req.file.filename, ext) +
      "-template.mp4";

    processedPath =
      path.join(UPLOADS, processedFilename);

    console.log(
      "VIDEO TEMPLATE REQUEST:",
      safeTemplate
    );

    await applyVideoTemplate(
      originalPath,
      processedPath,
      safeTemplate
    );

    // Original temporary upload हटाएँ।
    if (
      originalPath !== processedPath &&
      fs.existsSync(originalPath)
    ) {
      fs.unlinkSync(originalPath);
    }

    originalPath = null;

    // ------------------------------------------------------------
    // Video duration
    // ------------------------------------------------------------
    let videoDuration = 0;

    try {
      const durationProbe =
        await new Promise((resolve, reject) => {

          execFile(
            "ffprobe",
            [
              "-v",
              "error",
              "-show_entries",
              "format=duration",
              "-of",
              "default=noprint_wrappers=1:nokey=1",
              processedPath
            ],
            (error, stdout, stderr) => {

              if (error) {
                reject(error);
                return;
              }

              const value =
                Number(
                  String(stdout || "").trim()
                );

              if (
                !Number.isFinite(value) ||
                value < 0
              ) {
                reject(
                  new Error(
                    "ffprobe ने valid duration नहीं दी।"
                  )
                );
                return;
              }

              resolve(value);
            }
          );
        });

      videoDuration = durationProbe;

      console.log(
        "VIDEO DURATION:",
        videoDuration.toFixed(2),
        "seconds"
      );

    } catch (durationError) {

      console.error(
        "VIDEO DURATION CHECK FAILED:",
        durationError.message
      );
    }

    // ------------------------------------------------------------
    // Music को Video में permanently merge करें।
    // Public Music और user's Private Music दोनों supported हैं।
    // ------------------------------------------------------------
    if (selectedSoundPath) {

      soundMergedPath =
        processedPath.replace(
          /\.mp4$/i,
          "-with-sound.mp4"
        );

      console.log(
        "ADDING SOUND TO VIDEO:",
        selectedSound.title
      );

      await mergeAudioIntoVideo(
        processedPath,
        selectedSoundPath,
        soundMergedPath
      );

      if (fs.existsSync(processedPath)) {
        fs.unlinkSync(processedPath);
      }

      fs.renameSync(
        soundMergedPath,
        processedPath
      );

      soundMergedPath = null;

      console.log(
        "SOUND MERGE COMPLETE:",
        processedPath
      );
    }

    // ------------------------------------------------------------
    // VCDN upload — अब Music merge होने के बाद
    // ------------------------------------------------------------
    let vcdn = null;

    try {

      if (
        String(
          process.env.VCDN_API_KEY || ""
        ).trim()
      ) {

        console.log(
          "VCDN upload starting:",
          processedFilename
        );

        vcdn =
          await uploadVideoToVcdn(
            processedPath,
            title
          );

        console.log(
          "VCDN upload ready:",
          vcdn.vcdnVideoId
        );

      } else {

        console.log(
          "VCDN_API_KEY not configured. Using local video."
        );
      }

    } catch (vcdnError) {

      console.error(
        "VCDN upload failed. Keeping local video fallback:",
        vcdnError.message
      );

      vcdn = null;
    }

    const localVideoUrl =
      "/uploads/" + processedFilename;

    // ------------------------------------------------------------
    // Final Video object
    // Sound metadata केवल server-side selectedSound से आएगा।
    // ------------------------------------------------------------
    const video = {

      id: Date.now(),

      userId,
      ownerUserId: userId,
      visibility: "public",

      title,

      description:
        String(
          req.body.description || ""
        ),

      category:
        String(
          req.body.category || "मनोरंजन"
        ),

      template: safeTemplate,

      channel: "VideoApna",

      views: "0 views",

      duration:
        Number(videoDuration || 0),

      url:
        vcdn &&
        vcdn.vcdnPlaybackUrl
          ? vcdn.vcdnPlaybackUrl
          : localVideoUrl,

      localUrl:
        localVideoUrl,

      fileName:
        req.file.originalname,

      vcdnVideoId:
        vcdn
          ? vcdn.vcdnVideoId
          : "",

      vcdnStatus:
        vcdn
          ? vcdn.vcdnStatus
          : "local",

      vcdnPlaybackUrl:
        vcdn
          ? vcdn.vcdnPlaybackUrl
          : "",

      embedUrl:
        vcdn
          ? vcdn.vcdnEmbedUrl
          : "",

      posterUrl:
        vcdn
          ? vcdn.vcdnPosterUrl
          : "",

      soundId:
        selectedSound
          ? String(selectedSound.id)
          : "",

      soundTitle:
        selectedSound
          ? String(
              selectedSound.title || ""
            )
          : "",

      soundUrl:
        selectedSound
          ? String(
              selectedSound.url || ""
            )
          : "",

      createdAt:
        new Date().toISOString()
    };

    const videos = readVideos();

    videos.unshift(video);

    saveVideos(videos);

    res.json({
      success: true,

      message:
        vcdn
          ? "वीडियो Music के साथ VCDN पर Publish हो गया!"
          : "वीडियो Music के साथ Publish हो गया!",

      video
    });

  } catch (error) {

    console.error(
      "VIDEO UPLOAD/TEMPLATE/SOUND ERROR:",
      error
    );

    // Failed processing में temporary files साफ करें।
    try {
      if (
        soundMergedPath &&
        fs.existsSync(soundMergedPath)
      ) {
        fs.unlinkSync(soundMergedPath);
      }
    } catch {}

    try {
      if (
        processedPath &&
        fs.existsSync(processedPath)
      ) {
        fs.unlinkSync(processedPath);
      }
    } catch {}

    try {
      if (
        originalPath &&
        fs.existsSync(originalPath)
      ) {
        fs.unlinkSync(originalPath);
      }
    } catch {}

    res.status(500).json({
      success: false,

      message:
        error.message ||
        "वीडियो Publish नहीं हो पाया।"
    });
  }
});

/* ================================
   VIDEOAPNA VIEWS API
================================ */


/* ================================
   VIDEOAPNA DELETE VIDEO API
================================ */


/* =========================================================
   VIDEOAPNA PHOTO → VIDEO
   1-5 Photos | 10/15/20 sec | FFmpeg | No AI
========================================================= */

app.post("/api/photo-to-video", photoUpload.array("photos", 5), async (req, res) => {
  let photoFiles = [];
  let outputPath = null;
  let soundMergedPath = null;

  try {

    // ------------------------------------------------------------
    // Login check
    // ------------------------------------------------------------
    const authenticated =
      req.session &&
      req.session.userAuthenticated === true;

    const sessionUserId =
      authenticated
        ? String(req.session.userId || "").trim()
        : "";

    if (!authenticated || !sessionUserId) {

      const filesToRemove = req.files || [];

      for (const file of filesToRemove) {
        try {
          if (
            file &&
            file.path &&
            fs.existsSync(file.path)
          ) {
            fs.unlinkSync(file.path);
          }
        } catch {}
      }

      return res.status(401).json({
        success: false,
        message:
          "Photo से Short Video बनाने के लिए पहले VideoApna Account में Login करें।"
      });
    }

    photoFiles = req.files || [];

    // ------------------------------------------------------------
    // Photo count
    // ------------------------------------------------------------
    if (!photoFiles.length) {
      return res.status(400).json({
        success: false,
        message: "कम से कम 1 फोटो चुनें।"
      });
    }

    if (photoFiles.length > 5) {
      return res.status(400).json({
        success: false,
        message: "अधिकतम 5 फोटो चुन सकते हैं।"
      });
    }

    // ------------------------------------------------------------
    // Title — Photo Short के लिए जरूरी
    // ------------------------------------------------------------
    const photoVideoTitle =
      String(req.body.title || "").trim();

    if (!photoVideoTitle) {

      for (const photo of photoFiles) {
        try {
          if (
            photo.path &&
            fs.existsSync(photo.path)
          ) {
            fs.unlinkSync(photo.path);
          }
        } catch {}
      }

      return res.status(400).json({
        success: false,
        message: "Photo Short का Title लिखें।"
      });
    }

    // ------------------------------------------------------------
    // Description
    // ------------------------------------------------------------
    const photoVideoDescription =
      String(
        req.body.description || ""
      ).trim();

    // ------------------------------------------------------------
    // Duration
    // ------------------------------------------------------------
    const duration =
      Number(req.body.duration || 10);

    if (![10, 15, 20].includes(duration)) {

      return res.status(400).json({
        success: false,
        message:
          "Duration केवल 10, 15 या 20 सेकंड हो सकती है।"
      });
    }

    // ------------------------------------------------------------
    // Template
    // ------------------------------------------------------------
    const template =
      String(
        req.body.template || "normal"
      ).trim();

    const allowedTemplates = [
      "normal",
      "cinematic",
      "bright",
      "vintage",
      "cool"
    ];

    const safeTemplate =
      allowedTemplates.includes(template)
        ? template
        : "normal";

    // ------------------------------------------------------------
    // Music validation
    // ------------------------------------------------------------
    const requestedSoundId =
      String(
        req.body.soundId || ""
      ).trim();

    const selectedSound =
      findAllowedSound(
        requestedSoundId
      );

    if (
      requestedSoundId &&
      !selectedSound
    ) {

      return res.status(400).json({
        success: false,
        message:
          "Selected Sound उपलब्ध नहीं है।"
      });
    }

    let selectedSoundPath = null;

    if (selectedSound) {

      // Private Sound केवल उसके owner को।
      if (
        selectedSound.visibility === "private" &&
        String(
          selectedSound.ownerUserId ||
          selectedSound.userId ||
          ""
        ) !== String(sessionUserId)
      ) {

        return res.status(403).json({
          success: false,
          message:
            "यह Private Sound आपके खाते का नहीं है।"
        });
      }

      selectedSoundPath =
        resolveSoundFile(
          selectedSound
        );

      if (!selectedSoundPath) {

        return res.status(400).json({
          success: false,
          message:
            "Selected Sound file उपलब्ध नहीं है।"
        });
      }
    }

    // ------------------------------------------------------------
    // Output filename
    // ------------------------------------------------------------
    const outputFilename =
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2, 8) +
      "-photo-short.mp4";

    outputPath =
      path.join(
        UPLOADS,
        outputFilename
      );

    // हर photo की duration।
    const eachDuration =
      duration / photoFiles.length;

    // ------------------------------------------------------------
    // Template filters
    // ------------------------------------------------------------
    const filterMap = {

      normal: "",

      cinematic:
        "eq=contrast=1.12:saturation=1.08:brightness=-0.01",

      bright:
        "eq=brightness=0.06:contrast=1.05:saturation=1.10",

      vintage:
        "eq=contrast=1.05:saturation=0.82:brightness=0.02," +
        "colorbalance=rs=.06:gs=.02:bs=-.03",

      cool:
        "eq=contrast=1.05:saturation=1.06:brightness=0.01," +
        "colorbalance=rs=-.03:gs=.01:bs=.08"
    };

    const tempFiles = [];

    try {

      // ----------------------------------------------------------
      // प्रत्येक Photo को Video part में बदलना
      // ----------------------------------------------------------
      for (
        let i = 0;
        i < photoFiles.length;
        i++
      ) {

        const photo =
          photoFiles[i];

        const tempName =
          Date.now() +
          "-" +
          Math.random()
            .toString(36)
            .slice(2, 8) +
          "-photo-part-" +
          i +
          ".mp4";

        const tempPath =
          path.join(
            UPLOADS,
            tempName
          );

        tempFiles.push(
          tempPath
        );

        let vf =
          "scale=720:1280:force_original_aspect_ratio=increase," +
          "crop=720:1280,fps=30";

        if (
          safeTemplate === "cinematic"
        ) {

          vf =
            "scale=720:1280:force_original_aspect_ratio=increase," +
            "crop=720:1280," +
            "zoompan=z='min(zoom+0.0015,1.10)':" +
            "x='iw/2-(iw/zoom/2)':" +
            "y='ih/2-(ih/zoom/2)':" +
            "d=1:s=720x1280:fps=30";
        }

        if (
          filterMap[safeTemplate] &&
          safeTemplate !== "cinematic"
        ) {

          vf +=
            "," +
            filterMap[safeTemplate];
        }

        console.log(
          "PHOTO SHORT PART:",
          i + 1
        );

        console.log(
          "Photo:",
          photo.path
        );

        await new Promise(
          (resolve, reject) => {

            execFile(
              "ffmpeg",
              [
                "-y",

                "-loop",
                "1",

                "-i",
                photo.path,

                "-t",
                String(
                  eachDuration
                ),

                "-vf",
                vf,

                "-r",
                "30",

                "-c:v",
                "libx264",

                "-preset",
                "ultrafast",

                "-crf",
                "23",

                "-pix_fmt",
                "yuv420p",

                "-an",

                tempPath
              ],
              {
                maxBuffer:
                  20 * 1024 * 1024
              },
              (
                error,
                stdout,
                stderr
              ) => {

                if (error) {

                  console.error(
                    "PHOTO SHORT PART ERROR:",
                    stderr ||
                    error.message
                  );

                  reject(
                    new Error(
                      "Photo से Short Video नहीं बन पाया।"
                    )
                  );

                  return;
                }

                console.log(
                  "PHOTO SHORT PART READY:",
                  tempPath
                );

                resolve();
              }
            );
          }
        );
      }

      // ----------------------------------------------------------
      // सभी photo parts को एक video में जोड़ना
      // ----------------------------------------------------------
      const concatFile =
        path.join(
          UPLOADS,
          Date.now() +
          "-photo-short-concat.txt"
        );

      const concatContent =
        tempFiles
          .map(
            file =>
              "file '" +
              file.replace(
                /'/g,
                "'\\''"
              ) +
              "'"
          )
          .join("\n");

      fs.writeFileSync(
        concatFile,
        concatContent
      );

      await new Promise(
        (resolve, reject) => {

          execFile(
            "ffmpeg",
            [
              "-y",

              "-f",
              "concat",

              "-safe",
              "0",

              "-i",
              concatFile,

              "-c",
              "copy",

              "-movflags",
              "+faststart",

              outputPath
            ],
            {
              maxBuffer:
                20 * 1024 * 1024
            },
            (
              error,
              stdout,
              stderr
            ) => {

              try {
                if (
                  fs.existsSync(
                    concatFile
                  )
                ) {
                  fs.unlinkSync(
                    concatFile
                  );
                }
              } catch {}

              if (error) {

                console.error(
                  "PHOTO SHORT CONCAT ERROR:",
                  stderr ||
                  error.message
                );

                reject(
                  new Error(
                    "Photo से Short Video नहीं बन पाया।"
                  )
                );

                return;
              }

              console.log(
                "PHOTO SHORT FINAL READY:",
                outputPath
              );

              resolve();
            }
          );
        }
      );

    } finally {

      // Temporary photo-video parts हटाएँ।
      for (
        const tempFile of tempFiles
      ) {

        try {

          if (
            fs.existsSync(
              tempFile
            )
          ) {
            fs.unlinkSync(
              tempFile
            );
          }

        } catch {}
      }
    }

    // ------------------------------------------------------------
    // Music को Photo Short में permanently merge करें।
    // Audio loop होगा और Short की exact duration पर कटेगा।
    // ------------------------------------------------------------
    if (selectedSoundPath) {

      soundMergedPath =
        outputPath.replace(
          /\.mp4$/i,
          "-with-sound.mp4"
        );

      console.log(
        "ADDING SOUND TO PHOTO SHORT:",
        selectedSound.title
      );

      await mergeAudioIntoVideo(
        outputPath,
        selectedSoundPath,
        soundMergedPath,
        duration
      );

      if (
        fs.existsSync(
          outputPath
        )
      ) {
        fs.unlinkSync(
          outputPath
        );
      }

      fs.renameSync(
        soundMergedPath,
        outputPath
      );

      soundMergedPath = null;

      console.log(
        "PHOTO SHORT SOUND MERGE COMPLETE:",
        outputPath
      );
    }

    // ------------------------------------------------------------
    // VCDN upload — Music merge के बाद
    // ------------------------------------------------------------
    const photoVideoLocalUrl =
      "/uploads/" +
      outputFilename;

    let vcdn = null;

    try {

      if (
        String(
          process.env.VCDN_API_KEY ||
          ""
        ).trim()
      ) {

        console.log(
          "VCDN Photo Short upload starting:",
          outputFilename
        );

        vcdn =
          await uploadVideoToVcdn(
            outputPath,
            photoVideoTitle
          );

        console.log(
          "VCDN Photo Short upload ready:",
          vcdn.vcdnVideoId
        );

      } else {

        console.log(
          "VCDN_API_KEY not configured. Using local Photo Short."
        );
      }

    } catch (
      vcdnError
    ) {

      console.error(
        "VCDN Photo Short upload failed. Keeping local fallback:",
        vcdnError.message
      );

      vcdn = null;
    }

    // ------------------------------------------------------------
    // Final Video object
    // ------------------------------------------------------------
    const video = {

      id: Date.now(),

      userId:
        sessionUserId,

      ownerUserId:
        sessionUserId,

      visibility:
        "public",

      title:
        photoVideoTitle,

      description:
        photoVideoDescription,

      category:
        String(
          req.body.category ||
          "मनोरंजन"
        ),

      template:
        safeTemplate,

      channel:
        "VideoApna",

      views:
        "0 views",

      url:
        vcdn &&
        vcdn.vcdnPlaybackUrl
          ? vcdn.vcdnPlaybackUrl
          : photoVideoLocalUrl,

      localUrl:
        photoVideoLocalUrl,

      fileName:
        outputFilename,

      vcdnVideoId:
        vcdn
          ? vcdn.vcdnVideoId
          : "",

      vcdnStatus:
        vcdn
          ? vcdn.vcdnStatus
          : "local",

      vcdnPlaybackUrl:
        vcdn
          ? vcdn.vcdnPlaybackUrl
          : "",

      embedUrl:
        vcdn
          ? vcdn.vcdnEmbedUrl
          : "",

      posterUrl:
        vcdn
          ? vcdn.vcdnPosterUrl
          : "",

      soundId:
        selectedSound
          ? String(
              selectedSound.id
            )
          : "",

      soundTitle:
        selectedSound
          ? String(
              selectedSound.title ||
              ""
            )
          : "",

      soundUrl:
        selectedSound
          ? String(
              selectedSound.url ||
              ""
            )
          : "",

      duration:
        duration,

      createdAt:
        new Date().toISOString()
    };

    const videos =
      readVideos();

    videos.unshift(
      video
    );

    saveVideos(
      videos
    );

    // Original uploaded photos अब जरूरी नहीं।
    for (
      const photo of photoFiles
    ) {

      try {

        if (
          photo.path &&
          fs.existsSync(
            photo.path
          )
        ) {
          fs.unlinkSync(
            photo.path
          );
        }

      } catch {}
    }

    res.json({
      success: true,

      message:
        "Photo से Short Video तैयार है!",

      video
    });

  } catch (error) {

    console.error(
      "PHOTO TO SHORT VIDEO ERROR:",
      error
    );

    // Uploaded photos cleanup
    for (
      const photo of photoFiles
    ) {

      try {

        if (
          photo.path &&
          fs.existsSync(
            photo.path
          )
        ) {
          fs.unlinkSync(
            photo.path
          );
        }

      } catch {}
    }

    // Merged temporary file cleanup
    try {

      if (
        soundMergedPath &&
        fs.existsSync(
          soundMergedPath
        )
      ) {
        fs.unlinkSync(
          soundMergedPath
        );
      }

    } catch {}

    // Final output cleanup
    try {

      if (
        outputPath &&
        fs.existsSync(
          outputPath
        )
      ) {
        fs.unlinkSync(
          outputPath
        );
      }

    } catch {}

    res.status(500).json({
      success: false,

      message:
        error.message ||
        "Photo से Short Video नहीं बन पाया।"
    });
  }
});

/* =========================================
   VIDEOAPNA COPYRIGHT / VIDEO REPORT API
========================================= */

const VIDEO_REPORTS_FILE =
  path.join(DATA, "video-reports.json");

function readVideoReports() {
  try {
    if (!fs.existsSync(VIDEO_REPORTS_FILE)) return [];

    const data = JSON.parse(
      fs.readFileSync(
        VIDEO_REPORTS_FILE,
        "utf8"
      )
    );

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(
      "VIDEO REPORTS READ ERROR:",
      error
    );
    return [];
  }
}

function saveVideoReports(reports) {
  try {
    fs.writeFileSync(
      VIDEO_REPORTS_FILE,
      JSON.stringify(
        reports,
        null,
        2
      ),
      "utf8"
    );

    return true;
  } catch (error) {
    console.error(
      "VIDEO REPORTS SAVE ERROR:",
      error
    );
    return false;
  }
}

app.post("/api/video-reports", (req, res) => {
  try {
    const body = req.body || {};

    const videoId =
      String(body.videoId || "").trim();

    const userId =
      String(body.userId || "").trim();

    const reason =
      String(body.reason || "").trim();

    const details =
      String(body.details || "").trim();

    if (!videoId) {
      return res.status(400).json({
        success: false,
        message: "Video ID जरूरी है।"
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User पहचान नहीं मिली।"
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Report का कारण चुनें।"
      });
    }

    const videos = readVideos();

    const video = videos.find(
      v => String(v.id) === videoId
    );

    /*
     * PeerTube videos are not stored in data/videos.json.
     * For PeerTube reports, the client sends title/source information
     * and the report is saved without treating the PeerTube video
     * as a local uploaded video.
     */

    const reportVideoTitle = String(
      body.videoTitle ||
      (video && video.title) ||
      ""
    ).slice(0, 500);

    const reportVideoOwnerId = String(
      (video && (
        video.userId ||
        video.ownerUserId ||
        ""
      )) ||
      ""
    );

    const reportSource = String(
      body.source ||
      (video && video.source) ||
      ""
    ).slice(0, 100);

    const reports = readVideoReports();

    const alreadyReported =
      reports.some(report =>
        String(report.videoId) === videoId &&
        String(report.reporterUserId) === userId &&
        String(report.status || "pending") === "pending"
      );

    if (alreadyReported) {
      return res.status(409).json({
        success: false,
        message: "आप इस वीडियो को पहले ही Report कर चुके हैं।"
      });
    }

    const report = {
      id:
        Date.now() +
        "-" +
        Math.random()
          .toString(36)
          .slice(2, 10),

      videoId,

      videoTitle:
        reportVideoTitle,

      videoOwnerId:
        reportVideoOwnerId,

      source:
        reportSource || (
          video ? "videoapna" : "peertube"
        ),

      reporterUserId:
        userId,

      reason:
        reason.slice(0, 100),

      details:
        details.slice(0, 2000),

      status:
        "pending",

      createdAt:
        new Date().toISOString()
    };

    reports.push(report);

    if (!saveVideoReports(reports)) {
      return res.status(500).json({
        success: false,
        message: "Report save नहीं हो पाई।"
      });
    }

    res.json({
      success: true,
      message: "Report Owner को भेज दी गई है।",
      reportId: report.id
    });

  } catch (error) {
    console.error(
      "VIDEO REPORT ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Report भेजने में समस्या हुई।"
    });
  }
});

app.delete("/api/videos/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    const videos = readVideos();

    const index = videos.findIndex(
      v => Number(v.id) === id
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "वीडियो नहीं मिला।"
      });
    }

    const video = videos[index];

    // Delete के लिए client के userId पर भरोसा नहीं करेंगे।
    // केवल logged-in session का userId असली owner माना जाएगा।
    const authenticated =
      req.session &&
      req.session.userAuthenticated === true;

    const sessionUserId =
      authenticated
        ? String(req.session.userId || "").trim()
        : "";

    const ownerUserId = String(
      video.userId ||
      video.ownerUserId ||
      ""
    ).trim();

    if (!authenticated || !sessionUserId) {
      return res.status(401).json({
        success: false,
        message: "वीडियो Delete करने के लिए पहले Login करें।"
      });
    }

    if (!ownerUserId || ownerUserId !== sessionUserId) {
      return res.status(403).json({
        success: false,
        message: "आप केवल अपना video Delete कर सकते हैं।"
      });
    }

    // Video file भी हटाएँ
    if (video.url && video.url.startsWith("/uploads/")) {
      const filePath = path.join(
        UPLOADS,
        path.basename(video.url)
      );

      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log("VIDEO FILE DELETED:", filePath);
        }
      } catch (fileError) {
        console.error(
          "VIDEO FILE DELETE ERROR:",
          fileError
        );
      }
    }

    // videos.json से video हटाएँ
    videos.splice(index, 1);
    saveVideos(videos);

    res.json({
      success: true,
      message: "वीडियो Delete हो गया!",
      id
    });

  } catch (error) {
    console.error("DELETE VIDEO ERROR:", error);

    res.status(500).json({
      success: false,
      message: "वीडियो Delete नहीं हो पाया।"
    });
  }
});


app.post("/api/videos/:id/view", (req, res) => {
  try {
    const id = Number(req.params.id);
    const videos = readVideos();

    const video = videos.find(v => Number(v.id) === id);

    if (!video) {
      return res.status(404).json({
        success: false,
        message: "वीडियो नहीं मिला।"
      });
    }

    video.viewCount = Number(video.viewCount || 0) + 1;
    video.views = video.viewCount + " views";

    saveVideos(videos);

    res.json({
      success: true,
      views: video.viewCount
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "View save नहीं हो पाया।"
    });
  }
});



// =========================================
// VIDEOAPNA PERSONALIZED WATCH TRACKING
// =========================================

const WATCH_EVENTS_FILE =
  path.join(DATA, "user-watch-events.json");

function readWatchEvents() {
  try {
    if (!fs.existsSync(WATCH_EVENTS_FILE)) {
      return [];
    }

    const data =
      JSON.parse(
        fs.readFileSync(
          WATCH_EVENTS_FILE,
          "utf8"
        )
      );

    return Array.isArray(data) ? data : [];

  } catch (error) {
    console.error(
      "WATCH EVENTS READ ERROR:",
      error
    );
    return [];
  }
}

function saveWatchEvents(events) {
  try {
    fs.writeFileSync(
      WATCH_EVENTS_FILE,
      JSON.stringify(
        events,
        null,
        2
      ),
      "utf8"
    );

    return true;

  } catch (error) {
    console.error(
      "WATCH EVENTS SAVE ERROR:",
      error
    );

    return false;
  }
}


// =========================================
// VIDEOAPNA RECOMMENDATION PROFILE
// =========================================


// =========================================
// VIDEOAPNA PERSONALIZED RECOMMENDATION FEED
// =========================================

app.post(
  "/api/recommendation/feed",
  (req, res) => {

    try {
      const body = req.body || {};

      const userId =
        String(body.userId || "").trim();

      const videos =
        Array.isArray(body.videos)
          ? body.videos
          : [];

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "userId जरूरी है।"
        });
      }

      if (!videos.length) {
        return res.json({
          success: true,
          videos: []
        });
      }

      const events =
        readWatchEvents().filter(
          event =>
            String(event.userId || "") === userId
        );

      /*
       * =========================================
       * VIDEOAPNA SMART RECOMMENDATION
       * =========================================
       *
       * वीडियो को हमेशा के लिए block नहीं किया जाएगा।
       *
       * Priority:
       * 1. नया वीडियो
       * 2. अनदेखा वीडियो
       * 3. पसंद की language/category
       * 4. कम देखा हुआ
       * 5. हाल में देखा हुआ नीचे
       * 6. समय बीतने पर पुराना watched video फिर ऊपर आ सकता है
       */

      const languageScore = {};
      const categoryScore = {};

      const watchStats = new Map();

      for (const event of events) {

        const watchedId =
          String(
            event.videoId ||
            event.uuid ||
            ""
          ).trim();

        if (!watchedId) continue;

        const seconds =
          Math.max(
            0,
            Number(event.watchSeconds || 0)
          );

        const completion =
          Math.min(
            1,
            Math.max(
              0,
              Number(event.completion || 0)
            )
          );

        const createdAt =
          Date.parse(
            String(event.createdAt || "")
          );

        const old =
          watchStats.get(watchedId) || {
            count: 0,
            seconds: 0,
            maxCompletion: 0,
            lastWatchedAt: 0,
            completed: false,
            liked: false,
            saved: false
          };

        old.count += 1;
        old.seconds += seconds;

        old.maxCompletion =
          Math.max(
            old.maxCompletion,
            completion
          );

        if (
          Number.isFinite(createdAt) &&
          createdAt > old.lastWatchedAt
        ) {
          old.lastWatchedAt = createdAt;
        }

        if (event.completed) {
          old.completed = true;
        }

        if (event.liked) {
          old.liked = true;
        }

        if (event.saved) {
          old.saved = true;
        }

        watchStats.set(
          watchedId,
          old
        );

        /*
         * Language preference
         */
        const language =
          String(
            event.language || ""
          )
            .trim()
            .toLowerCase();

        if (language) {
          const signal =
            Math.max(1, seconds) *
            (0.5 + completion);

          languageScore[language] =
            (
              languageScore[language] || 0
            ) + signal;
        }

        /*
         * Category preference
         */
        const category =
          String(
            event.category || ""
          ).trim();

        if (
          category &&
          category.toLowerCase() !== "unknown"
        ) {
          const signal =
            Math.max(1, seconds) *
            (0.5 + completion);

          categoryScore[category] =
            (
              categoryScore[category] || 0
            ) + signal;
        }
      }

      const now = Date.now();

      const scoredVideos =
        videos.map(
          (video, index) => {

            const videoId =
              String(
                video.uuid ||
                video.id ||
                ""
              ).trim();

            const videoLanguage =
              String(
                video.language || ""
              )
                .trim()
                .toLowerCase();

            const videoCategory =
              String(
                video.category || ""
              ).trim();

            let score = 0;

            /*
             * =================================
             * 1. अनदेखे वीडियो को strong priority
             * =================================
             */
            const stats =
              watchStats.get(videoId);

            if (!stats) {
              score += 120;
            } else {

              /*
               * =================================
               * 2. हाल में देखे हुए वीडियो
               * permanent block नहीं होंगे
               * =================================
               */

              const ageDays =
                stats.lastWatchedAt > 0
                  ? Math.max(
                      0,
                      (
                        now -
                        stats.lastWatchedAt
                      ) /
                      (
                        1000 *
                        60 *
                        60 *
                        24
                      )
                    )
                  : 9999;

              if (ageDays < 1) {
                score -= 100;
              } else if (ageDays < 3) {
                score -= 65;
              } else if (ageDays < 7) {
                score -= 30;
              } else if (ageDays < 14) {
                score -= 10;
              } else {
                /*
                 * 14 दिन से पुराना watched video
                 * फिर से recommendation में आ सकता है।
                 */
                score += 10;
              }

              /*
               * ज्यादा बार देखा गया तो थोड़ी
               * additional priority कम होगी।
               */
              score -= Math.min(
                40,
                Math.max(
                  0,
                  stats.count - 1
                ) * 5
              );

              /*
               * पूरा देखा हुआ video तुरंत ऊपर नहीं आए।
               */
              if (stats.maxCompletion >= 0.90) {
                score -= 25;
              }

              /*
               * सिर्फ थोड़ा देखा था तो बहुत बड़ी
               * penalty नहीं लगाएँगे।
               */
              if (
                stats.seconds < 10 &&
                stats.maxCompletion < 0.90
              ) {
                score += 15;
              }
            }

            /*
             * =================================
             * 3. पसंदीदा language
             * =================================
             */
            if (
              videoLanguage &&
              languageScore[videoLanguage]
            ) {
              score += Math.min(
                100,
                languageScore[videoLanguage] / 5
              );
            }

            /*
             * =================================
             * 4. पसंदीदा category
             * =================================
             */
            if (
              videoCategory &&
              categoryScore[videoCategory]
            ) {
              score += Math.min(
                80,
                categoryScore[videoCategory] / 5
              );
            }

            /*
             * =================================
             * 5. Hindi cold-start preference
             *
             * बाकी Indian languages block नहीं होंगी।
             * =================================
             */
            if (videoLanguage === "hi") {
              score += 10;
            }

            /*
             * =================================
             * 6. नया video bonus
             * =================================
             *
             * VideoApna में createdAt
             * और PeerTube में publishedAt भेजा जाएगा।
             */
            const publishedAt =
              Date.parse(
                String(
                  video.publishedAt ||
                  video.createdAt ||
                  ""
                )
              );

            if (Number.isFinite(publishedAt)) {

              const ageHours =
                Math.max(
                  0,
                  (
                    now -
                    publishedAt
                  ) /
                  (
                    1000 *
                    60 *
                    60
                  )
                );

              if (ageHours <= 24) {
                score += 70;
              } else if (ageHours <= 72) {
                score += 45;
              } else if (ageHours <= 168) {
                score += 20;
              }
            }

            /*
             * Original source order को थोड़ा
             * preserve रखें ताकि बराबरी पर
             * random jump न हो।
             */
            score +=
              Math.max(
                0,
                0.001 *
                (videos.length - index)
              );

            return {
              ...video,
              recommendationScore:
                Number(
                  score.toFixed(3)
                )
            };
          }
        );

      scoredVideos.sort(
        (a, b) =>
          b.recommendationScore -
          a.recommendationScore
      );

      res.json({
        success: true,
        userId,
        videos: scoredVideos
      });

    } catch (error) {

      console.error(
        "RECOMMENDATION FEED ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Recommendation feed error"
      });
    }
  }
);

app.get(
  "/api/recommendation/profile",
  (req, res) => {

    try {

      const userId =
        String(
          req.query.userId || ""
        ).trim();

      if (!userId) {

        return res.status(400).json({
          success: false,
          message:
            "userId जरूरी है।"
        });

      }

      const events =
        readWatchEvents()
          .filter(
            event =>
              String(event.userId) === userId
          );

      const languageStats = {};
      const categoryStats = {};

      let totalWatchSeconds = 0;
      let totalVideos = 0;
      let completedVideos = 0;
      let likedVideos = 0;
      let savedVideos = 0;

      for (const event of events) {

        const seconds =
          Math.max(
            0,
            Number(
              event.watchSeconds || 0
            )
          );

        totalWatchSeconds += seconds;

        totalVideos += 1;

        if (event.completed) {
          completedVideos += 1;
        }

        if (event.liked) {
          likedVideos += 1;
        }

        if (event.saved) {
          savedVideos += 1;
        }

        const language =
          String(
            event.language || ""
          ).trim().toLowerCase();

        if (language) {

          if (!languageStats[language]) {
            languageStats[language] = {
              videos: 0,
              watchSeconds: 0
            };
          }

          languageStats[language].videos += 1;
          languageStats[language].watchSeconds += seconds;
        }

        const category =
          String(
            event.category || ""
          ).trim();

        if (
          category &&
          category.toLowerCase() !== "unknown"
        ) {

          if (!categoryStats[category]) {
            categoryStats[category] = {
              videos: 0,
              watchSeconds: 0
            };
          }

          categoryStats[category].videos += 1;
          categoryStats[category].watchSeconds += seconds;
        }
      }

      const languages =
        Object.entries(languageStats)
          .map(
            ([language, stats]) => ({
              language,
              videos: stats.videos,
              watchSeconds: stats.watchSeconds
            })
          )
          .sort(
            (a, b) =>
              b.watchSeconds -
              a.watchSeconds
          );

      const categories =
        Object.entries(categoryStats)
          .map(
            ([category, stats]) => ({
              category,
              videos: stats.videos,
              watchSeconds: stats.watchSeconds
            })
          )
          .sort(
            (a, b) =>
              b.watchSeconds -
              a.watchSeconds
          );

      res.json({

        success: true,

        userId,

        summary: {
          totalVideos,
          totalWatchSeconds,
          completedVideos,
          likedVideos,
          savedVideos
        },

        preferredLanguages:
          languages.slice(0, 10),

        preferredCategories:
          categories.slice(0, 10)

      });

    } catch (error) {

      console.error(
        "RECOMMENDATION PROFILE ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Recommendation profile error"
      });

    }
  }
);

app.post(
  "/api/recommendation/watch",
  (req, res) => {

    try {

      const body =
        req.body || {};

      const userId =
        String(
          body.userId || ""
        ).trim();

      const videoId =
        String(
          body.videoId ||
          body.uuid ||
          ""
        ).trim();

      if (!userId || !videoId) {

        return res.status(400).json({
          success: false,
          message:
            "userId और videoId जरूरी हैं।"
        });

      }

      const event = {

        id:
          Date.now() +
          "-" +
          Math.random()
            .toString(36)
            .slice(2, 10),

        userId,

        videoId,

        uuid:
          String(
            body.uuid || ""
          ),

        title:
          String(
            body.title || ""
          ).slice(0, 500),

        language:
          String(
            body.language || ""
          ).slice(0, 50),

        category:
          String(
            body.category || ""
          ).slice(0, 100),

        duration:
          Math.max(
            0,
            Number(
              body.duration || 0
            )
          ),

        watchSeconds:
          Math.max(
            0,
            Number(
              body.watchSeconds || 0
            )
          ),

        completion:
          Math.min(
            1,
            Math.max(
              0,
              Number(
                body.completion || 0
              )
            )
          ),

        completed:
          Boolean(
            body.completed
          ),

        skipped:
          Boolean(
            body.skipped
          ),

        liked:
          Boolean(
            body.liked
          ),

        saved:
          Boolean(
            body.saved
          ),

        source:
          String(
            body.source || "peertube"
          ).slice(0, 30),

        createdAt:
          new Date().toISOString()
      };

      const events =
        readWatchEvents();

      events.push(event);

      /*
       * JSON file बहुत बड़ा न हो।
       * सबसे पुराने events हटाकर
       * आखिरी 50,000 events रखें।
       */
      const MAX_EVENTS = 50000;

      const trimmed =
        events.length > MAX_EVENTS
          ? events.slice(
              events.length - MAX_EVENTS
            )
          : events;

      if (!saveWatchEvents(trimmed)) {

        return res.status(500).json({
          success: false,
          message:
            "Watch event save नहीं हो पाया।"
        });

      }

      res.json({
        success: true
      });

    } catch (error) {

      console.error(
        "WATCH EVENT ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Watch tracking error"
      });

    }

  }
);


// =========================================
// VIDEOAPNA PEERTUBE SEARCH
// =========================================
app.get("/api/peertube-search", async (req, res) => {
  try {
    const query =
      String(req.query.q || "videos").trim() || "videos";

    const https = require("https");

    const originalQuery = query;
    const normalizedQuery = query.toLowerCase();

    const isHome =
      normalizedQuery === "videos";

    const isShorts =
      normalizedQuery.includes("shorts");

    const start = Math.max(
      0,
      parseInt(req.query.start || "0", 10) || 0
    );

    const count =
      (isHome || isShorts) ? 20 : 10;

    // =====================================================
    // VIDEOAPNA HINDI MULTI SEARCH
    // =====================================================

    const hindiWords = [
      "हिंदी",
      "हिन्दी",
      "hindi",
      "भजन",
      "bhajan",
      "आरती",
      "aarti",
      "arti",
      "भक्ति",
      "bhakti",
      "सॉन्ग",
      "song",
      "गीत",
      "geet",
      "शायरी",
      "shayari",
      "नर्सरी",
      "nursery",
      "बच्चे",
      "बच्चों",
      "kids",
      "मोटिवेशन",
      "motivation",
      "न्यूज़",
      "न्यूज",
      "news",
      "हनुमान",
      "hanuman",
      "चालीसा",
      "chalisa",
      "राम",
      "ram",
      "कृष्ण",
      "krishna",
      "महादेव",
      "mahadev",
      "शिव",
      "shiv"
    ];

    const wantsHindi =
      hindiWords.some(word =>
        normalizedQuery.includes(word.toLowerCase())
      ) ||
      /[\u0900-\u097F]/.test(originalQuery);

    function getSearchQueries(text) {
      const q = String(text || "").trim();

      const lower = q.toLowerCase();

      if (
        lower.includes("हनुमान") ||
        lower.includes("hanuman") ||
        lower.includes("चालीसा") ||
        lower.includes("chalisa")
      ) {
        return [
          "Hanuman Chalisa",
          "Hanuman Chalisa Hindi",
          "Hanuman bhajan Hindi",
          "Hanuman Hindi",
          "Chalisa Hindi"
        ];
      }

      if (
        lower.includes("भजन") ||
        lower.includes("bhajan")
      ) {
        return [
          "bhajan Hindi",
          "Hindi bhajan",
          "bhajan",
          "Hindi devotional",
          "devotional Hindi"
        ];
      }

      if (
        lower.includes("आरती") ||
        lower.includes("aarti") ||
        lower.includes("arti")
      ) {
        return [
          "aarti Hindi",
          "Hindi aarti",
          "aarti",
          "Hindi devotional",
          "devotional Hindi"
        ];
      }

      if (
        lower.includes("भक्ति") ||
        lower.includes("bhakti")
      ) {
        return [
          "bhakti Hindi",
          "Hindi bhakti song",
          "bhakti song Hindi",
          "Hindi devotional song",
          "bhajan Hindi"
        ];
      }

      if (
        lower.includes("सॉन्ग") ||
        lower.includes("song")
      ) {
        return [
          "Hindi song",
          "Hindi songs",
          "Hindi music",
          "Hindi geet"
        ];
      }

      if (
        lower.includes("नर्सरी") ||
        lower.includes("nursery")
      ) {
        return [
          "Hindi nursery",
          "Hindi kids",
          "Hindi children",
          "Hindi rhymes"
        ];
      }

      if (
        lower.includes("मोटिवेशन") ||
        lower.includes("motivation")
      ) {
        return [
          "Hindi motivation",
          "Hindi motivational",
          "motivation Hindi"
        ];
      }

      if (
        lower.includes("शायरी") ||
        lower.includes("shayari")
      ) {
        return [
          "Hindi shayari",
          "shayari Hindi"
        ];
      }

      if (
        lower.includes("न्यूज़") ||
        lower.includes("न्यूज") ||
        lower.includes("news")
      ) {
        return [
          "Hindi news",
          "Hindi news India",
          "news Hindi"
        ];
      }

      if (wantsHindi) {
        return [
          q,
          q + " Hindi",
          "Hindi " + q
        ];
      }

      return [q];
    }

    const searchQueries =
      isHome
        ? ["hindi"]
        : isShorts
          ? [originalQuery]
          : getSearchQueries(originalQuery);

    console.log(
      "VIDEOAPNA HINDI MULTI SEARCH:",
      JSON.stringify(originalQuery),
      "=>",
      JSON.stringify(searchQueries)
    );

    function fetchSearch(searchTerm) {
      return new Promise(resolve => {

        let searchUrl =
          "https://sepiasearch.org/api/v1/search/videos" +
          "?search=" +
          encodeURIComponent(searchTerm) +
          "&start=" +
          start +
          "&count=" +
          count +
          "&nsfw=false" +
          "&sort=-publishedAt";

        // Hindi search में actual Hindi language को प्राथमिकता दें।
        if (wantsHindi && !isHome && !isShorts) {
          searchUrl += "&languageOneOf=hi";
        }

        https.get(searchUrl, searchRes => {

          let data = "";

          searchRes.on("data", chunk => {
            data += chunk;
          });

          searchRes.on("end", () => {

            try {
              const json = JSON.parse(data);

              resolve({
                success: true,
                term: searchTerm,
                total: Number(json.total || 0),
                data: Array.isArray(json.data)
                  ? json.data
                  : []
              });

            } catch (e) {

              console.error(
                "PEERTUBE MULTI SEARCH PARSE ERROR:",
                searchTerm,
                e.message
              );

              resolve({
                success: false,
                term: searchTerm,
                total: 0,
                data: []
              });
            }

          });

        }).on("error", err => {

          console.error(
            "PEERTUBE MULTI SEARCH ERROR:",
            searchTerm,
            err.message
          );

          resolve({
            success: false,
            term: searchTerm,
            total: 0,
            data: []
          });

        });

      });
    }

    // =====================================================
    // पहले Hindi-only searches
    // अगर बहुत कम Hindi मिले तो limited broader fallback
    // =====================================================

    let searchResults =
      await Promise.all(
        searchQueries.slice(0, 5).map(fetchSearch)
      );

    let rawVideos = [];

    for (const result of searchResults) {
      rawVideos.push(...result.data);
    }

    // Hindi-only searches से पर्याप्त परिणाम न मिलने पर
    // broader searches करें, लेकिन Hindi को ऊपर रखें।
    if (
      !isHome &&
      !isShorts &&
      wantsHindi &&
      rawVideos.filter(v =>
        v &&
        v.language?.id === "hi"
      ).length < 6
    ) {

      const fallbackQueries =
        getSearchQueries(originalQuery)
          .slice(0, 3);

      const fallbackResults =
        await Promise.all(
          fallbackQueries.map(searchTerm => {

            return new Promise(resolve => {

              const url =
                "https://sepiasearch.org/api/v1/search/videos" +
                "?search=" +
                encodeURIComponent(searchTerm) +
                "&start=" +
                start +
                "&count=" +
                count +
                "&nsfw=false" +
                "&sort=-publishedAt";

              https.get(url, fallbackRes => {

                let data = "";

                fallbackRes.on("data", chunk => {
                  data += chunk;
                });

                fallbackRes.on("end", () => {

                  try {
                    const json = JSON.parse(data);

                    resolve(
                      Array.isArray(json.data)
                        ? json.data
                        : []
                    );

                  } catch (e) {
                    resolve([]);
                  }

                });

              }).on("error", () => {
                resolve([]);
              });

            });

          })
        );

      for (const list of fallbackResults) {
        rawVideos.push(...list);
      }
    }

    // =====================================================
    // DEDUPE
    // =====================================================

    const uniqueMap = new Map();

    for (const v of rawVideos) {

      if (
        !v ||
        !v.uuid ||
        v.nsfw === true
      ) {
        continue;
      }

      if (!uniqueMap.has(v.uuid)) {
        uniqueMap.set(v.uuid, v);
      }
    }

    let sourceVideos =
      Array.from(uniqueMap.values());

    // =====================================================
    // RELEVANCE + LANGUAGE RANKING
    // =====================================================

    const queryWords =
      normalizedQuery
        .split(/\s+/)
        .filter(word => word.length >= 2);

    function scoreVideo(v) {

      const title =
        String(v.name || "").toLowerCase();

      const description =
        String(v.description || "").toLowerCase();

      const text =
        title + " " + description;

      const language =
        String(v.language?.id || "").toLowerCase();

      let score = 0;

      // असली Hindi language
      if (language === "hi") {
        score += 1000;
      }

      // Hindi title/content
      if (/[\u0900-\u097F]/.test(title)) {
        score += 150;
      }

      // Search शब्द title में
      for (const word of queryWords) {
        if (title.includes(word)) {
          score += 120;
        }

        if (text.includes(word)) {
          score += 35;
        }
      }

      // Hindi keyword bonus
      if (
        text.includes("hindi") ||
        /[\u0900-\u097F]/.test(text)
      ) {
        score += 80;
      }

      // Exact topic keywords
      const topicWords = [
        "hanuman",
        "chalisa",
        "bhajan",
        "aarti",
        "bhakti",
        "devotional",
        "song",
        "nursery",
        "kids",
        "motivation",
        "shayari",
        "news"
      ];

      for (const word of topicWords) {
        if (normalizedQuery.includes(word)) {
          if (title.includes(word)) {
            score += 180;
          }

          if (text.includes(word)) {
            score += 50;
          }
        }
      }

      // नया content थोड़ा ऊपर
      const date =
        new Date(
          v.publishedAt ||
          v.createdAt ||
          0
        ).getTime();

      if (Number.isFinite(date) && date > 0) {
        const age =
          Date.now() - date;

        if (age <= 24 * 60 * 60 * 1000) {
          score += 50;
        } else if (
          age <= 7 * 24 * 60 * 60 * 1000
        ) {
          score += 25;
        }
      }

      return score;
    }

    sourceVideos.sort((a, b) =>
      scoreVideo(b) - scoreVideo(a)
    );

    // =====================================================
    // MODERATION FILTER
    // =====================================================

    const moderationReports =
      readVideoReports();

    const hiddenPeerTubeIds =
      new Set(
        moderationReports
          .filter(report => {

            const action =
              String(
                report.action || ""
              ).toLowerCase();

            return (
              action ===
                "private_on_videoapna" ||
              action ===
                "hide_from_videoapna"
            );
          })
          .map(report =>
            String(
              report.videoId || ""
            )
              .replace(/^pt-/, "")
              .trim()
          )
          .filter(Boolean)
      );

    sourceVideos =
      sourceVideos.filter(video => {

        const peerTubeId =
          String(video.id || "").trim();

        return !hiddenPeerTubeIds.has(
          peerTubeId
        );
      });

    // =====================================================
    // NORMALIZE
    // =====================================================

    const baseVideos =
      sourceVideos.map(v => ({

        id: v.id,
        uuid: v.uuid,
        shortUUID: v.shortUUID,

        title:
          v.name ||
          "PeerTube Video",

        description:
          v.description || "",

        channelTitle:
          v.channel?.displayName ||
          v.account?.displayName ||
          "PeerTube",

        thumbnail:
          v.thumbnailUrl ||
          v.previewUrl ||
          "",

        duration:
          Number(v.duration || 0),

        aspectRatio:
          v.aspectRatio || null,

        language:
          v.language?.id ||
          v.language?.label ||
          "",

        category:
          v.category?.label ||
          v.category?.name ||
          "",

        publishedAt:
          v.publishedAt ||
          v.createdAt ||
          "",

        embedUrl:
          v.embedUrl || "",

        source:
          "peertube",

        sourceHost:
          v.account?.host ||
          v.channel?.host ||
          ""
      }));

    console.log(
      "VIDEOAPNA PEERTUBE SEARCH RESULTS:",
      originalQuery,
      "| Hindi:",
      baseVideos.filter(v => v.language === "hi").length,
      "| Total:",
      baseVideos.length
    );

    // =====================================================
    // DETAIL FETCH + PLAYABLE VIDEO
    // =====================================================

    const detailPromises =
      baseVideos.map(video => {

        return new Promise(resolve => {

          let host =
            video.sourceHost;

          if (
            !host &&
            video.embedUrl
          ) {
            try {
              host =
                new URL(
                  video.embedUrl
                ).hostname;
            } catch (e) {}
          }

          if (!host) {
            resolve(video);
            return;
          }

          const detailUrl =
            "https://" +
            host +
            "/api/v1/videos/" +
            encodeURIComponent(
              video.uuid
            );

          https.get(
            detailUrl,
            detailRes => {

              let detailData = "";

              detailRes.on(
                "data",
                chunk => {
                  detailData += chunk;
                }
              );

              detailRes.on(
                "end",
                () => {

                  try {

                    const detail =
                      JSON.parse(
                        detailData
                      );

                    let files = [];

                    for (
                      const playlist of
                      (
                        detail.streamingPlaylists ||
                        []
                      )
                    ) {

                      if (
                        Array.isArray(
                          playlist.files
                        )
                      ) {
                        files.push(
                          ...playlist.files
                        );
                      }
                    }

                    files =
                      files.filter(file =>
                        file &&
                        typeof file.fileUrl ===
                          "string" &&
                        file.fileUrl.length > 0
                      );

                    const uniqueFiles = [];
                    const seenUrls = new Set();

                    for (
                      const file of files
                    ) {

                      if (
                        seenUrls.has(
                          file.fileUrl
                        )
                      ) {
                        continue;
                      }

                      seenUrls.add(
                        file.fileUrl
                      );

                      uniqueFiles.push(
                        file
                      );
                    }

                    files =
                      uniqueFiles;

                    const preferred = [
                      720,
                      480,
                      360,
                      240,
                      144
                    ];

                    let selected = null;

                    for (
                      const height of
                      preferred
                    ) {

                      selected =
                        files.find(
                          file =>
                            Number(
                              file?.resolution?.id
                            ) === height
                        );

                      if (selected) {
                        break;
                      }
                    }

                    if (
                      !selected &&
                      files.length > 0
                    ) {

                      selected =
                        files.find(
                          file =>
                            Number(
                              file?.resolution?.id ||
                              0
                            ) > 0
                        ) ||
                        files[0];
                    }

                    video.videoUrl =
                      selected?.fileUrl ||
                      "";

                    video.videoResolution =
                      selected?.resolution?.label ||
                      String(
                        selected?.resolution?.id ||
                        ""
                      );

                    if (!video.thumbnail) {

                      video.thumbnail =
                        detail.thumbnails?.find(
                          t => t.fileUrl
                        )?.fileUrl ||
                        "";
                    }

                  } catch (e) {

                    console.error(
                      "PEERTUBE DETAIL PARSE ERROR:",
                      video.uuid,
                      e.message
                    );
                  }

                  resolve(video);
                }
              );

            }
          ).on("error", err => {

            console.error(
              "PEERTUBE DETAIL ERROR:",
              video.uuid,
              "| host:",
              host,
              "|",
              err.message
            );

            resolve(video);
          });

        });
      });

    const videos =
      await Promise.all(
        detailPromises
      );

    const playable =
      videos.filter(
        video => video.videoUrl
      );

    console.log(
      "PEERTUBE SEARCH:",
      originalQuery,
      "| Home:",
      isHome,
      "| Found:",
      videos.length,
      "| Playable:",
      playable.length
    );

    res.json({

      success: true,

      videos:
        playable,

      total:
        playable.length,

      start,

      count
    });

  } catch (e) {

    console.error(
      "PEERTUBE ROUTE ERROR:",
      e
    );

    res.status(500).json({

      success: false,

      message:
        "PeerTube search process नहीं हो पाया।"
    });
  }
});


// =====================================================
// VIDEOAPNA ODYSEE SEARCH
// Hindi-first Odysee search
// =====================================================

app.get("/api/odysee-search", async (req, res) => {

  console.log("===== VIDEOAPNA ODYSEE CALLER =====");
  console.log("URL:", req.originalUrl);
  console.log("IP:", req.ip);
  console.log("X-Forwarded-For:", req.headers["x-forwarded-for"] || "");
  console.log("User-Agent:", req.headers["user-agent"] || "");
  console.log("Referer:", req.headers["referer"] || "");
  console.log("Origin:", req.headers["origin"] || "");
  console.log("===================================");

  try {
    const originalQuery = String(req.query.q || "").trim();
    const startIndex = Math.max(
      0,
      parseInt(req.query.start || "0", 10) || 0
    );
    const count = 50;

    if (!originalQuery) {
      return res.json({
        success: true,
        videos: [],
        total: 0,
        start: startIndex,
        count
      });
    }

    const explicitEnglish =
      /\benglish\b/i.test(originalQuery) ||
      /अंग्रेजी|इंग्लिश/.test(originalQuery);

    const hindiIntent = !explicitEnglish;

    const searchText =
      hindiIntent
        ? (
            /[\u0900-\u097F]/.test(originalQuery)
              ? originalQuery
              : originalQuery + " Hindi"
          )
        : originalQuery;

    const lighthouseUrl =
      "https://lighthouse.odysee.tv/search?" +
      new URLSearchParams({
        s: searchText,
        size: "50",
        from: String(startIndex),
        claimType: "file",
        nsfw: "false",
        free_only: "true"
      }).toString();

    console.log(
      "VIDEOAPNA ODYSEE REQUEST:",
      originalQuery,
      "| start:",
      startIndex,
      "| size: 50"
    );

    const lighthouseResponse = await fetch(lighthouseUrl);

    if (!lighthouseResponse.ok) {
      throw new Error(
        "Odysee Lighthouse HTTP " + lighthouseResponse.status
      );
    }

    const lighthouseClaims = await lighthouseResponse.json();

    const claims = Array.isArray(lighthouseClaims)
      ? lighthouseClaims
      : [];

    if (!claims.length) {
      console.log(
        "VIDEOAPNA ODYSEE SEARCH:",
        originalQuery,
        "| Hindi:",
        hindiIntent,
        "| Results: 0"
      );

      return res.json({
        success: true,
        videos: [],
        total: 0,
        start: startIndex,
        count
      });
    }

    function odyseeRequest(method, params) {
      return new Promise((resolve, reject) => {
        const body = JSON.stringify({
          jsonrpc: "2.0",
          method,
          params
        });

        const request = require("https").request(
          "https://api.na-backend.odysee.com/api/v1/proxy",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(body)
            }
          },
          response => {
            let data = "";

            response.on("data", chunk => {
              data += chunk;
            });

            response.on("end", () => {
              try {
                resolve(JSON.parse(data));
              } catch (error) {
                reject(error);
              }
            });
          }
        );

        request.on("error", reject);
        request.write(body);
        request.end();
      });
    }

    const claimIds = claims
      .map(item => String(item.claimId || ""))
      .filter(Boolean);

    if (!claimIds.length) {
      return res.json({
        success: true,
        videos: [],
        total: 0,
        start: startIndex,
        count
      });
    }

    const metadataResponse = await odyseeRequest(
      "claim_search",
      {
        claim_ids: claimIds
      }
    );

    const items =
      metadataResponse?.result?.items || [];

    const hindiRegex = /[\u0900-\u097F]/;

    const hindiWords = [
      "hindi",
      "हिंदी",
      "हिन्दी",
      "bhajan",
      "भजन",
      "song",
      "songs",
      "गीत",
      "geet",
      "aarti",
      "arti",
      "आरती",
      "bhakti",
      "भक्ति",
      "story",
      "stories",
      "कहानी",
      "कथा",
      "motivation",
      "मोटिवेशन",
      "shayari",
      "शायरी",
      "news",
      "न्यूज़",
      "न्यूज",
      "comedy",
      "कॉमेडी",
      "chalisa",
      "चालीसा",
      "krishna",
      "कृष्ण",
      "ram",
      "राम",
      "shiv",
      "शिव",
      "hanuman",
      "हनुमान"
    ];

    function isHindiVideo(item) {
      const value = item?.value || {};

      const title = String(value.title || "");
      const description = String(value.description || "");

      const tags = Array.isArray(value.tags)
        ? value.tags.join(" ")
        : "";

      const text = (
        title + " " +
        description + " " +
        tags
      ).toLowerCase();

      return (
        hindiRegex.test(
          title + " " + description + " " + tags
        ) ||
        hindiWords.some(word =>
          text.includes(word.toLowerCase())
        )
      );
    }

    let usableItems = items.filter(item =>
      item?.value?.stream_type === "video"
    );

    if (hindiIntent) {
      usableItems = usableItems.filter(isHindiVideo);
    }

    const videos = usableItems
      .slice(0, count)
      .map(item => {
        const value = item.value || {};

        const canonicalUrl = String(
          item.canonical_url ||
          item.permanent_url ||
          ""
        );

        let embedUrl = "";

        if (canonicalUrl) {
          const lbryPath =
            canonicalUrl.replace(/^lbry:\/\//, "");

          const slashIndex =
            lbryPath.indexOf("/");

          if (slashIndex > 0) {
            const channelPart =
              lbryPath.slice(0, slashIndex);

            const claimPart =
              lbryPath.slice(slashIndex + 1);

            const channelFixed =
              channelPart.replace(/#/g, ":");

            const hashIndex =
              claimPart.lastIndexOf("#");

            if (hashIndex > 0) {
              const namePart =
                claimPart.slice(0, hashIndex);

              const claimNumber =
                claimPart.slice(hashIndex + 1);

              embedUrl =
                "https://odysee.com/$/embed/" +
                channelFixed +
                "/" +
                encodeURIComponent(namePart).replace(/%2F/g, "/") +
                ":" +
                encodeURIComponent(claimNumber);
            }
          }
        }

        const thumbnail =
          value?.thumbnail?.url ||
          "";

        const channel =
          item?.signing_channel?.value?.title ||
          item?.signing_channel?.name ||
          "Odysee";

        const viewCount =
          Number(value?.stats?.view_count || 0);

        return {
          id: "odysee-" + item.claim_id,
          odyseeId: item.claim_id || "",
          title: value.title || item.name || "Odysee Video",
          description: value.description || "",
          channel,
          thumbnail,
          url: canonicalUrl,
          watchUrl: canonicalUrl,
          embedUrl,
          videoUrl: "",
          views: viewCount + " views",
          viewCount,
          likes: 0,
          category: "Odysee",
          language: hindiIntent ? "hi" : "",
          duration: Number(value?.video?.duration || 0),
          publishedAt:
            value.release_time
              ? String(value.release_time)
              : "",
          source: "odysee",
          sourceHost: "odysee.com"
        };
      })
      .filter(video => video.embedUrl);

    console.log(
      "VIDEOAPNA ODYSEE SEARCH:",
      originalQuery,
      "| Hindi:",
      hindiIntent,
      "| Results:",
      videos.length
    );

    res.json({
      success: true,
      videos,
      total: videos.length,
      start: startIndex,
      count
    });

  } catch (error) {
    console.error(
      "ODYSEE SEARCH ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Odysee search process नहीं हो पाया: " +
        String(error?.message || error),
      videos: [],
      total: 0
    });
  }
});

app.get("/api/youtube-search", (req, res) => {
  try {
    const query = String(req.query.q || "").trim();

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Search शब्द डालें।"
      });
    }

    const key = process.env.YOUTUBE_API_KEY;

    if (!key) {
      return res.status(500).json({
        success: false,
        message: "YouTube API key configured नहीं है।"
      });
    }

    const https = require("https");

    // पहले Search API से वीडियो IDs निकालें
    const searchUrl =
      "https://www.googleapis.com/youtube/v3/search" +
      "?part=snippet" +
      "&q=" + encodeURIComponent(query) +
      "&type=video" +
      "&maxResults=10" +
      "&key=" + encodeURIComponent(key);

    https.get(searchUrl, searchRes => {
      let data = "";

      searchRes.on("data", chunk => {
        data += chunk;
      });

      searchRes.on("end", () => {
        try {
          const json = JSON.parse(data);

          if (json.error) {
            console.error("YOUTUBE SEARCH API ERROR:", json.error);

            return res.status(502).json({
              success: false,
              message: json.error.message || "YouTube API error"
            });
          }

          const items = json.items || [];

          if (!items.length) {
            return res.json({
              success: true,
              videos: []
            });
          }

          const ids = items
            .map(item => item.id && item.id.videoId)
            .filter(Boolean);

          if (!ids.length) {
            return res.json({
              success: true,
              videos: []
            });
          }

          // अब केवल embeddable videos चेक करें
          const statusUrl =
            "https://www.googleapis.com/youtube/v3/videos" +
            "?part=status" +
            "&id=" + encodeURIComponent(ids.join(",")) +
            "&key=" + encodeURIComponent(key);

          https.get(statusUrl, statusRes => {
            let statusData = "";

            statusRes.on("data", chunk => {
              statusData += chunk;
            });

            statusRes.on("end", () => {
              try {
                const statusJson = JSON.parse(statusData);

                if (statusJson.error) {
                  console.error(
                    "YOUTUBE STATUS API ERROR:",
                    statusJson.error
                  );

                  return res.status(502).json({
                    success: false,
                    message:
                      statusJson.error.message ||
                      "YouTube video status error"
                  });
                }

                const embeddableIds = new Set(
                  (statusJson.items || [])
                    .filter(item =>
                      item.status &&
                      item.status.embeddable === true
                    )
                    .map(item => item.id)
                );

                const videos = items
                  .filter(item =>
                    item.id &&
                    item.id.videoId &&
                    embeddableIds.has(item.id.videoId)
                  )
                  .map(item => ({
                    videoId: item.id.videoId,
                    title: item.snippet.title,
                    description: item.snippet.description,
                    channelTitle: item.snippet.channelTitle,
                    thumbnail:
                      item.snippet.thumbnails?.high?.url ||
                      item.snippet.thumbnails?.medium?.url ||
                      item.snippet.thumbnails?.default?.url
                  }));

                console.log(
                  "YOUTUBE SEARCH:",
                  query,
                  "| Found:",
                  items.length,
                  "| Embeddable:",
                  videos.length
                );

                res.json({
                  success: true,
                  videos
                });

              } catch (error) {
                console.error(
                  "YOUTUBE STATUS RESPONSE ERROR:",
                  error
                );

                res.status(502).json({
                  success: false,
                  message: "YouTube status response समझ नहीं आया।"
                });
              }
            });

          }).on("error", error => {
            console.error(
              "YOUTUBE STATUS NETWORK ERROR:",
              error
            );

            res.status(502).json({
              success: false,
              message: "YouTube status request failed।"
            });
          });

        } catch (error) {
          console.error(
            "YOUTUBE SEARCH RESPONSE ERROR:",
            error
          );

          res.status(502).json({
            success: false,
            message: "YouTube response समझ नहीं आया।"
          });
        }
      });

    }).on("error", error => {
      console.error(
        "YOUTUBE SEARCH NETWORK ERROR:",
        error
      );

      res.status(502).json({
        success: false,
        message: "YouTube search request failed।"
      });
    });

  } catch (error) {
    console.error("YOUTUBE SEARCH SERVER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "YouTube search में server error आया।"
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("================================");
  console.log("      VIDEOAPNA SERVER");
  console.log("================================");
  console.log("Local: http://127.0.0.1:" + PORT);
  console.log("Upload: /api/upload");
  console.log("================================");
  console.log("");
});
