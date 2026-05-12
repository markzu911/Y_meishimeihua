import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { GoogleGenAI } from '@google/genai';

const getAI = () => {
  const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
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

      const { model, payload } = req.body;
      const response = await ai.models.generateContent({
        model: model,
        ...payload
      });
      return res.status(200).json(response);
    }

    // 4. SaaS API Proxy
    const saasRoutes = [
      '/api/tool/',
      '/api/upload/',
      '/api/coze/'
    ];

    const matchedRoute = saasRoutes.find(route => path.startsWith(route));
    if (matchedRoute) {
      const targetUrl = `http://aibigtree.com${path}`;
      const response = await axios({
        method: req.method,
        url: targetUrl,
        data: req.method === 'GET' ? undefined : req.body,
        params: req.query,
        headers: { 'Content-Type': 'application/json' }
      });
      return res.status(response.status).json(response.data);
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
