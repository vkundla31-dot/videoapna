const puppeteer = require("puppeteer");
const fs = require("fs");
const http = require("http");

const chromePath =
  process.env.PUPPETEER_EXECUTABLE_PATH || "";

const VIDEO_ID = "kgBvRi0Dc2o";


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

    const reusableResult =
      await checkYouTubeEmbedPlayable(
        browser,
        VIDEO_ID
      );

    console.log(
      "REUSABLE CHECK RESULT:",
      JSON.stringify(reusableResult)
    );

    const page = await browser.newPage();

    await page.setViewport({
      width: 1280,
      height: 720
    });

    page.on("console", msg => {
      console.log("PAGE:", msg.text());
    });

    page.on("requestfailed", request => {
      console.log(
        "REQUEST FAILED:",
        request.url(),
        "|",
        request.failure()?.errorText || ""
      );
    });

    const embedUrl =
      "https://www.youtube.com/embed/" +
      encodeURIComponent(VIDEO_ID) +
      "?autoplay=1&mute=1&playsinline=1";

    console.log("Opening:", embedUrl);

    await page.goto(embedUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    console.log("Page loaded");
    console.log("Title:", await page.title());

    await new Promise(resolve => setTimeout(resolve, 8000));

    const pageInfo = await page.evaluate(() => {
      return {
        url: location.href,
        title: document.title,
        bodyText: document.body
          ? document.body.innerText
          : "",
        htmlLength: document.documentElement
          ? document.documentElement.outerHTML.length
          : 0
      };
    });

    console.log("PLAYER URL:", pageInfo.url);
    console.log("PLAYER TITLE:", pageInfo.title);
    console.log("PLAYER HTML LENGTH:", pageInfo.htmlLength);
    const playerText =
      String(pageInfo.bodyText || "")
        .replace(/\\s+/g, " ")
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
      "error 163"
    ];

    const blockedPattern =
      blockedPatterns.find(function(pattern) {
        return playerText.includes(pattern);
      }) || "";

    if (blockedPattern) {
      console.log("❌ YOUTUBE PLAYBACK BLOCKED");
      console.log("BLOCK REASON:", blockedPattern);
    } else {
      console.log("✅ YOUTUBE PLAYBACK NOT BLOCKED");
    }

    console.log("PLAYER TEXT:");
    console.log(pageInfo.bodyText.slice(0, 5000));

    await page.screenshot({
      path: "youtube-player-test.png",
      fullPage: true
    });

    console.log("SCREENSHOT SAVED: youtube-player-test.png");

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
