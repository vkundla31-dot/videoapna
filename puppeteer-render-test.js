const puppeteer = require("puppeteer");
const fs = require("fs");
const http = require("http");

const chromePath =
  process.env.PUPPETEER_EXECUTABLE_PATH || "";

const VIDEO_IDS = [
  "kgBvRi0Dc2o"
];


async function checkYouTubeEmbedPlayable(browser, videoId) {
  const id = String(videoId || "").trim();

  if (!id) {
    return {
      playable: false,
      reason: "missing_video_id"
    };
  }

  const page = await browser.newPage();

  try {
    await page.setViewport({
      width: 1280,
      height: 720
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
        "error 163"
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

    if (result.blocked) {
      return {
        playable: false,
        reason: result.reason,
        text: result.text
      };
    }

    return {
      playable: true,
      reason: "",
      text: result.text
    };

  } catch (error) {
    return {
      playable: false,
      reason: "puppeteer_error",
      error: String(error && error.message || error)
    };

  } finally {
    try {
      await page.close();
    } catch (e) {}
  }
}

(async () => {
  console.log("VIDEOAPNA YOUTUBE PLAYER TEST");
  console.log("Puppeteer:", puppeteer.version);
  console.log("Chrome path:", chromePath);
  console.log(
    "Chrome exists:",
    chromePath ? fs.existsSync(chromePath) : false
  );
  const VIDEO_ID = VIDEO_IDS[0];
  console.log("Testing YouTube video:", VIDEO_ID);

  let browser;

  try {
    browser = await puppeteer.launch({
      ...(chromePath ? { executablePath: chromePath } : {}),
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage"
      ]
    });

    console.log("RUNNING REUSABLE YOUTUBE CHECKER...");

    for (const videoId of VIDEO_IDS) {
      console.log("");
      console.log("========================================");
      console.log("CHECKING VIDEO:", videoId);
      console.log("========================================");

      const result =
        await checkYouTubeEmbedPlayable(
          browser,
          videoId
        );

      console.log(
        "CHECK RESULT:",
        JSON.stringify(result)
      );
    }

    await browser.close();

    console.log("YOUTUBE PLAYER TEST FINISHED");

    const port = Number(process.env.PORT || 10000);

    http.createServer(function(req, res) {
      res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      res.end("VideoApna YouTube player test is running.\n");
    }).listen(port, "0.0.0.0", function() {
      console.log("TEST SERVER LISTENING:", port);
    });

  } catch (error) {
    console.error("YOUTUBE PLAYER TEST FAILED");
    console.error(error);

    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }

    process.exitCode = 1;
  }
})();
