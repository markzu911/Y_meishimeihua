import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { createProxyMiddleware } from "http-proxy-middleware";

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

  // Use JSON and URLEncoded with high limits
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Content-Security-Policy", "frame-ancestors *");
    
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    next();
  });

  // SaaS Proxy Middleware
  const saasProxy = createProxyMiddleware({
    target: "http://aibigtree.com",
    changeOrigin: true,
    pathFilter: ['/api/tool/**', '/api/upload/**'],
    logger: console,
    on: {
      proxyReq: (proxyReq, req, res) => {
        // Fix for body-parser vs proxy conflict for non-multipart requests
        // If it's multipart, multer/formdata handles it, we don't manually rewrite body
        if (req.body && Object.keys(req.body).length > 0 && !req.headers['content-type']?.includes('multipart/form-data')) {
          const bodyData = JSON.stringify(req.body);
          proxyReq.setHeader('Content-Type', 'application/json');
          proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
          proxyReq.write(bodyData);
        }
      }
    }
  });

  app.use(saasProxy);

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
