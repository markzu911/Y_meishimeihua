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

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

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
        headers: { 'Content-Type': 'application/json' },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      console.log(`Response from ${targetPath}:`, JSON.stringify(response.data).substring(0, 500));
      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error(`Error from ${targetPath}:`, error?.response?.data || error.message);
      const status = error?.response?.status || 500;
      res.status(status).json(error?.response?.data || { error: "代理转发失败" });
    }
  };

  app.post("/api/tool/launch", (req, res) => proxyRequest(req, res, "/api/tool/launch"));
  app.post("/api/tool/verify", (req, res) => proxyRequest(req, res, "/api/tool/verify"));
  app.post("/api/tool/consume", (req, res) => proxyRequest(req, res, "/api/tool/consume"));

  // Image upload/query/delete proxy
  app.post("/api/upload/image", (req, res) => proxyRequest(req, res, "/api/upload/image"));
  app.get("/api/upload/image", (req, res) => proxyRequest(req, res, "/api/upload/image"));
  app.delete("/api/upload/image", (req, res) => proxyRequest(req, res, "/api/upload/image"));

  app.post("/api/debug", (req, res) => {
    require('fs').writeFileSync('debug.json', JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
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
