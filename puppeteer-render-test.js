const puppeteer = require("puppeteer");

(async () => {
  console.log("========== VIDEOAPNA PUPPETEER RENDER TEST ==========");

  try {
    console.log(
      "Puppeteer:",
      require("puppeteer/package.json").version
    );

    const browser = await puppeteer.launch({
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
  } catch (error) {
    console.error("❌ BROWSER TEST FAILED");
    console.error(error);
    process.exitCode = 1;
  }
})();
