import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import path from "path";
import sharp from "sharp";
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

  // Helper to read SaaS JSON response robustly as per spec
  async function readSaasResponse(res: any) {
    const data = res.data;
    if (res.status !== 200 || data.success === false) {
      throw new Error(data.error || data.message || `SaaS Request Failed: ${res.status}`);
    }
    return data;
  }

  app.post("/api/save-result", async (req, res) => {
    const { userId, toolId, imageUrl, fileName = 'result.png' } = req.body;
    if (!userId || !toolId || !imageUrl) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
      // 1. Prepare & Normalize Image Data FIRST
      // This ensures we have a valid processed image BEFORE we consume points
      let rawImageBuffer: Buffer;
      if (imageUrl.startsWith('data:')) {
        const base64Data = imageUrl.split(',')[1];
        rawImageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        const imageGet = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        rawImageBuffer = Buffer.from(imageGet.data);
      }

      // Normalize with sharp: auto-rotate, limit size to 3072px, strip EXIF
      const normalizedImage = await sharp(rawImageBuffer, { failOn: 'none' })
        .rotate()
        .resize({
          width: 3072,
          height: 3072,
          fit: 'inside',
          withoutEnlargement: true
        })
        .png({ compressionLevel: 9, quality: 90 })
        .toBuffer();

      const finalMimeType = 'image/png';

      // 2. Consume Points (Only after processing successful)
      const consumeRes = await axios.post('http://aibigtree.com/api/tool/consume', { userId, toolId });
      const consume = await readSaasResponse(consumeRes);

      // 3. Get Direct Token
      const tokenRes = await axios.post('http://aibigtree.com/api/upload/direct-token', {
        userId, 
        toolId, 
        source: 'result', 
        mimeType: finalMimeType,
        fileName: fileName.endsWith('.png') ? fileName : `${fileName}.png`,
        fileSize: normalizedImage.length
      });
      const token = await readSaasResponse(tokenRes);

      // 4. PUT to OSS
      const { uploadUrl, headers, objectKey } = token;
      await axios.put(uploadUrl, normalizedImage, {
        headers: {
          ...headers,
          'Content-Length': normalizedImage.length
        }
      });

      // 5. Commit to Records
      const commitRes = await axios.post('http://aibigtree.com/api/upload/commit', {
        userId, 
        toolId, 
        source: 'result', 
        objectKey, 
        fileSize: normalizedImage.length
      });
      const commit = await readSaasResponse(commitRes);

      // Return consistent final image data
      res.status(200).json({
        success: true,
        currentIntegral: consume.currentIntegral || consume.data?.currentIntegral,
        image: commit.image || {
          recordId: commit.recordId,
          url: commit.url,
          fileName: commit.fileName,
          savedToRecords: true
        }
      });
    } catch (error: any) {
      const errorDetail = error?.response?.data || error.message;
      console.error('Save result process failed:', errorDetail);
      res.status(500).json({ 
        success: false, 
        error: errorDetail,
        message: typeof errorDetail === 'string' ? errorDetail : '处理或保存图片失败'
      });
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
