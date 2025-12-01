import express from "express";
import fileUpload from "express-fileupload";
import puppeteer from "puppeteer-core";
import fs from "fs";

const app = express();

// Allow file uploads up to ~15MB
app.use(
  fileUpload({
    limits: { fileSize: 15 * 1024 * 1024 },
    useTempFiles: false
  })
);

// Mobile-ish user agent so we look like a phone
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";

// Simple health check
app.get("/", (req, res) => {
  res.send("btc-image-search-ebay is running");
});

app.post("/image-search", async (req, res) => {
  try {
    if (!req.files || !req.files.image) {
      return res.status(400).json({ success: false, error: "No image uploaded" });
    }

    const imageBuffer = req.files.image.data;
    const tmpPath = "/tmp/upload.jpg";

    // Save the uploaded image to /tmp
    fs.writeFileSync(tmpPath, imageBuffer);

    // Launch Chromium via puppeteer-core
    const browser = await puppeteer.launch({
      headless: "new",
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process"
      ]
    });

    const page = await browser.newPage();
    await page.setUserAgent(MOBILE_UA);
    await page.setViewport({ width: 390, height: 844, isMobile: true });

await page.goto("https://www.ebay.com", {
  waitUntil: "domcontentloaded",
  timeout: 60000
});

// Wait for page content to load
await page.waitForSelector("title", { timeout: 60000 });

const title = await page.title();


    await browser.close();

    return res.json({
      success: true,
      message: "Puppeteer ran successfully",
      ebayTitle: title
    });
  } catch (err) {
    console.error("ERROR in /image-search:", err);
    return res.status(500).json({
      success: false,
      error: err.message || String(err)
    });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
