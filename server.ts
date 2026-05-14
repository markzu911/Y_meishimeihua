import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const getAI = () => {
  const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!key) {
    console.error("ERROR: GEMINI_API_KEY is not defined in the environment.");
    return null;
  }
  return new GoogleGenAI({ apiKey: key });
};

let ai = getAI();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Content-Security-Policy", "frame-ancestors *");
    
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    next();
  });

  const proxyRequest = async (req: express.Request, res: express.Response, targetPath: string) => {
    const targetUrl = `http://aibigtree.com${targetPath}`;
    try {
      const response = await axios({
        method: req.method,
        url: targetUrl,
        data: req.method === 'GET' ? undefined : req.body,
        params: req.query,
        headers: { 'Content-Type': 'application/json' }
      });
      console.log(`Response from ${targetPath}:`, JSON.stringify(response.data).substring(0, 500));
      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error(`Error from ${targetPath}:`, error?.response?.data || error.message);
      res.status(500).json({ error: "代理转发失败" });
    }
  };

  app.all(["/api/tool/*", "/api/upload/*", "/api/coze/*"], (req, res) => proxyRequest(req, res, req.path));

  app.post("/api/debug", (req, res) => {
    require('fs').writeFileSync('debug.json', JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  });

  app.post("/api/save-result", async (req, res) => {
    const { userId, toolId, imageUrl } = req.body;
    if (!userId || !toolId || !imageUrl) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
      // 1. Consume Points
      const consumeRes = await axios.post('http://aibigtree.com/api/tool/consume', { userId, toolId });
      if (!consumeRes.data.success) {
        return res.status(400).json({ error: consumeRes.data.message || 'Consume failed' });
      }

      // 2. Get Direct Token
      const tokenRes = await axios.post('http://aibigtree.com/api/upload/direct-token', {
        userId, toolId, source: 'result', mimeType: 'image/png'
      });
      if (!tokenRes.data.success) {
        return res.status(500).json({ error: 'Failed to get upload token' });
      }

      // 3. Prepare Image Data
      let imageBuffer: Buffer;
      if (imageUrl.startsWith('data:')) {
        const base64Data = imageUrl.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        const imageGet = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        imageBuffer = Buffer.from(imageGet.data);
      }

      // 4. PUT to OSS
      const { uploadUrl, headers, objectKey } = tokenRes.data;
      await axios.put(uploadUrl, imageBuffer, {
        headers: {
          ...headers,
          'Content-Length': imageBuffer.length
        }
      });

      // 5. Commit to Records
      const commitRes = await axios.post('http://aibigtree.com/api/upload/commit', {
        userId, toolId, source: 'result', objectKey, fileSize: imageBuffer.length
      });

      res.status(200).json(commitRes.data);
    } catch (error: any) {
      console.error('Save result error:', error?.response?.data || error.message);
      res.status(500).json({ error: 'Internal Server Error', details: error?.response?.data || error.message });
    }
  });

  app.post("/api/gemini", async (req, res) => {
    if (!ai) {
      ai = getAI();
    }
    
    if (!ai) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
    }

    const { model, payload } = req.body;
    try {
      const response = await ai.models.generateContent({
        model: model,
        ...payload
      });
      res.json(response);
    } catch (error: any) {
      console.error("Gemini Proxy Error:", error);
      res.status(error?.status || 500).json({ 
        error: error.message || "Gemini execution failed",
        details: error?.response?.data || error
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
