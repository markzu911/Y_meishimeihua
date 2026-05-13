
export interface SaasUser {
  name: string;
  enterprise: string;
  integral: number;
}

export interface SaasTool {
  name: string;
  integral: number;
}

export interface LaunchResponse {
  success: boolean;
  data: {
    user: SaasUser;
    tool: SaasTool;
  };
}

export interface VerifyResponse {
  success: boolean;
  message?: string;
  data?: {
    currentIntegral: number;
    requiredIntegral: number;
  };
}

export interface ConsumeResponse {
  success: boolean;
  data?: {
    currentIntegral: number;
    consumedIntegral: number;
  };
}

export interface DirectTokenResponse {
  success: boolean;
  method: string;
  objectKey: string;
  uploadUrl: string;
  url: string;
  headers: Record<string, string>;
}

export interface ImageRecord {
  id: string;
  userId: string;
  userName: string;
  url: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
}

export interface ImageListResponse {
  success: boolean;
  data: ImageRecord[];
  total: number;
}

export const saasService = {
  async launch(userId: string, toolId: string): Promise<LaunchResponse> {
    const res = await fetch('/api/tool/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, toolId })
    });
    return res.json();
  },

  async verify(userId: string, toolId: string): Promise<VerifyResponse> {
    const res = await fetch('/api/tool/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, toolId })
    });
    return res.json();
  },

  async consume(userId: string, toolId: string): Promise<ConsumeResponse> {
    const res = await fetch('/api/tool/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, toolId })
    });
    return res.json();
  },

  async uploadImage(userId: string, base64: string, source: 'result' | 'input' = 'result'): Promise<any> {
    const res = await fetch('/api/upload/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, base64, source })
    });
    return res.json();
  },

  async uploadImages(userId: string, base64s: string[], source: 'result' | 'input' = 'result'): Promise<any> {
    const res = await fetch('/api/upload/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, base64s, source })
    });
    return res.json();
  },

  async getDirectToken(userId: string, file: File, source: 'result' | 'input' = 'input'): Promise<DirectTokenResponse> {
    const res = await fetch('/api/upload/direct-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        source,
        fileName: file.name,
        mimeType: file.type || 'image/png',
        fileSize: file.size
      })
    });
    return res.json();
  },

  async uploadDirect(token: DirectTokenResponse, file: File): Promise<void> {
    await fetch(token.uploadUrl, {
      method: token.method,
      headers: token.headers,
      body: file
    });
  },

  async commitImage(userId: string, objectKey: string, fileSize: number): Promise<any> {
    const res = await fetch('/api/upload/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        source: 'result',
        objectKey,
        fileSize
      })
    });
    return res.json();
  },

  async getImages(userId: string, role: number = 1): Promise<ImageListResponse> {
    const params = new URLSearchParams({ userId, role: role.toString() });
    const res = await fetch(`/api/upload/image?${params.toString()}`);
    return res.json();
  },

  async deleteImage(id: string, userId: string, role: number = 1): Promise<any> {
    const res = await fetch('/api/upload/image', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, userId, role })
    });
    return res.json();
  }
};
