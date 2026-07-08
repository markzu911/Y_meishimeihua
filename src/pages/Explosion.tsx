import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, Loader2, Layers, Download, X, Plus, ArrowLeft, Tag, Bot, Sliders, Send, RefreshCw, Sparkles, Upload, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { saveImageStandard } from '../lib/saas';
import { SaasData } from '../App';

const RATIOS = [
  { id: '1:1', name: '1:1', desc: '方形' },
  { id: '3:4', name: '3:4', desc: '竖版' },
  { id: '9:16', name: '9:16', desc: '长竖版' },
  { id: '16:9', name: '16:9', desc: '宽屏' },
] as const;
type AspectRatio = typeof RATIOS[number]['id'];

const RESOLUTIONS = [
  { id: '1K', name: '1K', desc: '标准清晰度' },
  { id: '2K', name: '2K', desc: '高清画质' },
  { id: '4K', name: '4K', desc: '超清画质' },
] as const;
type Resolution = typeof RESOLUTIONS[number]['id'];

export default function Explosion({ 
  saasData, 
  mode, 
  setMode, 
  onChangeTab,
  initialHistory,
  onMessagesUpdate
}: { 
  saasData: SaasData | null; 
  mode: 'agent' | 'expert'; 
  setMode: (mode: 'agent' | 'expert') => void; 
  onChangeTab?: (tab: 'choice' | 'beautify' | 'explosion') => void;
  initialHistory?: any[];
  onMessagesUpdate?: (messages: any[]) => void;
}) {
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [selectedRatios, setSelectedRatios] = useState<AspectRatio[]>(['3:4']);
  const [selectedResolution, setSelectedResolution] = useState<Resolution>('1K');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState<number>(-1);
  const [generatingRatio, setGeneratingRatio] = useState<AspectRatio | null>(null);
  const [resultImages, setResultImages] = useState<Partial<Record<AspectRatio, string | null>>[]>([]);
  const [generatedRatios, setGeneratedRatios] = useState<AspectRatio[]>([]);
  const [generatedResolution, setGeneratedResolution] = useState<Resolution | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const errorRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  interface Layer {
    y: number;
    name: string;
  }
  const [layersData, setLayersData] = useState<Record<string, Layer[]>>({});
  const [dishNamesData, setDishNamesData] = useState<Record<string, string>>({});
  const [dishNameYData, setDishNameYData] = useState<Record<string, number>>({});
  const [dishNameSizeData, setDishNameSizeData] = useState<Record<string, number>>({});
  const [layerNameSizeData, setLayerNameSizeData] = useState<Record<string, number>>({});
  const [defaultLayersData, setDefaultLayersData] = useState<Record<string, Layer[]>>({});
  const [defaultDishNamesData, setDefaultDishNamesData] = useState<Record<string, string>>({});
  const [defaultDishNameYData, setDefaultDishNameYData] = useState<Record<string, number>>({});
  const [detectingLayers, setDetectingLayers] = useState<Record<string, boolean>>({});
  const [editingLabel, setEditingLabel] = useState<{ index: number, ratio: string, url: string, layers: Layer[], dishName: string, dishNameY: number, dishNameSize: number, layerNameSize: number } | null>(null);

  // Agent Chat State and Interfaces
  interface Message {
    id: string;
    sender: 'user' | 'assistant';
    text: string;
    timestamp: Date;
    type?: 'upload' | 'config' | 'generating' | 'result' | 'error' | 'text';
    payload?: any;
  }

  const [agentMessages, setAgentMessages] = useState<Message[]>(() => {
    const welcomeMsg: Message = {
      id: 'welcome',
      sender: 'assistant',
      timestamp: new Date(),
      type: 'upload',
      text: '已为您进入 **美食爆炸图** 空间！💥🍴\n\n我可以帮您把普通的菜品照片重构为悬浮、层级分明的**三维美食爆炸效果图**，并自动智能识别食材并添加图层标签。\n\n您可以随时对我说“**切换到菜品一键美化**”以自由切换功能。\n\n请先点击下方上传您的菜品照片以开始制作：'
    };
    if (initialHistory && initialHistory.length > 0) {
      // Find and remove any temporary loading or transitioning messages at the end to make it clean
      const filteredHistory = initialHistory.filter(msg => !msg.text?.includes('正在为您加载') && !msg.text?.includes('正在开启'));
      return [...filteredHistory, welcomeMsg];
    }
    return [welcomeMsg];
  });

  // Keep parent's messages in sync
  useEffect(() => {
    onMessagesUpdate?.(agentMessages);
  }, [agentMessages, onMessagesUpdate]);
  const [chatInput, setChatInput] = useState('');
  const [isAiResponding, setIsAiResponding] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const generationPromiseRef = useRef<Promise<void> | null>(null);

  // Formatting helper to strip markdown raw tags (like **bold**) and render nicely
  const renderFormattedText = (text: string) => {
    if (!text) return null;
    const parts = text.split('**');
    return (
      <span className="whitespace-pre-wrap leading-relaxed">
        {parts.map((part, i) => {
          if (i % 2 === 1) {
            return (
              <strong key={i} className="font-extrabold text-neutral-900 mx-[1px]">
                {part}
              </strong>
            );
          }
          return part;
        })}
      </span>
    );
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentMessages]);

  // Humorous progress text cycling for explosion diagrams
  useEffect(() => {
    if (isGenerating) {
      const interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % 4);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isGenerating]);

  const loadingMessages = [
    '正在分离并提取食物食材层级... 🥗',
    '正在构建空间深度并排布爆炸轨迹... 🚀',
    '正在生成高分辨率的三维悬浮爆炸效果... 🎨',
    '正在调用智能视觉网络分析图层并准备成片... 🔍'
  ];

  // Watch isGenerating transitions to append Agent messages
  const prevIsGenerating = useRef(isGenerating);
  useEffect(() => {
    if (prevIsGenerating.current && !isGenerating) {
      if (error) {
        setAgentMessages(prev => [
          ...prev.filter(m => m.type !== 'generating'),
          {
            id: `error-${Date.now()}`,
            sender: 'assistant',
            timestamp: new Date(),
            type: 'text',
            text: `❌ 生成失败: ${error}`
          }
        ]);
      } else if (resultImages.length > 0 && resultImages[0] && Object.keys(resultImages[0]).length > 0) {
        const savedImages = { ...resultImages[0] };
        const savedLayers: Record<string, any> = {};
        const savedDishNames: Record<string, string> = {};
        Object.keys(savedImages).forEach(ratio => {
          const key = `0-${ratio}`;
          if (layersData[key]) {
            savedLayers[ratio] = [...layersData[key]];
          }
          if (dishNamesData[key]) {
            savedDishNames[ratio] = dishNamesData[key];
          }
        });

        setAgentMessages(prev => [
          ...prev.filter(m => m.type !== 'generating'),
          {
            id: `result-${Date.now()}`,
            sender: 'assistant',
            timestamp: new Date(),
            type: 'result',
            payload: {
              images: savedImages,
              layers: savedLayers,
              dishNames: savedDishNames,
              ratios: [...selectedRatios],
              resolution: selectedResolution
            },
            text: `✨ 美丽的爆炸大片已生成！我对菜品原图进行了完整的三维层级排布，并利用 AI 智能识别了食材图层：`
          }
        ]);
      }
    }
    prevIsGenerating.current = isGenerating;
  }, [isGenerating, error, resultImages, layersData, dishNamesData]);

  const parseGeminiResponse = async (userText: string, currentRatio: string, currentRes: string) => {
    try {
      const prompt = `你是一个高度智能、有人情味且专业的“美食爆炸图视觉AI管家”。
当前用户输入是: "${userText}"。

系统当前状态:
- 是否已上传菜品原图: ${selectedImages.length > 0 ? "是 (已上传)" : "否 (尚未上传)"}
- 当前设定的输出比例: ${currentRatio}
- 当前设定的生成画质: ${currentRes}

可选输出比例: "1:1", "3:4", "9:16", "16:9" （用户可以说：方形、横版、竖版、长视频、抖音比例、长宽比等，请智能映射到最接近的比例）。
可选画质: "1K", "2K", "4K"（用户可以说：标准、高清、超清、4k清晰度、最高画质、精细画质等）。

请根据用户输入的指令和意图：
1. 分析用户是否表达了以下任一明确指令：
   - 【开始生成/制作】（如：“开始”、“开始制作”、“搞起”、“做一张”、“立即制作”、“生成”、“确定生成”、“走起”、“开始做”等）
   - 【重置/重新开始】（如：“重置”、“重新开始”、“重新选择”、“重来”、“清空”等）
   - 【修改尺寸/比例】（如：“换成16比9”、“改成方形”、“修改比例为3:4”等）
   - 【修改清晰度/画质】（如：“用4K画质”、“提升清晰度为2K”等）

2. 给出非常自然、拟人化的、口语化且有温度的回复（reply）。
   - 不要像机器人一样机械重复，而是针对用户的改变直接予以确认和鼓励。
   - 如果用户要求生成（或准备好生成），在回复中兴奋地告诉他们：“好的，收到您的指令，马上为您分层级构建爆炸效果！请看下方👇...” 或类似话语。
   - 如果用户尚未上传照片，友好地引导他们上传，如：“比例已选好！快把您的美食照片上传到这里，我这就开始为您重构层级~”
   - 如果用户已经上传了照片，可以顺应他们的要求，修改比例后，友好地提示：“已为您切换，随时可以点击下方的‘开始 AI 制作’，或者直接对我说‘开始生成’！”

3. 务必返回以下 JSON 格式（绝对不要带有任何 markdown 格式标记如 \`\`\`json 或是 \`\`\`，必须是纯 JSON 字符串）：
{
  "reply": "非常自然拟人化的回复，总结当前的改动并引导下一步（如果有）",
  "detectedRatio": "匹配到的比例如 1:1，如果没有提到，返回 null",
  "detectedResolution": "匹配到的清晰度如 2K，如果没有提到，返回 null",
  "shouldStartGenerate": true/false (当用户表达了“开始制作/开始生成/一键生成”的意思时为 true，否则为 false),
  "shouldReset": true/false (当用户表达了“重新开始/重置”的意思时为 true，否则为 false)
}`;

      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-3.5-flash",
          payload: {
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json" }
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || data.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    } catch (err) {
      console.error("Gemini parse failed:", err);
    }
    return null;
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText !== undefined ? customText : chatInput;
    if (!textToSend.trim()) return;

    if (customText === undefined) {
      setChatInput('');
    }

    // Conversations routing / switching
    const lowerText = textToSend.toLowerCase();
    if (lowerText.includes('美化') || lowerText.includes('beautify') || lowerText.includes('背景') || lowerText.includes('光影') || lowerText === '1') {
      if (onChangeTab) {
        onChangeTab('beautify');
        return;
      }
    }

    setAgentMessages(prev => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: textToSend,
        timestamp: new Date(),
        type: 'text'
      }
    ]);

    if (isGenerating && generationPromiseRef.current) {
      const isStopIntent = /停|取消|别|不要|stop|cancel|quit|abort|不生/i.test(textToSend);
      if (isStopIntent) {
        abortControllerRef.current?.abort();
        setAgentMessages(prev => [
          ...prev,
          {
            id: `assistant-abort-${Date.now()}`,
            sender: 'assistant',
            text: '已为您停止当前的生成任务。',
            timestamp: new Date(),
            type: 'text'
          }
        ]);
        return;
      } else {
        setIsAiResponding(true);
        const waitId = `wait-${Date.now()}`;
        setAgentMessages(prev => [
          ...prev,
          {
            id: waitId,
            sender: 'assistant',
            text: '图片生成中，等图片生成结束了再为您解答...',
            timestamp: new Date(),
            type: 'text'
          }
        ]);
        try {
          await generationPromiseRef.current;
        } catch (e) {}
        setAgentMessages(prev => prev.filter(m => m.id !== waitId));
      }
    }

    setIsAiResponding(true);

    try {
      const thinkingId = `thinking-${Date.now()}`;
      setAgentMessages(prev => [
        ...prev,
        {
          id: thinkingId,
          sender: 'assistant',
          text: 'AI 正在分析并理解您的意思...',
          timestamp: new Date(),
          type: 'text'
        }
      ]);

      const result = await parseGeminiResponse(textToSend, selectedRatios[0] || '3:4', selectedResolution);

      setAgentMessages(prev => prev.filter(m => m.id !== thinkingId));

      if (result) {
        if (result.shouldReset) {
          resetAgentFlow();
          return;
        }

        if (result.detectedRatio) {
          const matchedRatio = RATIOS.find(r => r.id === result.detectedRatio);
          if (matchedRatio) {
            setSelectedRatios([matchedRatio.id]);
          }
        }
        if (result.detectedResolution) {
          const matchedRes = RESOLUTIONS.find(r => r.id === result.detectedResolution);
          if (matchedRes) {
            setSelectedResolution(matchedRes.id);
          }
        }

        setAgentMessages(prev => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            sender: 'assistant',
            text: result.reply || '已为您调整爆炸图的输出比例或参数。',
            timestamp: new Date(),
            type: selectedImages.length === 0 ? 'upload' : 'config'
          }
        ]);

        if (result.shouldStartGenerate) {
          setTimeout(() => {
            startAgentGeneration();
          }, 150);
        }
      } else {
        setAgentMessages(prev => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            sender: 'assistant',
            text: '抱歉，我不太理解您的这个要求。请上传菜品照片，或直接配置下方的比例开始生成爆炸图吧！',
            timestamp: new Date(),
            type: selectedImages.length === 0 ? 'upload' : 'config'
          }
        ]);
      }
    } catch (err) {
      console.error(err);
      setAgentMessages(prev => [
        ...prev,
        {
          id: `assistant-err-${Date.now()}`,
          sender: 'assistant',
          text: '网络有一些开小差，请直接点击按钮配置生成。',
          timestamp: new Date(),
          type: selectedImages.length === 0 ? 'upload' : 'config'
        }
      ]);
    } finally {
      setIsAiResponding(false);
    }
  };

  const startAgentGeneration = async () => {
    if (selectedImages.length === 0) {
      setAgentMessages(prev => [
        ...prev,
        {
          id: `err-no-img-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date(),
          type: 'text',
          text: '⚠️ 请先上传您的菜品照片才能制作爆炸图。'
        }
      ]);
      return;
    }

    if (saasData) {
      try {
        const verifyRes = await fetch('/api/tool/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: saasData.userId, toolId: saasData.toolId })
        });
        const verifyResult = await verifyRes.json();
        
        const verifyPts = verifyResult?.currentIntegral ?? verifyResult?.points ?? verifyResult?.balance ?? verifyResult?.remain ?? verifyResult?.data?.balance ?? verifyResult?.data?.points ?? verifyResult?.data?.currentIntegral;
        if (verifyPts !== undefined && verifyPts !== null) {
          window.dispatchEvent(new CustomEvent('update_points', { detail: { points: verifyPts } }));
        }

        if (!verifyResult.success && !verifyResult.valid) {
          setAgentMessages(prev => [
            ...prev,
            {
              id: `quota-err-${Date.now()}`,
              sender: 'assistant',
              timestamp: new Date(),
              type: 'error',
              text: `❌ 积分不足，无法执行该操作`
            }
          ]);
          return;
        }
      } catch (e: any) {
        setAgentMessages(prev => [
          ...prev,
          {
            id: `quota-err-${Date.now()}`,
            sender: 'assistant',
            timestamp: new Date(),
            type: 'error',
            text: `❌ 积分校验失败: ${e.message || '网络连接错误'}`
          }
        ]);
        return;
      }
    }

    setAgentMessages(prev => [
      ...prev,
      {
        id: `generating-${Date.now()}`,
        sender: 'assistant',
        timestamp: new Date(),
        type: 'generating',
        text: '正在为您重构分离三维美食爆炸层级，这可能需要 5-15 秒，请稍候... ⏳'
      }
    ]);

    generateImages();
  };

  const resetAgentFlow = () => {
    setSelectedImages([]);
    setPreviewUrls([]);
    setResultImages([]);
    setAgentMessages([
      {
        id: 'welcome',
        sender: 'assistant',
        timestamp: new Date(),
        type: 'upload',
        text: '你好！我是您的**美食爆炸图 AI 助手**。我可以帮您把普通的菜品照片重构为悬浮、层级分明的**三维美食爆炸效果图**，并利用智能视觉网络自动识别食材添加图层标签。🍴\n\n请先点击下方上传您的菜品照片以开始制作：'
      }
    ]);
  };

  const resizeBase64Image = (base64Url: string, maxSide: number = 1024): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = base64Url;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxSide || height > maxSide) {
          if (width > height) {
            height = (height / width) * maxSide;
            width = maxSide;
          } else {
            width = (width / height) * maxSide;
            height = maxSide;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not get canvas context'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = (err) => reject(err);
    });
  };

  const detectLayers = async (base64Url: string) => {
    let base64Data = '';
    try {
      // 2K/4K base64 payloads are too large for Gemini API requests, so we compress them to a standard 1024px side first
      const resizedBase64 = await resizeBase64Image(base64Url, 1024);
      base64Data = resizedBase64.split(',')[1];
    } catch (e) {
      console.error("Failed to resize image for layer detection, falling back to original", e);
      base64Data = base64Url.split(',')[1];
    }

    const prompt = `You are an AI that analyzes food explosion diagrams. Look at the provided image and identify the dish name and the distinct vertical layers of food components floating in the air.
Return a JSON object with two properties:
1. 'dishName': A catchy, elegant Chinese name for this dish (e.g., '金汤肥牛', '招牌海鲜面').
2. 'layers': A JSON array of objects, ordered from top to bottom. Each object must have:
   - 'y': The approximate vertical center position of this layer, as a percentage from the top (0 to 100). For example, the top-most layer might be at 20, the middle at 50, the bottom bowl at 85.
   - 'name': A short, descriptive name for this layer in Chinese (e.g., '配菜', '主肉', '面条', '汤底', '碗').
Output ONLY valid JSON without markdown formatting, like: {"dishName": "招牌牛肉面", "layers": [{"y": 20, "name": "葱花"}, {"y": 50, "name": "面条"}, {"y": 80, "name": "碗"}]}`;

    let retries = 3;
    let delay = 2000;

    while (retries > 0) {
      try {
        const res = await fetch("/api/gemini", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           signal: abortControllerRef.current?.signal,
           body: JSON.stringify({
              model: "gemini-3-flash-preview",
              payload: {
                contents: {
                  parts: [
                    { inlineData: { data: base64Data, mimeType: 'image/jpeg' } },
                    { text: prompt }
                  ]
                }
              }
           })
        });
        if (!res.ok) {
           throw new Error("Layer detection failed");
        }
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || data.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        break; // Success, exit loop
      } catch (e: any) {
        console.error(`Layer detection failed (${4 - retries} attempt)`, e);
        if (e.message && (e.message.includes('503') || e.message.includes('UNAVAILABLE') || e.message.includes('high demand'))) {
          if (retries > 1) {
            console.log(`Retrying layer detection in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            retries--;
            delay *= 2;
          } else {
            break; // Out of retries
          }
        } else {
          break; // Not a 503 error, don't retry
        }
      }
    }
    return null;
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from<File>(e.target.files || []);
    addFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from<File>(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
    addFiles(files);
  };

  const addFiles = async (files: File[]) => {
    if (files.length > 0) {
      setIsCompressing(true);
      const file = files[0];
      
      try {
        const compressedBase64 = await compressImage(file);
        // Convert base64 back to File object to keep existing logic consistent
        const compressedFile = dataURLtoFile(compressedBase64, file.name);
        
        setSelectedImages([compressedFile]);
        setPreviewUrls([compressedBase64]);
        setResultImages([{}]);
        setError(null);

        // Advance chat in Agent Mode
        if (mode === 'agent') {
          setAgentMessages(prev => [
            ...prev,
            {
              id: `user-upload-${Date.now()}`,
              sender: 'user',
              text: `已上传菜品照片：「${file.name}」`,
              timestamp: new Date()
            },
            {
              id: `assistant-config-${Date.now()}`,
              sender: 'assistant',
              text: `菜品照片已确认！💡 接下来，请确认您期望的生成比例，然后点击下方的「🚀 开始生成爆炸图」：`,
              timestamp: new Date(),
              type: 'config'
            }
          ]);
        }
      } catch (err) {
        console.error("Compression error:", err);
        setError("图片处理失败，请稍后重试");
        if (mode === 'agent') {
          setAgentMessages(prev => [
            ...prev,
            {
              id: `assistant-err-${Date.now()}`,
              sender: 'assistant',
              text: `❌ 图片处理失败，请重新上传。`,
              timestamp: new Date()
            }
          ]);
        }
      } finally {
        setIsCompressing(false);
      }
    }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxSide = 1600;

          if (width > maxSide || height > maxSide) {
            if (width > height) {
              height = (height / width) * maxSide;
              width = maxSide;
            } else {
              width = (width / height) * maxSide;
              height = maxSide;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Could not get canvas context'));
          
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          resolve(compressed);
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const dataURLtoFile = (dataurl: string, filename: string) => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) return new File([], filename);
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
    setResultImages(prev => prev.filter((_, i) => i !== index));
    
    const shiftData = (prev: Record<string, any>) => {
      const next: Record<string, any> = {};
      Object.entries(prev).forEach(([key, value]) => {
        const [idxStr, ratio] = key.split('-');
        const idx = parseInt(idxStr, 10);
        if (idx < index) {
          next[key] = value;
        } else if (idx > index) {
          next[`${idx - 1}-${ratio}`] = value;
        }
      });
      return next;
    };
    
    setLayersData(shiftData);
    setDishNamesData(shiftData);
    setDishNameYData(shiftData);
    setDishNameSizeData(shiftData);
    setLayerNameSizeData(shiftData);
    setDefaultLayersData(shiftData);
    setDefaultDishNamesData(shiftData);
    setDefaultDishNameYData(shiftData);
    setDetectingLayers(shiftData);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const _generateImagesCore = async () => {
    if (selectedImages.length === 0 || selectedRatios.length === 0) return;

    abortControllerRef.current = new AbortController();

    if (saasData) {
      try {
        const verifyRes = await fetch('/api/tool/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: saasData.userId, toolId: saasData.toolId })
        });
        const verifyResult = await verifyRes.json();
        
        const verifyPts = verifyResult?.currentIntegral ?? verifyResult?.points ?? verifyResult?.balance ?? verifyResult?.remain ?? verifyResult?.data?.balance ?? verifyResult?.data?.points ?? verifyResult?.data?.currentIntegral;
        if (verifyPts !== undefined && verifyPts !== null) {
          window.dispatchEvent(new CustomEvent('update_points', { detail: { points: verifyPts } }));
        }

        if (!verifyResult.success && !verifyResult.valid) {
          throw new Error(verifyResult.message || "积分不足");
        }
      } catch (e: any) {
        setError(e.message || "积分校验网络错误");
        return;
      }
    }

    setIsGenerating(true);
    setError(null);

    try {
      const isNewGeneration = JSON.stringify(selectedRatios) !== JSON.stringify(generatedRatios) || selectedResolution !== generatedResolution;
      const newResults = isNewGeneration ? Array.from({ length: selectedImages.length }, () => ({})) : [...resultImages];
      
      if (isNewGeneration) {
        setResultImages(newResults);
        setGeneratedRatios([...selectedRatios]);
        setGeneratedResolution(selectedResolution);
      }

      for (let i = 0; i < selectedImages.length; i++) {
        setGeneratingIndex(i);
        const base64Data = await fileToBase64(selectedImages[i]);

        const saasPromptAdditions = saasData?.context || saasData?.prompt?.length ? `
--- SAAS 补充信息 ---
主体描述: ${saasData.context || '无'}
补充要求: ${saasData.prompt?.join(', ') || '无'}
` : '';

        const prompt = `[CRITICAL INSTRUCTION: HIGH-END COMMERCIAL FOOD EXPLOSION DIAGRAM]
You are an expert commercial food photographer. Create a spectacular "Explosion Diagram" (exploded view) of this food.

AESTHETIC & STYLE:
- Style: Hyper-realistic, glossy, mouth-watering commercial food photography.
- Background: Pure, solid pitch-black background.
- Lighting: Dramatic rim lighting highlighting the edges of the food, cinematic glowing effect.
- Dynamic Effects: MUST include rich rising steam/smoke, dramatic liquid splashes (like flying broth, oil, or sauce) forming a layer, and small flying particles (spice dust, droplets, crumbs) swirling around.

STRUCTURE & COMPOSITION (MAX 5 LAYERS) - TRAPEZOID SHAPE:
- OVERALL SHAPE: The entire composition MUST form a TRAPEZOID or SOFT PYRAMID shape. It should be narrower at the top and wider at the bottom, but DO NOT make the top too sharp or pointy. The top layer should still have a reasonable horizontal spread.
- NEGATIVE SPACE & CENTERING: The food composition MUST be strictly centered. You MUST leave generous empty negative space (pure black) on both the left and right sides of the image. The food should only occupy the middle 50-60% of the canvas width to ensure there is plenty of room for text labels on the sides.
- Separate the ingredients into distinct vertical layers floating in mid-air. Keep the layout highly organized, NOT chaotic.
- LAYER 1 (BOTTOM-MOST, WIDEST): The complete, finished dish in its bowl or plate. This must be the widest part of the image.
- LAYER 2 (IMMEDIATELY ABOVE THE DISH): Liquids/Sauces (e.g., dramatic broth, chili oil, or sauce splash). This MUST be the second layer from the bottom.
- UPPER LAYERS (LAYERS 3-5, NARROWING UPWARDS): Group similar items together on the same layer, but keep different categories strictly separated:
  * Main Ingredients (e.g., the primary meat, tofu, or noodles) MUST be on their own dedicated layer.
  * Side Ingredients (e.g., vegetables, potatoes, carrots) MUST be on their own dedicated layer.
  * Aromatics/Spices (e.g., scallions, ginger, garlic, chilies) can share the top-most layer. This top layer is the narrowest part, but MUST NOT be a single sharp point; spread the spices out horizontally a bit.

ABSOLUTE RULE - NO TEXT:
- You MUST NOT include any text, typography, Chinese characters, English letters, labels, arrows, or descriptions anywhere in the image. PURE VISUAL ONLY.${saasPromptAdditions}`;

        for (const ratio of selectedRatios) {
          if (!isNewGeneration && newResults[i]?.[ratio]) continue;
          
          setGeneratingRatio(ratio);
          
          let generatedUrl = null;
          let retries = 3;
          let delay = 2000;
          
          while (retries > 0) {
            try {
              const res = await fetch("/api/gemini", {
                 method: "POST",
                 headers: { "Content-Type": "application/json" },
                 signal: abortControllerRef.current?.signal,
                 body: JSON.stringify({
                    model: 'gemini-3.1-flash-image-preview',
                    payload: {
                      contents: {
                        parts: [
                          { inlineData: { data: base64Data, mimeType: selectedImages[i].type } },
                          { text: prompt }
                        ]
                      },
                      config: {
                        imageConfig: { aspectRatio: ratio, imageSize: selectedResolution }
                      }
                    }
                 })
              });
              if (!res.ok) {
                 const errData = await res.json();
                 throw new Error(errData.error || "Generation failed");
              }
              const data = await res.json();
              
              let extractedUrl = null;
              for (const candidate of data.candidates || []) {
                for (const part of candidate.content?.parts || []) {
                  if (part.inlineData) {
                    extractedUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                    break;
                  }
                }
                if (extractedUrl) break;
              }
              generatedUrl = extractedUrl;
              break;
            } catch (err: any) {
              const errorMessage = err.message || "";
              const is503 = errorMessage.includes("503") || errorMessage.includes("high demand") || errorMessage.includes("UNAVAILABLE");
              
              if (is503 && retries > 1) {
                console.log(`Server busy, retrying in ${delay}ms... (${retries - 1} retries left)`);
                await new Promise(resolve => setTimeout(resolve, delay));
                retries--;
                delay *= 2;
              } else {
                throw err;
              }
            }
          }

          if (!generatedUrl) {
            throw new Error(`第 ${i + 1} 张图片 (${ratio}) 生成失败，请重试。`);
          }

          setResultImages(prev => {
            const next = [...prev];
            next[i] = { ...next[i], [ratio]: generatedUrl };
            return next;
          });

          // Standard Save Flow for this specific image result
          if (saasData) {
            saveImageStandard({
              userId: saasData.userId,
              toolId: saasData.toolId,
              imageUrl: generatedUrl,
              fileName: `explosion-${Date.now()}-${i + 1}.png`
            }).then(saveRes => {
              if (saveRes.success && saveRes.currentIntegral !== undefined) {
                window.dispatchEvent(new CustomEvent('update_points', { detail: { points: saveRes.currentIntegral } }));
              }
            }).catch(err => console.error("Save image failed:", err));
          }

          setDetectingLayers(prev => ({ ...prev, [`${i}-${ratio}`]: true }));
          try {
            const detected = await detectLayers(generatedUrl);
            if (detected && detected.layers) {
              setDefaultLayersData(prev => ({ ...prev, [`${i}-${ratio}`]: detected.layers }));
              setDefaultDishNamesData(prev => ({ ...prev, [`${i}-${ratio}`]: detected.dishName || '招牌美食' }));
              setDefaultDishNameYData(prev => ({ ...prev, [`${i}-${ratio}`]: 5 }));

              // 自动填写：使检测到的图层与菜品名在页面上自动呈现并处于可编辑状态
              setLayersData(prev => ({ ...prev, [`${i}-${ratio}`]: detected.layers }));
              setDishNamesData(prev => ({ ...prev, [`${i}-${ratio}`]: detected.dishName || '招牌美食' }));
              setDishNameYData(prev => ({ ...prev, [`${i}-${ratio}`]: 5 }));
              setDishNameSizeData(prev => ({ ...prev, [`${i}-${ratio}`]: 100 }));
              setLayerNameSizeData(prev => ({ ...prev, [`${i}-${ratio}`]: 100 }));
            }
          } catch (e) {
            console.error("Failed to detect layers", e);
          } finally {
            setDetectingLayers(prev => ({ ...prev, [`${i}-${ratio}`]: false }));
          }
        }
      }

    } catch (err: any) {
      if (err.name === 'AbortError') {
        setIsGenerating(false);
        setGeneratingIndex(-1);
        setGeneratingRatio(null);
        return;
      }
      console.error("Generation error:", err);
      let errorMessage = err.message || "生成图片时出错，请重试。";
      
      if (errorMessage.includes("503") || errorMessage.includes("high demand") || errorMessage.includes("UNAVAILABLE")) {
        errorMessage = "当前 AI 模型使用人数过多，服务器繁忙。这通常是暂时的，请稍等片刻后再次点击生成。";
      } else if (errorMessage.includes("429") || errorMessage.includes("quota")) {
        errorMessage = "请求过于频繁或配额已耗尽，请稍后再试。";
      }
      
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
      setGeneratingIndex(-1);
      setGeneratingRatio(null);
    }
  };

  const generateImages = () => {
    const p = _generateImagesCore();
    generationPromiseRef.current = p;
    return p;
  };

  const downloadImageWithLabels = async (url: string, index: number, ratio: string, customLayers?: Layer[], customDishName?: string) => {
    const layers = customLayers !== undefined ? customLayers : layersData[`${index}-${ratio}`];
    const dishName = customDishName !== undefined ? customDishName : (dishNamesData[`${index}-${ratio}`] || '');
    const dishNameY = dishNameYData[`${index}-${ratio}`] ?? defaultDishNameYData[`${index}-${ratio}`] ?? 5;
    const dishNameSize = dishNameSizeData[`${index}-${ratio}`] ?? 100;
    const layerNameSize = layerNameSizeData[`${index}-${ratio}`] ?? 100;
    
    if ((!layers || layers.length === 0) && !dishName) {
      const a = document.createElement('a');
      a.href = url;
      a.download = `food-explosion-${index + 1}-${ratio.replace(':', 'x')}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    await new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(img, 0, 0);
    
    if (dishName) {
      const titleFontSize = Math.max(50, img.width * 0.11) * (dishNameSize / 100);
      ctx.font = `${titleFontSize}px "龚帆怒放体", "Gongfan Nufang", "Zhi Mang Xing", "STXingkai", "华文行楷", cursive`;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'center';
      
      const titleY = img.height * (dishNameY / 100);
      const titleX = img.width / 2;
      
      const titleGradient = ctx.createLinearGradient(0, titleY, 0, titleY + titleFontSize);
      titleGradient.addColorStop(0, '#FFFFFF');
      titleGradient.addColorStop(0.5, '#E5E5E5');
      titleGradient.addColorStop(1, '#A3A3A3');
      
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
      
      ctx.fillStyle = titleGradient;
      ctx.fillText(dishName, titleX, titleY);
      
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
    
    if (layers && layers.length > 0) {
      const fontSize = Math.max(28, img.width * 0.045) * (layerNameSize / 100);
      ctx.font = `${fontSize}px "STKaiti", "华文楷体", "Long Cang", "Ma Shan Zheng", serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      
      layers.forEach(layer => {
      const yPos = (layer.y / 100) * img.height;
      const text = layer.name;
      const textX = img.width * 0.04; // 4% from left edge
      
      // Golden gradient for text
      const gradient = ctx.createLinearGradient(0, yPos - fontSize, 0, yPos + fontSize);
      gradient.addColorStop(0, '#FFFFFF');
      gradient.addColorStop(0.4, '#E5E5E5');
      gradient.addColorStop(1, '#A3A3A3');

      // Shadow for readability and "art" feel
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      ctx.fillStyle = gradient;
      ctx.fillText(text, textX, yPos);

      // Reset shadow for the line
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      const textMetrics = ctx.measureText(text);
      const lineStartX = textX + textMetrics.width + (img.width * 0.01);
      const lineEndX = img.width * 0.32; // Stop at 32% to avoid covering food

      if (lineStartX < lineEndX) {
        const lineLength = lineEndX - lineStartX;
        
        // Artistic golden brush gradient
        const grad = ctx.createLinearGradient(lineStartX, yPos, lineEndX, yPos);
        grad.addColorStop(0, 'rgba(115, 115, 115, 0)');
        grad.addColorStop(0.4, 'rgba(163, 163, 163, 0.8)');
        grad.addColorStop(1, 'rgba(212, 212, 212, 1)');
        
        ctx.fillStyle = grad;
        const lineHeight = Math.max(2, img.width * 0.003);
        ctx.fillRect(lineStartX, yPos - lineHeight/2, lineLength, lineHeight);

        // Glowing diamond head
        const diamondSize = Math.max(6, img.width * 0.012);
        ctx.save();
        ctx.translate(lineEndX, yPos);
        ctx.rotate(Math.PI / 4);
        
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
        ctx.shadowBlur = Math.max(10, img.width * 0.01);
        
        const diamondGrad = ctx.createLinearGradient(-diamondSize/2, -diamondSize/2, diamondSize/2, diamondSize/2);
        diamondGrad.addColorStop(0, '#FFFFFF');
        diamondGrad.addColorStop(1, '#D4D4D4');
        
        ctx.fillStyle = diamondGrad;
        ctx.fillRect(-diamondSize/2, -diamondSize/2, diamondSize, diamondSize);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = Math.max(1, img.width * 0.001);
        ctx.strokeRect(-diamondSize/2, -diamondSize/2, diamondSize, diamondSize);
        
        ctx.restore();
      }
    });
    }

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `food-explosion-${index + 1}-${ratio.replace(':', 'x')}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAll = () => {
    resultImages.forEach((res, index) => {
      Object.entries(res).forEach(([ratio, url]) => {
        if (url) downloadImageWithLabels(url as string, index, ratio);
      });
    });
  };

  const allGenerated = resultImages.length > 0 && resultImages.every(res => selectedRatios.every(r => res[r]));
  const hasResults = resultImages.some(res => Object.values(res).some(url => url !== null));
  const [editW, editH] = editingLabel ? editingLabel.ratio.split(':').map(Number) : [1, 1];

  if (mode === 'agent') {
    return (
      <div className="flex-1 flex flex-col h-full min-h-0 bg-white relative">
        {/* Hidden file input always in the DOM at the root level so that the ref current is never null */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleImageSelect} 
          accept="image/*" 
          className="hidden" 
        />
        
        {/* Chat Room Header */}
        <div className="bg-brand-sand/40 px-6 py-4 border-b border-neutral-200/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-brand-sage text-white rounded-full flex items-center justify-center shadow-lg shadow-brand-sage/10 font-bold">
                <Bot className="w-5 h-5" />
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-ping"></span>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-neutral-800">AI 爆炸图视觉大师</h3>
              <p className="text-[10px] text-neutral-400">为您构建三维层级与图层标签</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={resetAgentFlow} 
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-brand-sage bg-white border border-neutral-200 px-3 py-1.5 rounded-xl hover:shadow-sm active:scale-95 transition-all"
              title="重置对话"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>全新制作</span>
            </button>
            <button 
              onClick={() => onChangeTab?.('choice')} 
              className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 bg-white border border-neutral-200 px-3 py-1.5 rounded-xl hover:shadow-sm active:scale-95 transition-all"
              title="返回选择"
            >
              <Home className="w-3.5 h-3.5" />
              <span>返回选择</span>
            </button>
          </div>
        </div>

        {/* Chat Flow Scroll Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-neutral-50/50">
          {agentMessages.map((msg, index) => {
            const isAssistant = msg.sender === 'assistant';
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm text-xs font-bold ${
                  isAssistant ? 'bg-brand-sage text-white' : 'bg-brand-amber/10 text-brand-amber'
                }`}>
                  {isAssistant ? <Bot className="w-4 h-4" /> : 'ME'}
                </div>

                {/* Chat Bubble */}
                <div className="flex flex-col max-w-[85%] space-y-2">
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    isAssistant 
                      ? msg.type === 'error'
                        ? 'bg-red-50 text-red-800 border border-red-100'
                        : 'bg-white text-neutral-800 border border-neutral-200/60' 
                      : 'bg-brand-sage text-white'
                  }`}>
                    {/* Render text */}
                    <div className="whitespace-pre-wrap">
                      {renderFormattedText(msg.text)}
                    </div>

                    {/* Interactive Elements */}
                    {isAssistant && msg.type === 'upload' && (
                      <div className="mt-4">
                        <div 
                          onClick={() => !isGenerating && fileInputRef.current?.click()}
                          className="border-2 border-dashed border-neutral-200 hover:border-brand-sage/50 bg-neutral-50 hover:bg-brand-sand/20 rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center gap-2"
                        >
                          <Upload className="w-8 h-8 text-brand-sage animate-bounce" />
                          <span className="font-bold text-neutral-800 text-xs">点击或拖拽您的菜品原图</span>
                          <span className="text-[10px] text-neutral-400">支持常用图片格式，前端智能无损压缩</span>
                        </div>
                        
                        {previewUrls[0] && (
                          <div className="mt-3 relative w-32 aspect-square rounded-xl overflow-hidden border border-neutral-200 shadow-sm bg-brand-sand flex items-center justify-center">
                            <img src={previewUrls[0]} alt="Preview" className="w-full h-full object-cover" />
                            <div className="absolute top-1 right-1">
                              <button 
                                onClick={() => removeImage(0)}
                                className="p-1.5 bg-white/90 rounded-lg shadow text-neutral-400 hover:text-red-500"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {isAssistant && msg.type === 'config' && (
                      <div className="mt-4 space-y-4 bg-neutral-50 p-4 rounded-xl border border-neutral-200/50">
                        {/* Ratios selection */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">选择输出比例 (单选)</span>
                          <div className="flex flex-wrap gap-1.5">
                            {RATIOS.map(ratio => {
                              const isActive = selectedRatios.includes(ratio.id);
                              return (
                                <button
                                  key={ratio.id}
                                  onClick={() => setSelectedRatios([ratio.id])}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                    isActive 
                                      ? 'bg-brand-sage text-white border-brand-sage shadow-md' 
                                      : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                                  }`}
                                >
                                  {ratio.name} ({ratio.desc})
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Resolution selection */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">画质选择</span>
                          <div className="flex flex-wrap gap-1.5">
                            {RESOLUTIONS.map(res => {
                              const isActive = selectedResolution === res.id;
                              return (
                                <button
                                  key={res.id}
                                  onClick={() => setSelectedResolution(res.id)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                    isActive 
                                      ? 'bg-brand-sage text-white border-brand-sage shadow-md' 
                                      : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                                  }`}
                                >
                                  {res.id} ({res.desc})
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Generation trigger */}
                        <button
                          onClick={startAgentGeneration}
                          disabled={isGenerating}
                          className="w-full py-3 bg-brand-sage hover:bg-brand-sage-dark text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                          {isGenerating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Layers className="w-4 h-4" />
                          )}
                          <span>🚀 开始生成爆炸图</span>
                        </button>
                      </div>
                    )}

                    {isAssistant && msg.type === 'generating' && (
                      <div className="mt-4 p-4 bg-brand-sand/20 rounded-xl border border-brand-sand/40 space-y-3">
                        <div className="flex items-center gap-3">
                          <Loader2 className="w-5 h-5 text-brand-sage animate-spin shrink-0" />
                          <span className="text-xs font-bold text-brand-sage animate-pulse">{loadingMessages[loadingStep]}</span>
                        </div>
                        <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-brand-sage"
                            animate={{ width: ["0%", "95%"] }}
                            transition={{ duration: 12, ease: "easeInOut" }}
                          />
                        </div>
                      </div>
                    )}

                    {isAssistant && msg.type === 'result' && (msg.payload?.images || (resultImages.length > 0 && resultImages[0])) && (
                      <div className="mt-4 space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                          {Object.entries(msg.payload?.images || resultImages[0]).map(([ratio, url]) => {
                            if (!url) return null;
                            const imageUrl = url as string;
                            const layers = msg.payload?.layers?.[ratio] || layersData[`0-${ratio}`] || [];
                            const dishName = msg.payload?.dishNames?.[ratio] || dishNamesData[`0-${ratio}`] || '';
                            return (
                              <div key={ratio} className="bg-neutral-50 p-3 rounded-2xl border border-neutral-100 flex flex-col gap-3">
                                <div className="text-[9px] font-bold text-neutral-400 tracking-wider flex items-center justify-between">
                                  <span>美食爆炸大片 ({ratio})</span>
                                  <span className="text-brand-sage font-medium flex items-center gap-0.5">💡 点击图片预览放大</span>
                                </div>
                                <div 
                                  className="relative aspect-square rounded-xl overflow-hidden border border-neutral-200/50 shadow bg-white flex items-center justify-center cursor-zoom-in group"
                                  onClick={() => setZoomedImage(imageUrl)}
                                >
                                  <img src={imageUrl} alt="Exploded view" className="max-w-full max-h-full object-contain transition-transform duration-300 group-hover:scale-102" />
                                  {/* Zoom hover overlay */}
                                  <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                    <div className="bg-white/90 p-2.5 rounded-full shadow-lg text-neutral-800 flex items-center gap-1 text-xs font-bold transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                      <ImageIcon className="w-4 h-4" />
                                      <span>点击放大预览</span>
                                    </div>
                                  </div>
                                  <div className="absolute bottom-2 right-2 flex gap-1 z-10" onClick={(e) => e.stopPropagation()}>
                                    <button 
                                      onClick={() => downloadImageWithLabels(imageUrl, 0, ratio, layers, dishName)}
                                      className="bg-white/95 text-brand-sage p-2 rounded-lg border border-neutral-200 hover:bg-brand-sand transition-all shadow"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Auto-detected layer list preview inside bubble */}
                                <div className="bg-white p-3 rounded-xl border border-neutral-200/50 space-y-2">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-700">
                                    <Tag className="w-3.5 h-3.5 text-brand-sage" />
                                    <span>智能识别标签：{dishName || '招牌美食'}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {layers.map((l: any, i: number) => (
                                      <span key={i} className="px-2 py-1 bg-brand-sand text-brand-sage text-[10px] font-semibold rounded-lg border border-brand-sage/15">
                                        {l.name}
                                      </span>
                                    ))}
                                  </div>
                                  <p className="text-[10px] text-neutral-400 leading-normal">
                                    💡 如果需要调整图层位置、微调标签文字，可以随时点击上方「专家模式」！
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => {
                              const imgs = msg.payload?.images || resultImages[0];
                              if (imgs) {
                                Object.entries(imgs).forEach(([ratio, url]) => {
                                  if (url) {
                                    const layers = msg.payload?.layers?.[ratio] || layersData[`0-${ratio}`] || [];
                                    const dishName = msg.payload?.dishNames?.[ratio] || dishNamesData[`0-${ratio}`] || '';
                                    downloadImageWithLabels(url as string, 0, ratio, layers, dishName);
                                  }
                                });
                              }
                            }}
                            className="flex-1 py-2.5 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                          >
                            <Download className="w-4 h-4" />
                            <span>打包保存到本地</span>
                          </button>
                          <button
                            onClick={resetAgentFlow}
                            className="flex-1 py-2.5 bg-brand-sand text-brand-sage hover:bg-brand-sand-dark rounded-xl text-xs font-bold transition-all border border-brand-sage/10 flex items-center justify-center gap-1.5"
                          >
                            <Sparkles className="w-4 h-4" />
                            <span>继续制作新美食</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <span className="text-[9px] text-neutral-400 px-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </motion.div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Bottom Chat Bar */}
        <div className="bg-white px-4 py-3.5 border-t border-neutral-200/60 flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isAiResponding && handleSendMessage()}
            placeholder="您可以输入例如：“生成一张16:9的爆炸图，并设置标签为烤肉、生菜、洋葱。”"
            className="flex-1 bg-neutral-100 rounded-xl px-4 py-3 text-sm border-0 focus:ring-2 focus:ring-brand-sage/30 placeholder-neutral-400 focus:outline-none transition-all"
            disabled={isAiResponding}
          />
          <button
            onClick={() => !isAiResponding && handleSendMessage()}
            disabled={isAiResponding || !chatInput.trim()}
            className={`p-3 rounded-xl shadow-lg shadow-brand-sage/15 flex items-center justify-center transition-all active:scale-95 shrink-0 ${
              chatInput.trim() && !isAiResponding
                ? 'bg-brand-sage text-white hover:bg-brand-sage-dark'
                : 'bg-neutral-100 text-neutral-400 shadow-none'
            }`}
          >
            {isAiResponding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Zoomed Image modal */}
        <AnimatePresence>
          {zoomedImage && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setZoomedImage(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[99999] p-4 cursor-zoom-out"
            >
              <div className="relative max-w-5xl max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                <img src={zoomedImage} alt="Zoomed" className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl" />
                <button 
                  onClick={() => setZoomedImage(null)}
                  className="absolute -top-12 right-0 text-white hover:text-neutral-300 flex items-center gap-1 text-xs font-semibold bg-white/10 px-3 py-1.5 rounded-xl border border-white/20 transition-all active:scale-95"
                >
                  <X className="w-4 h-4" />
                  <span>关闭预览</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-brand-paper text-neutral-900 font-sans selection:bg-brand-sage/20">
      {/* Hidden file input always in the DOM at the root level so that the ref current is never null */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImageSelect} 
        accept="image/*" 
        className="hidden" 
      />
      <header className="bg-brand-sand border-b border-neutral-200/60 shrink-0 hidden lg:block">
        <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-brand-sage p-2.5 rounded-xl text-white shadow-lg shadow-brand-sage/20">
                <Layers className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight font-display">美食爆炸图</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 min-h-0 flex flex-col">
        {(mode as string) === 'agent' ? (
          /* Agent Mode Conversational Layout */
          <div className="flex-1 max-w-4xl w-full mx-auto flex flex-col h-[calc(100vh-140px)] min-h-[450px] bg-white rounded-3xl border border-neutral-200/50 shadow-xl overflow-hidden self-center my-auto">
            {/* Chat Room Header */}
            <div className="bg-brand-sand/40 px-6 py-4 border-b border-neutral-200/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-brand-sage text-white rounded-full flex items-center justify-center shadow-lg shadow-brand-sage/10 font-bold">
                    <Bot className="w-5 h-5" />
                  </div>
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-ping"></span>
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-neutral-800">AI 爆炸图视觉大师</h3>
                  <p className="text-[10px] text-neutral-400">为您构建三维层级与图层标签</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={resetAgentFlow} 
                  className="flex items-center gap-1 text-xs text-neutral-500 hover:text-brand-sage bg-white border border-neutral-200 px-3 py-1.5 rounded-xl hover:shadow-sm active:scale-95 transition-all"
                  title="重置对话"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>全新制作</span>
                </button>
                <button 
                  onClick={() => onChangeTab?.('choice')} 
                  className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 bg-white border border-neutral-200 px-3 py-1.5 rounded-xl hover:shadow-sm active:scale-95 transition-all"
                  title="返回选择"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>返回选择</span>
                </button>
              </div>
            </div>

            {/* Chat Flow Scroll Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-neutral-50/50">
              {agentMessages.map((msg, index) => {
                const isAssistant = msg.sender === 'assistant';
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm text-xs font-bold ${
                      isAssistant ? 'bg-brand-sage text-white' : 'bg-brand-amber/10 text-brand-amber'
                    }`}>
                      {isAssistant ? <Bot className="w-4 h-4" /> : 'ME'}
                    </div>

                    {/* Chat Bubble */}
                    <div className="flex flex-col max-w-[85%] space-y-2">
                      <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                        isAssistant 
                          ? msg.type === 'error'
                            ? 'bg-red-50 text-red-800 border border-red-100'
                            : 'bg-white text-neutral-800 border border-neutral-200/60' 
                          : 'bg-brand-sage text-white'
                      }`}>
                        {/* Render text */}
                        <div className="whitespace-pre-wrap">
                          {renderFormattedText(msg.text)}
                        </div>

                        {/* Interactive Elements */}
                        {isAssistant && msg.type === 'upload' && (
                          <div className="mt-4">
                            <div 
                              onClick={() => !isGenerating && fileInputRef.current?.click()}
                              className="border-2 border-dashed border-neutral-200 hover:border-brand-sage/50 bg-neutral-50 hover:bg-brand-sand/20 rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center gap-2"
                            >
                              <Upload className="w-8 h-8 text-brand-sage animate-bounce" />
                              <span className="font-bold text-neutral-800 text-xs">点击或拖拽您的菜品原图</span>
                              <span className="text-[10px] text-neutral-400">支持常用图片格式，前端智能无损压缩</span>
                            </div>
                            
                            {previewUrls[0] && (
                              <div className="mt-3 relative w-32 aspect-square rounded-xl overflow-hidden border border-neutral-200 shadow-sm bg-brand-sand flex items-center justify-center">
                                <img src={previewUrls[0]} alt="Preview" className="w-full h-full object-cover" />
                                <div className="absolute top-1 right-1">
                                  <button 
                                    onClick={() => removeImage(0)}
                                    className="p-1.5 bg-white/90 rounded-lg shadow text-neutral-400 hover:text-red-500"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {isAssistant && msg.type === 'config' && (
                          <div className="mt-4 space-y-4 bg-neutral-50 p-4 rounded-xl border border-neutral-200/50">
                            {/* Ratios selection */}
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">选择输出比例 (单选)</span>
                              <div className="flex flex-wrap gap-1.5">
                                {RATIOS.map(ratio => {
                                  const isActive = selectedRatios.includes(ratio.id);
                                  return (
                                    <button
                                      key={ratio.id}
                                      onClick={() => setSelectedRatios([ratio.id])}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                        isActive 
                                          ? 'bg-brand-sage text-white border-brand-sage shadow-md' 
                                          : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                                      }`}
                                    >
                                      {ratio.name} ({ratio.desc})
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Resolution selection */}
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">画质选择</span>
                              <div className="flex flex-wrap gap-1.5">
                                {RESOLUTIONS.map(res => {
                                  const isActive = selectedResolution === res.id;
                                  return (
                                    <button
                                      key={res.id}
                                      onClick={() => setSelectedResolution(res.id)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                        isActive 
                                          ? 'bg-brand-sage text-white border-brand-sage shadow-md' 
                                          : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                                      }`}
                                    >
                                      {res.id} ({res.desc})
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Generation trigger */}
                            <button
                              onClick={startAgentGeneration}
                              disabled={isGenerating}
                              className="w-full py-3 bg-brand-sage hover:bg-brand-sage-dark text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                              {isGenerating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Layers className="w-4 h-4" />
                              )}
                              <span>🚀 开始生成爆炸图</span>
                            </button>
                          </div>
                        )}

                        {isAssistant && msg.type === 'generating' && (
                          <div className="mt-4 p-4 bg-brand-sand/20 rounded-xl border border-brand-sand/40 space-y-3">
                            <div className="flex items-center gap-3">
                              <Loader2 className="w-5 h-5 text-brand-sage animate-spin shrink-0" />
                              <span className="text-xs font-bold text-brand-sage animate-pulse">{loadingMessages[loadingStep]}</span>
                            </div>
                            <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                              <motion.div 
                                className="h-full bg-brand-sage"
                                animate={{ width: ["0%", "95%"] }}
                                transition={{ duration: 12, ease: "easeInOut" }}
                              />
                            </div>
                          </div>
                        )}

                        {isAssistant && msg.type === 'result' && (msg.payload?.images || (resultImages.length > 0 && resultImages[0])) && (
                          <div className="mt-4 space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                              {Object.entries(msg.payload?.images || resultImages[0]).map(([ratio, url]) => {
                                if (!url) return null;
                                const imageUrl = url as string;
                                const layers = msg.payload?.layers?.[ratio] || layersData[`0-${ratio}`] || [];
                                const dishName = msg.payload?.dishNames?.[ratio] || dishNamesData[`0-${ratio}`] || '';
                                return (
                                  <div key={ratio} className="bg-neutral-50 p-3 rounded-2xl border border-neutral-100 flex flex-col gap-3">
                                    <div className="text-[9px] font-bold text-neutral-400 tracking-wider flex items-center justify-between">
                                      <span>美食爆炸大片 ({ratio})</span>
                                      <span className="text-brand-sage font-medium flex items-center gap-0.5">💡 点击图片预览放大</span>
                                    </div>
                                    <div 
                                      className="relative aspect-square rounded-xl overflow-hidden border border-neutral-200/50 shadow bg-white flex items-center justify-center cursor-zoom-in group"
                                      onClick={() => setZoomedImage(imageUrl)}
                                    >
                                      <img src={imageUrl} alt="Exploded view" className="max-w-full max-h-full object-contain transition-transform duration-300 group-hover:scale-102" />
                                      {/* Zoom hover overlay */}
                                      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                        <div className="bg-white/90 p-2.5 rounded-full shadow-lg text-neutral-800 flex items-center gap-1 text-xs font-bold transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                          <ImageIcon className="w-4 h-4" />
                                          <span>点击放大预览</span>
                                        </div>
                                      </div>
                                      <div className="absolute bottom-2 right-2 flex gap-1 z-10" onClick={(e) => e.stopPropagation()}>
                                        <button 
                                          onClick={() => downloadImageWithLabels(imageUrl, 0, ratio, layers, dishName)}
                                          className="bg-white/95 text-brand-sage p-2 rounded-lg border border-neutral-200 hover:bg-brand-sand transition-all shadow"
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Auto-detected layer list preview inside bubble */}
                                    <div className="bg-white p-3 rounded-xl border border-neutral-200/50 space-y-2">
                                      <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-700">
                                        <Tag className="w-3.5 h-3.5 text-brand-sage" />
                                        <span>智能识别标签：{dishName || '招牌美食'}</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1">
                                        {layers.map((l: any, i: number) => (
                                          <span key={i} className="px-2 py-1 bg-brand-sand text-brand-sage text-[10px] font-semibold rounded-lg border border-brand-sage/15">
                                            {l.name}
                                          </span>
                                        ))}
                                      </div>
                                      <p className="text-[10px] text-neutral-400 leading-normal">
                                        💡 如果需要调整图层位置、微调标签文字，可以随时点击上方「专家模式」！
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2">
                              <button
                                onClick={() => {
                                  const imgs = msg.payload?.images || resultImages[0];
                                  if (imgs) {
                                    Object.entries(imgs).forEach(([ratio, url]) => {
                                      if (url) {
                                        const layers = msg.payload?.layers?.[ratio] || layersData[`0-${ratio}`] || [];
                                        const dishName = msg.payload?.dishNames?.[ratio] || dishNamesData[`0-${ratio}`] || '';
                                        downloadImageWithLabels(url as string, 0, ratio, layers, dishName);
                                      }
                                    });
                                  }
                                }}
                                className="flex-1 py-2.5 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                              >
                                <Download className="w-4 h-4" />
                                <span>打包保存到本地</span>
                              </button>
                              <button
                                onClick={resetAgentFlow}
                                className="flex-1 py-2.5 bg-brand-sand text-brand-sage hover:bg-brand-sand-dark rounded-xl text-xs font-bold transition-all border border-brand-sage/10 flex items-center justify-center gap-1.5"
                              >
                                <Sparkles className="w-4 h-4" />
                                <span>重新开始制作</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <span className="text-[9px] text-neutral-400 px-1">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Bottom Chat Bar */}
            <div className="bg-white px-4 py-3.5 border-t border-neutral-200/60 flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isAiResponding && handleSendMessage()}
                placeholder="您可以输入例如：“帮我制作1:1的方形爆炸图。”"
                className="flex-1 bg-neutral-100 rounded-xl px-4 py-3 text-sm border-0 focus:ring-2 focus:ring-brand-sage/30 placeholder-neutral-400 focus:outline-none transition-all"
                disabled={isAiResponding}
              />
              <button
                onClick={() => !isAiResponding && handleSendMessage()}
                disabled={isAiResponding || !chatInput.trim()}
                className={`p-3 rounded-xl shadow-lg shadow-brand-sage/15 flex items-center justify-center transition-all active:scale-95 ${
                  chatInput.trim() && !isAiResponding
                    ? 'bg-brand-sage text-white hover:bg-brand-sage-dark'
                    : 'bg-neutral-100 text-neutral-400 shadow-none'
                }`}
              >
                {isAiResponding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Expert Mode (The original columns grid layout) */
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 h-full">
          
          {/* Left Column: Controls */}
          <div className="space-y-6 lg:col-span-4 xl:col-span-3 lg:overflow-y-auto lg:pr-2 lg:pb-4 shrink-0">
            <section className="bg-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl shadow-sm border border-neutral-200/50">
              <div className="flex items-center justify-between mb-4 sm:mb-5">
                <h2 className="text-base sm:text-lg font-bold font-display">1. 上传菜品照片</h2>
                <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-widest">{selectedImages.length > 0 ? 'READY' : 'EMPTY'}</span>
              </div>
              
              <div 
                className={`border-2 border-dashed rounded-xl sm:rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer
                  ${isGenerating ? 'opacity-50 pointer-events-none' : 'border-neutral-200 hover:border-brand-sage/50 hover:bg-brand-sand/30'}`}
                onClick={() => !isGenerating && fileInputRef.current?.click()}
                onDrop={!isGenerating ? handleDrop : undefined}
                onDragOver={handleDragOver}
              >
                {previewUrls[0] ? (
                  <div className="relative w-full aspect-[4/3] group cursor-default">
                    <img src={previewUrls[0]} alt="Preview" className="w-full h-full object-contain bg-brand-sand" />
                    <div 
                      className="absolute inset-0 bg-brand-sage/40 backdrop-blur-[2px] opacity-0 lg:group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                      onClick={() => !isGenerating && fileInputRef.current?.click()}
                    >
                      <div className="bg-white/90 text-brand-sage px-5 py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold shadow-xl shadow-brand-sage/20 transition-transform hover:scale-105">
                        点击更换图片
                      </div>
                    </div>
                    {!isGenerating && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(0);
                        }}
                        className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 bg-white/90 text-neutral-400 p-2 rounded-lg sm:rounded-xl lg:opacity-0 lg:group-hover:opacity-100 transition-all hover:text-red-500 hover:bg-white shadow-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-6 sm:p-10 text-center">
                    <div className="flex flex-col items-center justify-center py-4 sm:py-6">
                      <div className="bg-brand-sand p-4 sm:p-5 rounded-xl sm:rounded-2xl text-brand-sage mb-4 sm:mb-5 shadow-inner">
                        <Plus className="w-6 h-6 sm:w-8 sm:h-8" />
                      </div>
                      <p className="text-neutral-800 text-sm sm:text-base font-bold mb-1 font-display">上传菜品原图</p>
                      <p className="text-neutral-400 text-[10px] sm:text-xs px-2 sm:px-4 leading-relaxed">支持 JPG, PNG, WebP，最大 20MB</p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="bg-white p-7 rounded-3xl shadow-sm border border-neutral-200/50">
              <h2 className="text-lg font-bold font-display mb-5">2. 输出比例</h2>
              <div className="grid grid-cols-2 gap-3">
                {RATIOS.map((ratio) => {
                  const isSelected = selectedRatios.includes(ratio.id);
                  return (
                    <button
                      key={ratio.id}
                      onClick={() => {
                        setSelectedRatios(prev => 
                          prev.includes(ratio.id) 
                            ? prev.filter(r => r !== ratio.id)
                            : [...prev, ratio.id]
                        );
                      }}
                      disabled={isGenerating}
                      className={`text-center p-4 rounded-2xl border-2 transition-all duration-300 ${
                        isSelected
                          ? 'border-brand-sage bg-brand-sage text-white shadow-lg shadow-brand-sage/20 font-bold' 
                          : 'border-neutral-100 bg-brand-sand/30 hover:border-neutral-200 hover:bg-white text-neutral-500 font-medium'
                      } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="text-sm">{ratio.name}</div>
                      <div className={`text-[10px] uppercase tracking-tighter mt-1 ${isSelected ? 'text-white/60' : 'text-neutral-400'}`}>{ratio.desc}</div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="bg-white p-7 rounded-3xl shadow-sm border border-neutral-200/50">
              <h2 className="text-lg font-bold font-display mb-5">3. 清晰度</h2>
              <div className="grid grid-cols-3 gap-3">
                {RESOLUTIONS.map((res) => (
                  <button
                    key={res.id}
                    onClick={() => setSelectedResolution(res.id)}
                    disabled={isGenerating}
                    className={`text-center p-3.5 rounded-2xl border-2 transition-all duration-300 ${
                      selectedResolution === res.id 
                        ? 'border-brand-sage bg-brand-sage text-white shadow-lg shadow-brand-sage/20 font-bold' 
                        : 'border-neutral-100 bg-brand-sand/30 hover:border-neutral-200 hover:bg-white text-neutral-500 font-medium'
                    } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="text-sm">{res.name}</div>
                  </button>
                ))}
              </div>
            </section>

            <button
              onClick={generateImages}
              disabled={selectedImages.length === 0 || selectedRatios.length === 0 || isGenerating || isCompressing || (allGenerated && JSON.stringify(selectedRatios) === JSON.stringify(generatedRatios) && selectedResolution === generatedResolution)}
              className="w-full bg-brand-sage hover:bg-brand-sage/90 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed text-white font-bold py-5 px-6 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 shadow-xl shadow-brand-sage/30 hover:translate-y-[-2px] active:scale-[0.98]"
            >
              {isCompressing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  正在压缩图片...
                </>
              ) : isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  释放极客创意中...
                </>
              ) : (JSON.stringify(selectedRatios) !== JSON.stringify(generatedRatios) || selectedResolution !== generatedResolution) && hasResults ? (
                <>
                  <Layers className="w-5 h-5" />
                  更新视觉重新生成
                </>
              ) : allGenerated ? (
                <>
                  <ImageIcon className="w-5 h-5" />
                  生成已完成
                </>
              ) : (
                <>
                  <Layers className="w-5 h-5" />
                  生成爆炸图
                </>
              )}
            </button>
            
            {error && (
              <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Right Column: Result */}
          <div className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-[2rem] shadow-xl shadow-brand-sand/50 border border-neutral-200/50 flex flex-col lg:col-span-8 xl:col-span-9 min-h-[400px] lg:min-h-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 shrink-0">
              <div className="flex flex-col md:flex-row md:items-center gap-2 sm:gap-4">
                <h2 className="text-xl sm:text-2xl font-bold font-display text-neutral-900">生成爆炸图结果</h2>
                {hasResults && (
                  <span className="text-[9px] sm:text-[10px] font-bold text-brand-sage bg-brand-sand border border-brand-sage/20 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full flex items-center gap-1.5 sm:gap-2 uppercase tracking-widest shadow-sm w-fit">
                    <Tag className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    Interactive: 点击图片右下角标签可编辑
                  </span>
                )}
              </div>
              {hasResults && (
                <button 
                  onClick={downloadAll}
                  className="text-xs sm:text-sm font-bold text-brand-sage hover:text-brand-sage/80 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl sm:rounded-2xl bg-brand-sand/50 hover:bg-brand-sand transition-all shadow-sm w-full sm:w-auto"
                >
                  <Download className="w-4 h-4" />
                  保存所有创意
                </button>
              )}
            </div>
            
            <div className={`flex-1 bg-brand-sand/50 rounded-2xl sm:rounded-3xl border border-neutral-200 relative flex flex-col min-h-0 ${selectedImages.length > 0 ? 'p-4 sm:p-8' : 'items-center justify-center'}`}>
              {selectedImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-neutral-300 p-8 sm:p-12 text-center h-full">
                  <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] shadow-sm mb-4 sm:mb-6">
                    <Layers className="w-12 h-12 sm:w-16 sm:h-16 opacity-30" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold font-display text-neutral-800 mb-2">等候您的菜品</h3>
                  <p className="max-w-xs text-xs sm:text-sm text-neutral-400">我们将为您拆解美食精髓，打造极具冲击力的视觉效果</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto lg:pr-4 scrollbar-custom">
                  <div className="flex flex-col gap-12 sm:gap-16">
                    {selectedImages.map((_, i) => (
                      <div key={i} className="flex flex-col gap-6">
                        
                        <div className={`grid grid-cols-1 ${selectedRatios.length > 1 ? 'xl:grid-cols-2' : ''} gap-x-12 gap-y-16`}>
                          {selectedRatios.map(ratio => {
                            const ratioInfo = RATIOS.find(r => r.id === ratio);
                            const title = `${ratioInfo?.name || ratio}: ${ratioInfo?.desc || ''}`;
                            
                            const url = resultImages[i]?.[ratio];
                            const isGeneratingThis = generatingIndex === i && generatingRatio === ratio;
                            
                            const [w, h] = ratio.split(':').map(Number);

                            return (
                              <div key={ratio} className="flex flex-col w-full items-center">
                                <div className="text-[9px] sm:text-[10px] font-bold text-neutral-400 mb-3 sm:mb-4 px-3 sm:px-4 py-1 sm:py-1.5 bg-white rounded-full shadow-sm border border-neutral-100 uppercase tracking-[0.2em] font-display w-fit">
                                  {title}
                                </div>
                                <div className="w-full lg:h-[60vh] lg:max-h-[700px] flex items-center justify-center">
                                  <div 
                                    style={{
                                      aspectRatio: `${w}/${h}`,
                                      width: w >= h ? '100%' : 'auto',
                                      height: h > w ? '100%' : 'auto',
                                      maxWidth: '100%',
                                      maxHeight: '100%',
                                    }} 
                                    className="relative bg-white rounded-xl sm:rounded-[2rem] border border-neutral-200/50 shadow-xl sm:shadow-2xl shadow-neutral-200/40 overflow-hidden flex flex-col items-center justify-center group @container"
                                  >
                                    {url ? (
                                      <>
                                        <img 
                                          src={url} 
                                          alt={`Result ${i} ${ratio}`} 
                                          className="w-full h-full object-cover cursor-zoom-in lg:hover:scale-105 transition-all duration-700 ease-out" 
                                          onClick={() => setZoomedImage(url)}
                                        />
                                      {dishNamesData[`${i}-${ratio}`] && (
                                        <div 
                                          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none z-10"
                                          style={{
                                            top: `${dishNameYData[`${i}-${ratio}`] ?? defaultDishNameYData[`${i}-${ratio}`] ?? 5}%`,
                                            fontSize: `${11 * ((dishNameSizeData[`${i}-${ratio}`] ?? 100) / 100)}cqw`,
                                            fontFamily: '"龚帆怒放体", "Gongfan Nufang", "Zhi Mang Xing", "STXingkai", "华文行楷", cursive',
                                            background: 'linear-gradient(to bottom, #FFFFFF, #E5E5E5, #A3A3A3)',
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent',
                                            filter: 'drop-shadow(0.4cqw 0.4cqw 0.8cqw rgba(0,0,0,0.9))'
                                          }}
                                        >
                                          {dishNamesData[`${i}-${ratio}`]}
                                        </div>
                                      )}
                                      {layersData[`${i}-${ratio}`]?.map((layer, idx) => (
                                        <div key={idx} className="absolute left-0 w-[32%] flex items-center pointer-events-none" style={{ top: `${layer.y}%`, transform: 'translateY(-50%)', paddingLeft: '4cqw' }}>
                                          <div 
                                            className="tracking-wider shrink-0"
                                            style={{
                                              fontSize: `${4.5 * ((layerNameSizeData[`${i}-${ratio}`] ?? 100) / 100)}cqw`,
                                              fontFamily: '"STKaiti", "华文楷体", "Long Cang", "Ma Shan Zheng", serif',
                                              background: 'linear-gradient(to bottom, #FFFFFF, #E5E5E5, #A3A3A3)',
                                              WebkitBackgroundClip: 'text',
                                              WebkitTextFillColor: 'transparent',
                                              filter: 'drop-shadow(0.25cqw 0.25cqw 0.5cqw rgba(0,0,0,0.9))'
                                            }}
                                          >
                                            {layer.name}
                                          </div>
                                          <div className="flex-1 h-[0.3cqw] min-h-[2px] ml-[1.5cqw] relative flex items-center rounded-full" style={{
                                            background: 'linear-gradient(90deg, transparent, rgba(115,115,115,0.8) 40%, #D4D4D4)'
                                          }}>
                                            <div className="absolute right-0 w-[1.2cqw] h-[1.2cqw] min-w-[6px] min-h-[6px] bg-gradient-to-br from-[#FFF] to-[#D4D4D4] shadow-[0_0_10px_rgba(255,255,255,0.8)] border border-[#FFF]/70" style={{ transform: 'translateX(50%) rotate(45deg)' }}></div>
                                          </div>
                                        </div>
                                      ))}
                                      <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 flex items-center gap-2 sm:gap-3 lg:opacity-0 lg:group-hover:opacity-100 transition-all transform lg:translate-y-2 lg:group-hover:translate-y-0">
                                        <button 
                                          onClick={() => {
                                            if (detectingLayers[`${i}-${ratio}`]) return;
                                            const existingLayers = layersData[`${i}-${ratio}`];
                                            const existingDishName = dishNamesData[`${i}-${ratio}`];
                                            const existingDishNameY = dishNameYData[`${i}-${ratio}`];
                                            const existingDishNameSize = dishNameSizeData[`${i}-${ratio}`];
                                            const existingLayerNameSize = layerNameSizeData[`${i}-${ratio}`];
                                            const defaultLayers = defaultLayersData[`${i}-${ratio}`] || [];
                                            const defaultDishName = defaultDishNamesData[`${i}-${ratio}`] || '';
                                            const defaultDishNameY = defaultDishNameYData[`${i}-${ratio}`] ?? 5;
                                            
                                            setEditingLabel({ 
                                              index: i, 
                                              ratio, 
                                              url, 
                                              layers: existingLayers ? [...existingLayers] : [...defaultLayers],
                                              dishName: existingDishName !== undefined ? existingDishName : defaultDishName,
                                              dishNameY: existingDishNameY !== undefined ? existingDishNameY : defaultDishNameY,
                                              dishNameSize: existingDishNameSize !== undefined ? existingDishNameSize : 100,
                                              layerNameSize: existingLayerNameSize !== undefined ? existingLayerNameSize : 100
                                            });
                                          }}
                                          disabled={detectingLayers[`${i}-${ratio}`]}
                                          className="bg-white/95 text-brand-sage p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl shadow-2xl border border-neutral-100 hover:bg-brand-sand transition-all hover:scale-110 active:scale-95"
                                          title={detectingLayers[`${i}-${ratio}`] ? "智能识别中..." : "编辑标注"}
                                        >
                                          {detectingLayers[`${i}-${ratio}`] ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <Tag className="w-4 h-4 sm:w-5 sm:h-5" />}
                                        </button>
                                        <button 
                                          onClick={() => downloadImageWithLabels(url, i, ratio)}
                                          className="bg-white/95 text-brand-sage p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl shadow-2xl border border-neutral-100 hover:bg-brand-sand transition-all hover:scale-110 active:scale-95"
                                          title="下载图片"
                                        >
                                          <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                                        </button>
                                      </div>
                                      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 bg-brand-sage/10 backdrop-blur-md border border-brand-sage/20 text-brand-sage px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-[8px] sm:text-[10px] font-bold tracking-widest uppercase lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                        Architected
                                      </div>
                                    </>
                                  ) : isGeneratingThis ? (
                                    <div className="flex flex-col items-center justify-center px-4 text-center">
                                      <div className="relative mb-3 sm:mb-4">
                                        <Loader2 className="w-8 h-8 sm:w-12 sm:h-12 text-brand-sage animate-spin" />
                                        <div className="absolute inset-0 blur-xl bg-brand-sage/20 rounded-full animate-pulse"></div>
                                      </div>
                                      <span className="text-[10px] sm:text-xs font-bold text-brand-sage tracking-widest uppercase animate-pulse font-display">Simulating Explosion...</span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center justify-center text-neutral-200">
                                      <Layers className="w-8 h-8 sm:w-12 sm:h-12 mb-3 sm:mb-4 opacity-20" />
                                      <span className="text-[10px] sm:text-xs font-bold tracking-widest uppercase font-display opacity-30">Waiting...</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        )}
      </main>

      <AnimatePresence>
        {editingLabel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-brand-paper rounded-[2.5rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] border border-neutral-200/50"
            >
              <div className="px-5 sm:px-8 py-4 sm:py-6 border-b border-neutral-200/60 flex justify-between items-center bg-brand-sand shrink-0">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-sage p-2 rounded-lg text-white">
                    <Tag className="w-3.5 h-3.5 sm:w-4 sm:h-4"/>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold font-display text-neutral-900">精密标注编辑器</h3>
                </div>
                <button onClick={() => setEditingLabel(null)} className="p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 rounded-lg sm:rounded-xl transition-all"><X className="w-5 h-5 sm:w-6 sm:h-6"/></button>
              </div>
              <div className="p-4 sm:p-6 lg:p-10 overflow-y-auto flex flex-col lg:flex-row gap-6 sm:gap-10 LG:gap-12 bg-brand-paper">
                 <div className="w-full lg:w-3/5 flex items-center justify-center bg-brand-sand rounded-2xl sm:rounded-[2rem] border border-neutral-200/60 shadow-inner p-4 sm:p-6 lg:h-[70vh] lg:max-h-[800px]">
                    <div 
                      className="relative @container flex items-center justify-center shadow-2xl rounded-xl sm:rounded-2xl overflow-hidden"
                      style={{ 
                        aspectRatio: `${editW}/${editH}`,
                        width: editW >= editH ? '100%' : 'auto',
                        height: editH > editW ? '100%' : 'auto',
                        maxWidth: '100%',
                        maxHeight: '100%'
                      }}
                    >
                      <img src={editingLabel.url} className="absolute inset-0 w-full h-full object-cover" />
                      {editingLabel.dishName && (
                        <div 
                          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none z-10"
                          style={{
                            top: `${editingLabel.dishNameY}%`,
                            fontSize: `${11 * (editingLabel.dishNameSize / 100)}cqw`,
                            fontFamily: '"龚帆怒放体", "Gongfan Nufang", "Zhi Mang Xing", "STXingkai", "华文行楷", cursive',
                            background: 'linear-gradient(to bottom, #FFFFFF, #E5E5E5, #A3A3A3)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            filter: 'drop-shadow(0.4cqw 0.4cqw 0.8cqw rgba(0,0,0,0.9))'
                          }}
                        >
                          {editingLabel.dishName}
                        </div>
                      )}
                      {editingLabel.layers.map((layer, idx) => (
                         <div key={idx} className="absolute left-0 w-[32%] flex items-center pointer-events-none" style={{ top: `${layer.y}%`, transform: 'translateY(-50%)', paddingLeft: '4cqw' }}>
                            <div 
                              className="tracking-wider shrink-0"
                              style={{
                                fontSize: `${4.5 * (editingLabel.layerNameSize / 100)}cqw`,
                                fontFamily: '"STKaiti", "华文楷体", "Long Cang", "Ma Shan Zheng", serif',
                                background: 'linear-gradient(to bottom, #FFFFFF, #E5E5E5, #A3A3A3)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                filter: 'drop-shadow(0.25cqw 0.25cqw 0.5cqw rgba(0,0,0,0.9))'
                              }}
                            >
                              {layer.name}
                            </div>
                            <div className="flex-1 h-[0.3cqw] min-h-[2px] ml-[1.5cqw] relative flex items-center rounded-full" style={{
                              background: 'linear-gradient(90deg, transparent, rgba(115,115,115,0.8) 40%, #D4D4D4)'
                            }}>
                              <div className="absolute right-0 w-[1.2cqw] h-[1.2cqw] min-w-[6px] min-h-[6px] bg-gradient-to-br from-[#FFF] to-[#D4D4D4] shadow-[0_0_10px_rgba(255,255,255,0.8)] border border-[#FFF]/70" style={{ transform: 'translateX(50%) rotate(45deg)' }}></div>
                            </div>
                         </div>
                      ))}
                    </div>
                 </div>
                 <div className="w-full xl:w-2/5 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto pr-4 space-y-8 scrollbar-hide">
                      <div className="bg-brand-sand border border-neutral-200/60 p-6 rounded-[1.5rem] shadow-sm space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-1.5 h-1.5 bg-brand-sage rounded-full"></div>
                          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest font-display">Dish Title Identity</label>
                        </div>
                        <div className="space-y-4">
                          <input 
                            type="text" 
                            value={editingLabel.dishName}
                            onChange={(e) => setEditingLabel({ ...editingLabel, dishName: e.target.value })}
                            placeholder="请输入菜品大名"
                            className="w-full border-2 border-neutral-100 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-brand-sage/10 focus:border-brand-sage/50 outline-none bg-white transition-all font-bold"
                          />
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-tighter">Vertical Pos %</label>
                              <input 
                                type="number" 
                                min="0" max="100"
                                value={editingLabel.dishNameY}
                                onChange={(e) => setEditingLabel({ ...editingLabel, dishNameY: Number(e.target.value) })}
                                className="w-full border-2 border-neutral-100 rounded-xl px-4 py-2 text-sm focus:border-brand-sage/50 outline-none bg-white font-medium"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-tighter">Font Zoom %</label>
                              <input 
                                type="number" 
                                min="10" max="300"
                                value={editingLabel.dishNameSize}
                                onChange={(e) => setEditingLabel({ ...editingLabel, dishNameSize: Number(e.target.value) })}
                                className="w-full border-2 border-neutral-100 rounded-xl px-4 py-2 text-sm focus:border-brand-sage/50 outline-none bg-white font-medium"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-neutral-200/60">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-brand-sage rounded-full"></div>
                            <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest font-display">Ingredient Layers</h4>
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="text-[10px] font-bold text-neutral-400 uppercase">Text Size %</label>
                            <input 
                              type="number" 
                              min="10" max="300"
                              value={editingLabel.layerNameSize}
                              onChange={(e) => setEditingLabel({ ...editingLabel, layerNameSize: Number(e.target.value) })}
                              className="w-16 border-2 border-neutral-100 rounded-lg px-2 py-1 text-xs outline-none bg-white font-bold"
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          {editingLabel.layers.map((layer, idx) => (
                            <div key={idx} className="group relative flex gap-3 items-end bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm transition-all hover:border-brand-sage/20 hover:shadow-md">
                              <div className="flex-1 space-y-1.5">
                                <label className="text-[10px] font-bold text-neutral-300 uppercase tracking-tighter">Label Text</label>
                                <input 
                                  type="text" 
                                  value={layer.name}
                                  onChange={(e) => {
                                    const newLayers = [...editingLabel.layers];
                                    newLayers[idx].name = e.target.value;
                                    setEditingLabel({ ...editingLabel, layers: newLayers });
                                  }}
                                  className="w-full border-b-2 border-neutral-50 rounded-none px-0 py-1 text-sm focus:border-brand-sage/50 outline-none bg-white transition-all font-medium"
                                />
                              </div>
                              <div className="w-16 space-y-1.5">
                                <label className="text-[10px] font-bold text-neutral-300 uppercase tracking-tighter">V-Pos %</label>
                                <input 
                                  type="number" 
                                  min="0" max="100"
                                  value={layer.y}
                                  onChange={(e) => {
                                    const newLayers = [...editingLabel.layers];
                                    newLayers[idx].y = Number(e.target.value);
                                    setEditingLabel({ ...editingLabel, layers: newLayers });
                                  }}
                                  className="w-full border-b-2 border-neutral-50 rounded-none px-0 py-1 text-sm focus:border-brand-sage/50 outline-none bg-white transition-all text-center font-medium"
                                />
                              </div>
                              <button 
                                onClick={() => {
                                  const newLayers = editingLabel.layers.filter((_, i) => i !== idx);
                                  setEditingLabel({ ...editingLabel, layers: newLayers });
                                }}
                                className="p-2 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                title="Remove"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>

                        <button onClick={() => {
                           setEditingLabel({ ...editingLabel, layers: [...editingLabel.layers, { y: 50, name: '新增食材' }]});
                        }} className="w-full py-4 border-2 border-dashed border-neutral-200 text-neutral-400 text-xs font-bold rounded-2xl hover:border-brand-sage/50 hover:text-brand-sage hover:bg-brand-sand transition-all flex items-center justify-center gap-2 uppercase tracking-widest">
                          <Plus className="w-4 h-4" /> Add Component Layer
                        </button>
                      </div>
                    </div>
                 </div>
              </div>
              <div className="px-5 sm:px-10 py-5 sm:py-8 border-t border-neutral-200/60 flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 bg-brand-sand shrink-0">
                <button onClick={() => setEditingLabel(null)} className="px-8 py-3.5 text-neutral-500 hover:text-neutral-900 font-bold text-xs sm:text-sm transition-all uppercase tracking-widest">DISCARD</button>
                <button 
                  onClick={() => {
                    setLayersData(prev => ({
                      ...prev,
                      [`${editingLabel.index}-${editingLabel.ratio}`]: editingLabel.layers
                    }));
                    setDishNamesData(prev => ({
                      ...prev,
                      [`${editingLabel.index}-${editingLabel.ratio}`]: editingLabel.dishName
                    }));
                    setDishNameYData(prev => ({
                      ...prev,
                      [`${editingLabel.index}-${editingLabel.ratio}`]: editingLabel.dishNameY
                    }));
                    setDishNameSizeData(prev => ({
                      ...prev,
                      [`${editingLabel.index}-${editingLabel.ratio}`]: editingLabel.dishNameSize
                    }));
                    setLayerNameSizeData(prev => ({
                      ...prev,
                      [`${editingLabel.index}-${editingLabel.ratio}`]: editingLabel.layerNameSize
                    }));
                    setEditingLabel(null);
                  }} 
                  className="px-8 sm:px-10 py-3.5 sm:py-4 bg-brand-sage text-white rounded-xl sm:rounded-[1.25rem] font-bold text-xs sm:text-sm hover:translate-y-[-2px] hover:shadow-xl hover:shadow-brand-sage/30 active:scale-[0.98] transition-all shadow-lg shadow-brand-sage/20 uppercase tracking-widest font-display"
                >
                  Confirm & Apply
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {zoomedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
            onClick={() => setZoomedImage(null)}
          >
            <button 
              className="absolute top-6 right-6 text-white/70 hover:text-white p-2 rounded-full transition-colors"
              onClick={() => setZoomedImage(null)}
            >
              <X className="w-8 h-8" />
            </button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              src={zoomedImage}
              alt="Zoomed result"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
