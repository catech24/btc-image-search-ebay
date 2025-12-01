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

    // 1. Save uploaded image
    fs.writeFileSync(tmpPath, imageBuffer);

    // 2. Launch Chromium (mobile optimized)
    const browser = await puppeteer.launch({
      headless: "new",
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
        "--window-size=390,844",
      ]
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Linux; Android 10; SM-G973U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0 Mobile Safari/537.36"
    );
    await page.setViewport({ width: 390, height: 844, isMobile: true });

    // 3. Go to Mobile eBay Search Page
    await page.goto("https://m.ebay.com/sch/i.html", {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    // 4. Click camera search button
    await page.waitForSelector('#gh-btn-photo', { timeout: 60000 });
    await page.click('#gh-btn-photo');

    // 5. Wait for file input to appear
    await page.waitForSelector('input[type="file"]', { timeout: 60000 });
    const inputUploadHandle = await page.$('input[type="file"]');

    // 6. Upload the image
    await inputUploadHandle.uploadFile(tmpPath);

    // 7. Wait for results to render
    await page.waitForSelector(".srp-results", { timeout: 60000 });

    // 8. Scrape results
    const results = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('.s-item').forEach(item => {
        const title = item.querySelector('.s-item__title')?.innerText || null;
        const price = item.querySelector('.s-item__price')?.innerText || null;
        const img = item.querySelector('img.s-item__image-img')?.src || null;
        const link = item.querySelector('a.s-item__link')?.href || null;

        if (title || price || img || link) {
          items.push({ title, price, img, link });
        }
      });
      return items;
    });

    await browser.close();

    return res.json({
      success: true,
      matches: results
    });

  } catch (err) {
    console.error("ERROR in /image-search:", err);
    return res.status(500).json({
      success: false,
      error: err.message || String(err)
    });
  }
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
