import express from "express";
import fileUpload from "express-fileupload";
import puppeteer from "puppeteer";

const app = express();
app.use(fileUpload({ limits: { fileSize: 15 * 1024 * 1024 } }));

// Mobile User-Agent (iPhone Safari)
const MOBILE_UA = 
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";

app.post("/image-search", async (req, res) => {
  try {
    if (!req.files || !req.files.image) {
      return res.status(400).json({ error: "No image uploaded." });
    }

    const imageBuffer = req.files.image.data;

    const browser = await puppeteer.launch({
  headless: "new",
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--single-process"
  ]
});


    const page = await browser.newPage();
    await page.setUserAgent(MOBILE_UA);
    await page.setViewport({ width: 390, height: 844, isMobile: true });

    // Navigate to eBay's image search page
    await page.goto("https://m.ebay.com/", { waitUntil: "networkidle2" });

    // Click the camera icon (mobile-only)
    await page.waitForSelector('button[aria-label="Search with image"]', { timeout: 10000 });
    await page.click('button[aria-label="Search with image"]');

    // Wait for image upload input
    const inputSelector = 'input[type="file"]';
    await page.waitForSelector(inputSelector);

    // Upload file buffer
    const inputUploadHandle = await page.$(inputSelector);
    await inputUploadHandle.uploadFile("/tmp/upload.jpg");

    // Save file to /tmp
    const fs = await import("fs");
    fs.writeFileSync("/tmp/upload.jpg", imageBuffer);

    // Wait for results to load
    await page.waitForSelector(".s-item", { timeout: 20000 });

    // Scrape results
    const results = await page.evaluate(() => {
      const items = [...document.querySelectorAll(".s-item")];

      return items.map(it => ({
        title: it.querySelector(".s-item__title")?.innerText || null,
        price: it.querySelector(".s-item__price")?.innerText || null,
        image: it.querySelector("img")?.src || null,
        link: it.querySelector("a")?.href || null,
        soldInfo: it.querySelector(".s-item__caption")?.innerText || null
      }));
    });

    await browser.close();

    res.json({ success: true, results });

  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ error: err.toString() });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("eBay Image Search Microservice running on port " + PORT);
});
