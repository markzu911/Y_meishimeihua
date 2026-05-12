import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { GoogleGenAI } from '@google/genai';

const getAI = () => {
  const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // 2. Handle OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url } = req;
  const path = url || '';

  try {
    // 3. /api/gemini
    if (path.startsWith('/api/gemini')) {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      
      const ai = getAI();
      if (!ai) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

      // Manually parse body since bodyParser is disabled
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      const data = Buffer.concat(buffers).toString();
      const body = JSON.parse(data);

      const { model, payload } = body;
      const response = await ai.models.generateContent({
        model: model,
        ...payload
      });
      return res.status(200).json(response);
    }

    // 4. /api/tool/* and /api/upload/* Proxy
    if (path.startsWith('/api/tool/') || path.startsWith('/api/upload/')) {
      const targetUrl = `http://aibigtree.com${path}`;
      
      // Use axios to forward the request
      // Note: for multipart/form-data, we need to pass the headers correctly
      const headers: any = { ...req.headers };
      delete headers.host;
      delete headers.connection;

      const response = await axios({
        method: req.method,
        url: targetUrl,
        data: req, // Pipe the original internal request stream
        headers: headers,
        responseType: 'arraybuffer',
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        validateStatus: () => true
      });

      res.status(response.status);
      for (const [key, value] of Object.entries(response.headers)) {
        res.setHeader(key, value as string);
      }
      return res.send(response.data);
    }

    // 5. Default
    return res.status(404).json({ error: 'Not Found' });

  } catch (error: any) {
    console.error('API Error:', error?.response?.data || error.message);
    return res.status(error?.response?.status || 500).json({
      error: 'Internal Server Error',
      details: error?.response?.data || error.message
    });
  }
}
