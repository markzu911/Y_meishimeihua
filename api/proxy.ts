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

    // 4. /api/save-result - Standard SaaS Save Flow (Backend-driven)
    if (path.startsWith('/api/save-result')) {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      
      const { userId, toolId, imageUrl } = req.body;
      if (!userId || !toolId || !imageUrl) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

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

      // 3. Prepare Image Data (Support base64 or remote URL)
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

      return res.status(200).json(commitRes.data);
    }

    // 5. SaaS API Proxy
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
