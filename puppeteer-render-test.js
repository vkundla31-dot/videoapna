const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const http = require("http");

(async () => {
  console.log("========== VIDEOAPNA PUPPETEER RENDER TEST ==========");

  try {
    console.log(
      "Puppeteer:",
      require("puppeteer/package.json").version
    );

    const chromePath =
      process.env.PUPPETEER_EXECUTABLE_PATH || "";

    console.log("Chrome path:", chromePath);
    console.log(
      "Chrome exists:",
      chromePath ? fs.existsSync(chromePath) : false
    );

    const browser = await puppeteer.launch({
      ...(chromePath ? { executablePath: chromePath } : {}),
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage"
      ]
    });

    console.log("✅ Browser launched");

    const page = await browser.newPage();

    await page.setContent(`
      <!doctype html>
      <html>
        <head><title>VideoApna Render Test</title></head>
        <body>
          <h1>VideoApna Puppeteer Test</h1>
        </body>
      </html>
    `);

    console.log("✅ Page created");
    console.log("Title:", await page.title());

    await browser.close();

    console.log("✅ BROWSER TEST PASSED");

    const port = Number(process.env.PORT || 10000);

    http.createServer(function(req, res) {
      res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      res.end("VideoApna Puppeteer test is running.\\n");
    }).listen(port, "0.0.0.0", function() {
      console.log("✅ TEST SERVER LISTENING:", port);
    });
  } catch (error) {
    console.error("❌ BROWSER TEST FAILED");
    console.error(error);
    process.exitCode = 1;
  }
})();
