const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());

app.get("/stream/:cameraId", async (req, res) => {
  const { cameraId } = req.params;
  const streamUrl = `http://18.220.202.145/hls/${cameraId}.m3u8`;

  try {
    const response = await fetch(streamUrl);

    if (!response.ok) {
      return res.status(502).json({ error: "Failed to fetch stream" });
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");

    response.body.pipe(res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Proxy error" });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
