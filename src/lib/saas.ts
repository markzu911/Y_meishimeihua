/**
 * SaaS 标准保存流程前端实现
 * 1. Consume: 扣费 (前端触发)
 * 2. Direct Token: 申请上传授权
 * 3. PUT: 前端直传二进制到 OSS
 * 4. Commit: 确认入库
 */

export async function saveImageStandard({
  userId,
  toolId,
  imageUrl,
  fileName = 'result.png',
  mimeType = 'image/png'
}: {
  userId: string;
  toolId: string;
  imageUrl: string;
  fileName?: string;
  mimeType?: string;
}) {
  try {
    // 1. 获取图片并转为 Blob (避免 Base64 膨胀和 JSON 限制)
    const blob = await fetch(imageUrl).then(res => res.blob());
    const fileSize = blob.size;

    // 2. 扣费接口
    const consumeRes = await fetch('/api/tool/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, toolId })
    });
    const consume = await consumeRes.json();
    if (!consume.success) {
      throw new Error(consume.message || '扣费失败');
    }

    // 3. 申请 OSS 直传 Token (只发小 JSON)
    const tokenRes = await fetch('/api/upload/direct-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        toolId,
        source: 'result',
        mimeType,
        fileName,
        fileSize
      })
    });
    const token = await tokenRes.json();
    if (!token.success) {
      throw new Error(token.message || '获取直传 Token 失败');
    }

    // 4. 前端直接 PUT 到 OSS (二进制流)
    const uploadRes = await fetch(token.uploadUrl, {
      method: 'PUT',
      headers: {
        ...token.headers
      },
      body: blob
    });
    if (!uploadRes.ok) {
      throw new Error(`OSS 上传失败: ${uploadRes.status}`);
    }

    // 5. 确认入库 (只发小 JSON)
    const commitRes = await fetch('/api/upload/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        toolId,
        source: 'result',
        objectKey: token.objectKey,
        fileSize
      })
    });
    const commit = await commitRes.json();
    if (!commit.success) {
      throw new Error(commit.message || '入库失败');
    }

    return {
      success: true,
      currentIntegral: consume.currentIntegral || consume.data?.currentIntegral,
      image: commit.image || {
        recordId: commit.recordId,
        url: commit.url,
        fileName: commit.fileName
      }
    };
  } catch (error: any) {
    console.error('Standard Save Error:', error);
    return {
      success: false,
      message: error.message || '保存失败'
    };
  }
}
