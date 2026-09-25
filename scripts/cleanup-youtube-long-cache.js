require("dotenv").config();

const fs = require("fs");
const path = require("path");
const https = require("https");

const CACHE_FILE = path.join(
  __dirname,
  "..",
  "data",
  "youtube-long-cache.json"
);

const API_KEY = String(
  process.env.YOUTUBE_API_KEY || ""
).trim();

if (!API_KEY) {
  console.error("❌ YOUTUBE_API_KEY नहीं मिला।");
  process.exit(1);
}

if (!fs.existsSync(CACHE_FILE)) {
  console.error("❌ Cache file नहीं मिला:", CACHE_FILE);
  process.exit(1);
}

const cache = JSON.parse(
  fs.readFileSync(CACHE_FILE, "utf8")
);

const ids = new Set();

for (const entry of Object.values(cache)) {
  const videos =
    Array.isArray(entry?.videos)
      ? entry.videos
      : [];

  for (const video of videos) {
    const id =
      String(video?.videoId || "").trim();

    if (id) {
      ids.add(id);
    }
  }
}

const uniqueIds = [...ids];

console.log("======================================");
console.log("YOUTUBE LONG CACHE CLEANUP");
console.log("======================================");
console.log("Unique YouTube IDs:", uniqueIds.length);
console.log(
  "Expected videos.list requests:",
  Math.ceil(uniqueIds.length / 50)
);
console.log("");

function fetchDetails(batch) {
  return new Promise((resolve, reject) => {
    const url =
      "https://www.googleapis.com/youtube/v3/videos" +
      "?part=status,contentDetails" +
      "&id=" +
      encodeURIComponent(batch.join(",")) +
      "&key=" +
      encodeURIComponent(API_KEY);

    https.get(url, res => {
      let body = "";

      res.on("data", chunk => {
        body += chunk;
      });

      res.on("end", () => {
        try {
          const json = JSON.parse(body);

          if (
            !res.statusCode ||
            res.statusCode < 200 ||
            res.statusCode >= 300
          ) {
            return reject(
              new Error(
                "YouTube API HTTP " +
                res.statusCode +
                ": " +
                (json.error?.message || body)
              )
            );
          }

          if (json.error) {
            return reject(
              new Error(
                json.error.message ||
                "YouTube API error"
              )
            );
          }

          resolve(
            Array.isArray(json.items)
              ? json.items
              : []
          );
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject);
  });
}

function isAllowedForIndia(details) {
  const restriction =
    details?.contentDetails?.regionRestriction;

  if (!restriction) {
    return true;
  }

  const blocked =
    Array.isArray(restriction.blocked)
      ? restriction.blocked
      : [];

  if (blocked.includes("IN")) {
    return false;
  }

  const allowed =
    Array.isArray(restriction.allowed)
      ? restriction.allowed
      : null;

  if (
    allowed &&
    allowed.length > 0 &&
    !allowed.includes("IN")
  ) {
    return false;
  }

  return true;
}

function getDurationSeconds(details) {
  const text = String(
    details?.contentDetails?.duration || ""
  );

  const match = text.match(
    /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/
  );

  if (!match) {
    return 0;
  }

  return (
    Number(match[1] || 0) * 3600 +
    Number(match[2] || 0) * 60 +
    Number(match[3] || 0)
  );
}

(async () => {
  const validIds = new Set();

  let processed = 0;

  for (
    let i = 0;
    i < uniqueIds.length;
    i += 50
  ) {
    const batch =
      uniqueIds.slice(i, i + 50);

    console.log(
      "🔎 Checking",
      i + 1,
      "-",
      i + batch.length,
      "of",
      uniqueIds.length
    );

    const items =
      await fetchDetails(batch);

    const returnedIds =
      new Set(
        items.map(item =>
          String(item.id || "").trim()
        )
      );

    for (const id of batch) {
      const details =
        items.find(
          item =>
            String(item.id || "").trim() === id
        );

      if (!details) {
        continue;
      }

      if (
        details.status?.embeddable !== true
      ) {
        continue;
      }

      if (
        details.status?.uploadStatus !==
        "processed"
      ) {
        continue;
      }

      if (
        details.status?.privacyStatus !==
        "public"
      ) {
        continue;
      }

      if (!isAllowedForIndia(details)) {
        continue;
      }

      const duration =
        getDurationSeconds(details);

      if (
        !Number.isFinite(duration) ||
        duration <= 90
      ) {
        continue;
      }

      if (!returnedIds.has(id)) {
        continue;
      }

      validIds.add(id);
    }

    processed += batch.length;

    console.log(
      "   Valid so far:",
      validIds.size
    );
  }

  const cleanedCache = {};

  let oldRecords = 0;
  let newRecords = 0;

  for (const [key, entry] of Object.entries(cache)) {
    const videos =
      Array.isArray(entry?.videos)
        ? entry.videos
        : [];

    oldRecords += videos.length;

    const cleanedVideos =
      videos.filter(video => {
        const id =
          String(video?.videoId || "").trim();

        return (
          id &&
          validIds.has(id)
        );
      });

    if (cleanedVideos.length > 0) {
      cleanedCache[key] = {
        ...entry,
        videos: cleanedVideos
      };

      newRecords += cleanedVideos.length;
    } else {
      cleanedCache[key] = {
        ...entry,
        videos: []
      };
    }
  }

  const tempFile =
    CACHE_FILE + ".cleanup-temp";

  fs.writeFileSync(
    tempFile,
    JSON.stringify(
      cleanedCache,
      null,
      2
    ),
    "utf8"
  );

  fs.renameSync(
    tempFile,
    CACHE_FILE
  );

  console.log("");
  console.log("======================================");
  console.log("✅ CLEANUP COMPLETE");
  console.log("======================================");
  console.log("Old cached records:", oldRecords);
  console.log("Valid records:", newRecords);
  console.log(
    "Rejected records:",
    oldRecords - newRecords
  );
  console.log(
    "Valid unique YouTube IDs:",
    validIds.size
  );
})();
