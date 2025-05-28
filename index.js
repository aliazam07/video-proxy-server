const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());

// Proxy .m3u8 files and rewrite .ts URLs to go through the proxy
app.get("/stream/:cameraId", async (req, res) => {
  const { cameraId } = req.params;
  const streamUrl = `http://18.220.202.145/hls/${cameraId}.m3u8`;

  try {
    const response = await fetch(streamUrl);

    if (!response.ok) {
      return res.status(502).json({ error: "Failed to fetch stream" });
    }

    const m3u8Body = await response.text();

    // Rewrite .ts segment paths to go through the proxy
    const rewrittenM3u8 = m3u8Body.replace(/([a-zA-Z0-9_-]+\.ts)/g, `/hls/$1`);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");

    res.send(rewrittenM3u8);
  } catch (error) {
    console.error("Error fetching .m3u8:", error);
    res.status(500).json({ error: "Proxy error" });
  }
});

// Proxy .ts segment files
app.get("/hls/:segment", async (req, res) => {
  const { segment } = req.params;
  const segmentUrl = `http://18.220.202.145/hls/${segment}`;

  try {
    const response = await fetch(segmentUrl);

    if (!response.ok) {
      return res.status(502).json({ error: "Failed to fetch TS segment" });
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "video/MP2T");

    response.body.pipe(res);
  } catch (error) {
    console.error("Error fetching TS segment:", error);
    res.status(500).json({ error: "TS Proxy error" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Proxy server running on port ${PORT}`);
});
