import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
        data: req.body,
        headers: { 'Content-Type': 'application/json' }
      });
      console.log(`Response from ${targetPath}:`, JSON.stringify(response.data).substring(0, 500));
      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error(`Error from ${targetPath}:`, error?.response?.data || error.message);
      res.status(500).json({ error: "代理转发失败" });
    }
  };

  app.post("/api/tool/launch", (req, res) => proxyRequest(req, res, "/api/tool/launch"));
  app.post("/api/tool/verify", (req, res) => proxyRequest(req, res, "/api/tool/verify"));
  app.post("/api/tool/consume", (req, res) => proxyRequest(req, res, "/api/tool/consume"));

  app.post("/api/debug", (req, res) => {
    require('fs').writeFileSync('debug.json', JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  });

  app.post("/api/gemini", async (req, res) => {
    const { model, payload } = req.body;
    try {
      const response = await ai.models.generateContent({
        model: model || (payload.ratio ? 'gemini-3.1-flash-image-preview' : 'gemini-1.5-flash'),
        contents: {
          parts: [
            ...(payload.base64Data ? [{ inlineData: { data: payload.base64Data, mimeType: payload.mimeType || 'image/png' } }] : []),
            { text: payload.prompt }
          ],
        },
        config: payload.ratio ? {
          imageConfig: { aspectRatio: payload.ratio, imageSize: payload.resolution || '1K' }
        } : undefined
      });

      let generatedUrl = null;
      if (payload.ratio) {
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            generatedUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            break;
          }
        }
        res.json({ url: generatedUrl });
      } else {
        res.json({ text: response.text });
      }
    } catch (error: any) {
      console.error("Gemini Proxy Error:", error);
      res.status(500).json({ error: error.message || "Gemini execution failed" });
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
