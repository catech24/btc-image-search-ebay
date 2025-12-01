import express from "express";
import fileUpload from "express-fileupload";
import puppeteer from "puppeteer-core";
import fs from "fs";

const app = express();

// Allow file uploads
app.use(
  fileUpload({
    limits: { fileSize: 25 * 1024 * 1024 },
    useTempFiles: false
  })
);

// Health check
app.get("/", (req, res) => {
  res.send("btc-image-search-ebay is running");
});

// ===============================
// REAL EBAY MOBILE IMAGE SEARCH
// ===============================
app.post("/image-search", async (req, res) => {
  try {
    // No image uploaded?
    if (!req.files || !req.files.image) {
      return res.status(400).json({
        success: false,
        error: "No image uploaded"
      });
    }

    // Save incoming file
    const imageBuffer = req.files.image.data;
    const tmpPath = "/tmp/upload.jpg";
    fs.writeFileSync(tmpPath, imageBuffer);

    // Launch Chromium
    const browser = await puppeteer.launch({
      headless: "new",
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
        "--window-size=390,844"
      ]
    });

    const page = await browser.newPage();

    // Mobile UA + viewport
    await page.setUserAgent(
      "Mozilla/5.0 (Linux; Android 10; SM-G973U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0 Mobile Safari/537.36"
    );
    await page.setViewport({ width: 390, height: 844, isMobile: true });

 // Load fallback image-search page that ALWAYS shows upload input
await page.goto("https://www.ebay.com/sch/i.html?_nkw=&_saslop=1&_sofindtype=7", {
  waitUntil: "domcontentloaded",
  timeout: 60000
});

// Upload input is available immediately — no camera button needed
await page.waitForSelector('input[type="file"]', { timeout: 60000 });

const inputUploadHandle = await page.$('input[type="file"]');
await inputUploadHandle.uploadFile(tmpPath);

// Wait for results to load
await page.waitForSelector(".srp-results", { timeout: 60000 });


    // Wait for results
    await page.waitForSelector(".srp-results", { timeout: 60000 });

    // Scrape results
    const results = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll(".s-item").forEach((item) => {
        const title = item.querySelector(".s-item__title")?.innerText || null;
        const price = item.querySelector(".s-item__price")?.innerText || null;
        const img = item.querySelector("img.s-item__image-img")?.src || null;
        const link = item.querySelector("a.s-item__link")?.href || null;

        if (title || price || img || link) {
          items.push({ title, price, img, link });
        }
      });
      return items;
    });

    await browser.close();

    // SUCCESS RESPONSE
    return res.json({
      success: true,
      matches: results
    });

  } catch (err) {
    console.error("ERROR in /image-search:", err);
    return res.json({
      success: false,
      error: err.message || String(err)
    });
  }
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
