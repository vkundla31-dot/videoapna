const puppeteer = require("puppeteer");
const fs = require("fs");
const http = require("http");
const path = require("path");

let chromePath = "";

function findChromeExecutable() {
  const chromeRoot =
    "/opt/render/.cache/puppeteer/chrome";

  try {
    const versions =
      fs.readdirSync(chromeRoot, {
        withFileTypes: true
      })
      .filter(entry => entry.isDirectory())
      .sort()
      .reverse();

    for (const version of versions) {
      const candidate =
        path.join(
          chromeRoot,
          version.name,
          "chrome-linux64",
          "chrome"
        );

      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  } catch (error) {
    console.warn(
      "Render Chrome cache lookup failed:",
      error.message
    );
  }

  return "";
}

chromePath = findChromeExecutable();

const PLAYABILITY_CACHE_FILE =
  path.join(
    __dirname,
    "data",
    "youtube-playability-test-cache-v2.json"
  );

let playabilityCache = {};

try {
  if (fs.existsSync(PLAYABILITY_CACHE_FILE)) {
    const text = fs.readFileSync(
      PLAYABILITY_CACHE_FILE,
      "utf8"
    );

    const parsed = JSON.parse(text);

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      playabilityCache = parsed;
    }
  }
} catch (error) {
  console.warn(
    "PLAYABILITY CACHE LOAD FAILED:",
    error.message
  );
}

function savePlayabilityCache() {
  try {
    fs.mkdirSync(
      path.dirname(PLAYABILITY_CACHE_FILE),
      { recursive: true }
    );

    fs.writeFileSync(
      PLAYABILITY_CACHE_FILE,
      JSON.stringify(playabilityCache, null, 2),
      "utf8"
    );

    console.log("✅ PLAYABILITY CACHE SAVED");
  } catch (error) {
    console.warn(
      "PLAYABILITY CACHE SAVE FAILED:",
      error.message
    );
  }
}

async function checkYouTubeEmbedPlayable(browser, videoId) {
  const id = String(videoId || "").trim();

  if (!id) {
    return {
      playable: false,
      reason: "missing_video_id"
    };
  }

  const cached = playabilityCache[id];

  if (cached) {
    console.log("♻️ CACHE HIT:", id);

    return cached;
  }

  console.log("🌐 CACHE MISS:", id);

  const page = await browser.newPage();

  try {
    await page.setViewport({
      width: 1280,
      height: 720
    });

    await page.setExtraHTTPHeaders({
      "Referer": "https://videoapna-puppeteer-test.onrender.com/"
    });

    const embedUrl =
      "https://www.youtube.com/embed/" +
      encodeURIComponent(id) +
      "?autoplay=1&mute=1&playsinline=1";

    await page.goto(embedUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    await new Promise(function(resolve) {
      setTimeout(resolve, 8000);
    });

    const result = await page.evaluate(function() {
      const text =
        String(document.body?.innerText || "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();

      const blockedPatterns = [
        "watch video on youtube",
        "watch on youtube",
        "youtube पर देखें",
        "youtube पर जाने के लिए क्लिक करें",
        "video unavailable",
        "this video is unavailable",
        "यह वीडियो उपलब्ध नहीं है",
        "error 153",
        "error 163",
        "sign in to confirm you’re not a bot",
        "sign in to confirm you're not a bot",
        "this helps protect our community"
      ];

      const blockedPattern =
        blockedPatterns.find(function(pattern) {
          return text.includes(pattern);
        }) || "";

      return {
        blocked: Boolean(blockedPattern),
        reason: blockedPattern,
        text: text.slice(0, 5000)
      };
    });

    const temporaryPatterns = [
      "sign in to confirm you’re not a bot",
      "sign in to confirm you're not a bot",
      "this helps protect our community"
    ];

    const isTemporaryBlock =
      temporaryPatterns.some(function(pattern) {
        return result.text.includes(pattern);
      });

    const finalResult = result.blocked
      ? {
          playable: false,
          reason: result.reason,
          text: result.text,
          temporary: isTemporaryBlock
        }
      : {
          playable: true,
          reason: "",
          text: result.text,
          temporary: false
        };

    /*
     * Bot-wall / temporary YouTube verification को cache में
     * permanent result की तरह नहीं रखना है।
     *
     * अगली server request पर video फिर से check हो सकेगा।
     */
    if (!isTemporaryBlock) {
      playabilityCache[id] = {
        ...finalResult,
        checkedAt: new Date().toISOString()
      };

      savePlayabilityCache();
    } else {
      console.warn(
        "⏭️ TEMPORARY YOUTUBE BOT-WALL - NOT CACHED:",
        id
      );
    }

    return {
      ...finalResult,
      checkedAt: new Date().toISOString()
    };

  } catch (error) {
    const result = {
      playable: false,
      reason: "puppeteer_error",
      error: String(
        error && error.message || error
      ),
      checkedAt: new Date().toISOString()
    };

    /*
     * Browser/network/Puppeteer error को permanent cache में
     * मत रखो। यह video की वास्तविक embedding failure साबित नहीं करता।
     */
    console.warn(
      "⏭️ PUPPETEER ERROR - NOT CACHED:",
      id
    );

    return result;

  } finally {
    try {
      await page.close();
    } catch (e) {}
  }
}

let browser = null;
let browserStarting = null;

async function getBrowser() {
  if (browser) {
    try {
      const pages = await browser.pages();

      if (Array.isArray(pages)) {
        return browser;
      }
    } catch (error) {
      browser = null;
    }
  }

  if (browserStarting) {
    return browserStarting;
  }

  try {
    if (
      chromePath &&
      typeof chromePath.then === "function"
    ) {
      chromePath = await chromePath;
    }
  } catch (error) {
    console.warn(
      "Puppeteer executable path await failed:",
      error.message
    );
    chromePath = "";
  }

  browserStarting = puppeteer.launch({
    headless: true,
    timeout: 15000,
    protocolTimeout: 30000,
    ...(chromePath ? { executablePath: chromePath } : {}),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ]
  });

  try {
    browser = await browserStarting;
    return browser;
  } finally {
    browserStarting = null;
  }
}

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body)
  });

  res.end(body);
}

async function handleCheck(req, res, url) {
  const videoId =
    String(
      url.searchParams.get("videoId") || ""
    ).trim();

  if (!videoId) {
    return sendJson(res, 400, {
      success: false,
      playable: false,
      reason: "missing_video_id"
    });
  }

  if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) {
    return sendJson(res, 400, {
      success: false,
      playable: false,
      reason: "invalid_video_id"
    });
  }

  try {
    console.log("");
    console.log("========================================");
    console.log("API CHECKING VIDEO:", videoId);
    console.log("========================================");

    const activeBrowser =
      await getBrowser();

    const result =
      await checkYouTubeEmbedPlayable(
        activeBrowser,
        videoId
      );

    console.log(
      "API CHECK RESULT:",
      JSON.stringify(result)
    );

    return sendJson(res, 200, {
      success: true,
      videoId,
      playable: Boolean(result.playable),
      reason: result.reason || "",
      checkedAt: result.checkedAt || "",
      text: result.text || ""
    });

  } catch (error) {
    console.error(
      "API CHECK FAILED:",
      error
    );

    return sendJson(res, 500, {
      success: false,
      videoId,
      playable: false,
      reason: "checker_error",
      error: String(
        error && error.message || error
      )
    });
  }
}

const port =
  Number(process.env.PORT || 10000);

const server =
  http.createServer(
    async function(req, res) {
      try {
        const url =
          new URL(
            req.url || "/",
            "http://" +
              (req.headers.host ||
               "localhost")
          );

        if (url.pathname === "/") {
          return sendJson(res, 200, {
            success: true,
            service:
              "VideoApna YouTube Playability Checker",
            status: "running"
          });
        }

        if (url.pathname === "/health") {
          return sendJson(res, 200, {
            success: true,
            status: "healthy"
          });
        }

        if (url.pathname === "/check") {
          return await handleCheck(
            req,
            res,
            url
          );
        }

        return sendJson(res, 404, {
          success: false,
          message: "Not found"
        });

      } catch (error) {
        console.error(
          "HTTP SERVER ERROR:",
          error
        );

        return sendJson(res, 500, {
          success: false,
          message: "Internal server error"
        });
      }
    }
  );

server.listen(
  port,
  "0.0.0.0",
  async function() {
    console.log(
      "VIDEOAPNA YOUTUBE PLAYABILITY CHECKER"
    );

    console.log(
      "Chrome path:",
      chromePath || "(Puppeteer default)"
    );

    console.log(
      "Chrome exists:",
      chromePath
        ? fs.existsSync(chromePath)
        : "default"
    );

    console.log(
      "CHECKER SERVER LISTENING:",
      port
    );

    try {
      await getBrowser();

      console.log(
        "✅ PUPPETEER BROWSER READY"
      );
    } catch (error) {
      console.error(
        "❌ PUPPETEER BROWSER START FAILED:",
        error
      );
    }
  }
);

process.on(
  "SIGTERM",
  async function() {
    try {
      if (browser) {
        await browser.close();
      }
    } catch (e) {}

    server.close(function() {
      process.exit(0);
    });
  }
);

process.on(
  "SIGINT",
  async function() {
    try {
      if (browser) {
        await browser.close();
      }
    } catch (e) {}

    server.close(function() {
      process.exit(0);
    });
  }
);
