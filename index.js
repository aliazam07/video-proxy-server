const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());

// Helper: fetch with timeout
const fetchWithTimeout = async (url, options = {}, timeout = 10000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};

// Helper: fetch with retries
const fetchWithRetry = async (url, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) {
        throw new Error(`Fetch failed with status ${res.status} ${res.statusText}`);
      }
      return res;
    } catch (err) {
      console.warn(`Fetch attempt ${attempt} failed for ${url}:`, err.message);
      if (attempt === retries) {
        throw err;
      }
      // Wait 1 second before retry
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
};

// Proxy .m3u8 files and rewrite .ts URLs to go through the proxy
app.get("/stream/:cameraId", async (req, res) => {
  const { cameraId } = req.params;
  const streamUrl = `http://18.220.202.145/hls/${cameraId}.m3u8`;

  try {
    const response = await fetchWithRetry(streamUrl);
    console.log(`[${new Date().toISOString()}] Fetched .m3u8: ${streamUrl} - Status: ${response.status}`);

    const m3u8Body = await response.text();

    // Rewrite .ts segment paths to go through the proxy
    const rewrittenM3u8 = m3u8Body.replace(/([a-zA-Z0-9_-]+\.ts)/g, `/hls/$1`);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    res.send(rewrittenM3u8);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error fetching .m3u8 for ${cameraId}:`, error.message);
    res.setHeader("Retry-After", "5"); // ask client to retry after 5 seconds
    res.status(502).json({ error: "Failed to fetch stream. Please retry shortly." });
  }
});

// Proxy .ts segment files
app.get("/hls/:segment", async (req, res) => {
  const { segment } = req.params;
  const segmentUrl = `http://18.220.202.145/hls/${segment}`;

  try {
    const response = await fetchWithRetry(segmentUrl);
    console.log(`[${new Date().toISOString()}] Fetched TS segment: ${segmentUrl} - Status: ${response.status}`);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "video/MP2T");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    response.body.pipe(res);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error fetching TS segment ${segment}:`, error.message);
    res.setHeader("Retry-After", "5");
    res.status(502).json({ error: "Failed to fetch TS segment. Please retry shortly." });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Proxy server running on port ${PORT}`);
});
