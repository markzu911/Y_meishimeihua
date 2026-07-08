import React, { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, Loader2, Wand2, Download, X, Plus, ArrowLeft, Bot, Sliders, Send, MessageSquare, AlertCircle, Sparkles, RefreshCw, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { saveImageStandard } from '../lib/saas';
import { SaasData } from '../App';

const STYLES = [
  { 
    id: 'modern-minimalist', 
    name: '现代极简', 
    description: '带有细微颗粒纹理的米白色背景，柔和明亮，极致干净', 
    bgPrompt: 'a clean, off-white or cream-colored surface with a subtle, fine grainy texture resembling high-quality textured paper or fine plaster. The textured surface extends seamlessly into the background. Soft, bright, and even lighting creating a gentle, natural shadow to one side. Minimalist aesthetic, extremely clean and empty background with no props, high-key lighting, sharp focus, professional food photography.' 
  },
  { 
    id: 'dark-moody', 
    name: '暗调情绪', 
    description: '黑色细纹理岩板桌面，纯黑背景带有微弱的暗灰色波纹光影，右侧强烈聚光灯打光，极简高级商业摄影风格', 
    bgPrompt: 'a dark, fine-textured black slate or concrete surface. The distant background is pitch black with very subtle, out-of-focus dark grey wavy patterns or smoky textures. Strong, dramatic directional spotlighting coming from the right side, casting a stark, defined shadow to the left. High contrast, sleek, minimalist, high-end commercial food photography, moody atmosphere, sharp focus on the surface.' 
  },
  { 
    id: 'rustic', 
    name: '乡村木质', 
    description: '深色做旧粗犷老木板桌面，带有深深的拼接缝隙，搭配粗麻布、木勺与复古香料瓶，极具年代感', 
    bgPrompt: 'a highly textured, antique, weathered dark brown wooden plank table with deep grooves between the boards. The wood looks very old, rough, and rustic with visible grain. Warm, natural sunlight casting soft, inviting shadows across the wood. NO distant background, NO windows, NO cabinets, NO room interior; the wooden table surface serves as the ONLY background. Scattered on the table immediately around the dish are subtle rustic props: a small vintage glass spice jar, a piece of rough linen cloth, a small wooden scoop or spoon with some soybeans or grains, and a few fresh green herbs. Traditional, cozy, home-cooked aesthetic, warm golden-hour color palette, close-up food photography, sharp focus.' 
  },
  { 
    id: 'fine-dining', 
    name: '高级餐厅', 
    description: '深紫色高级丝绸桌布，带有优雅的褶皱，搭配红酒杯与复古银质餐具，奢华暗调氛围', 
    bgPrompt: 'a luxurious, deep plum-purple silk or satin fabric background with elegant, soft folds and drapes. Scattered elegantly around the main dish are upscale dining props: a glass of dark red wine and a small rustic ceramic dish with a vintage silver spoon. CRITICAL: DO NOT add any scattered raw ingredients like chili peppers, scallions, or herbs. Keep the setting clean and elegant. Soft, directional lighting highlighting the smooth texture and sheen of the silk, creating deep, moody shadows. Sophisticated, high-end Michelin-star restaurant atmosphere, rich jewel tones, sharp focus, professional commercial food photography.' 
  },
  { 
    id: 'bright-airy', 
    name: '明亮清新', 
    description: '带有灰色纹理的白色大理石桌面，明亮的自然窗光，干净极简的现代感', 
    bgPrompt: 'a clean, white marble tabletop with distinct, elegant grey veining. Bright, natural daylight streaming in from a nearby window, casting soft, natural shadows. The background is minimal and uncluttered, focusing entirely on the beautiful marble surface and the fresh, airy lighting. Modern, clean, and uplifting aesthetic, high-key lighting, sharp focus, professional lifestyle food photography.' 
  },
  { 
    id: 'natural-forest', 
    name: '自然绿植', 
    description: '苔藓与原木桌面，背景茂密蕨类绿植，缭绕的干冰烟雾，神秘森林氛围', 
    bgPrompt: 'a mystical forest floor setting. The surface is covered with lush green moss, small ferns, and pieces of natural weathered wood and bark. The background features dense, vibrant green foliage and ferns against a dark, moody backdrop, all in sharp focus. Swirling dry ice smoke or mist surrounds the base of the dish, creating an ethereal atmosphere. CRITICAL: DO NOT add any scattered raw ingredients like chili peppers, scallions, or utensils like chopsticks. Keep the setting focused strictly on the natural forest background and the main dish. Dramatic spotlighting on the food, rich green tones, deep depth of field, high-quality commercial food photography.' 
  },
];

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

export default function Beautify({ 
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
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0].id);
  const [selectedRatios, setSelectedRatios] = useState<AspectRatio[]>(['3:4']);
  const [selectedResolution, setSelectedResolution] = useState<Resolution>('1K');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState<number>(-1);
  const [generatingRatio, setGeneratingRatio] = useState<AspectRatio | null>(null);
  const [resultImages, setResultImages] = useState<Partial<Record<AspectRatio, string | null>>[]>([]);
  const [generatedStyle, setGeneratedStyle] = useState<string | null>(null);
  const [generatedRatios, setGeneratedRatios] = useState<AspectRatio[]>([]);
  const [generatedResolution, setGeneratedResolution] = useState<Resolution | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Agent Chat State and Interfaces
  interface Message {
    id: string;
    sender: 'user' | 'assistant';
    text: string;
    timestamp: Date;
    type?: 'style-select' | 'upload' | 'config' | 'generating' | 'result' | 'error' | 'text';
    payload?: any;
  }

  const [agentMessages, setAgentMessages] = useState<Message[]>(() => {
    const welcomeMsg: Message = {
      id: 'welcome',
      sender: 'assistant',
      timestamp: new Date(),
      type: 'style-select',
      text: '已为您进入 **菜品一键美化** 空间！🌟\n\n我可以帮您为菜品照片替换精美的背景、进行光影重构，并提升食物质感。✨\n\n您可以随时对我说“**切换到美食爆炸图**”以自由切换功能。\n\n请先选择您期望的美化风格：'
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
  const [loadingStep, setLoadingStep] = useState(0);

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

  // Humorous progress text cycling
  useEffect(() => {
    if (isGenerating) {
      const interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % 4);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isGenerating]);

  const loadingMessages = [
    '正在对菜品进行精准扣图与边缘重构... 🎯',
    '正在设计融入全新氛围感的高清背景... 🎨',
    '正在为菜品渲染完美的漫反射摄影光影... 💡',
    '正在打包并准备精美的美化成品照片... 📦'
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
        setAgentMessages(prev => [
          ...prev.filter(m => m.type !== 'generating'),
          {
            id: `result-${Date.now()}`,
            sender: 'assistant',
            timestamp: new Date(),
            type: 'result',
            payload: {
              images: savedImages,
              styleId: selectedStyle,
              ratios: [...selectedRatios],
              resolution: selectedResolution
            },
            text: `✨ 美化生成完成！我已经为您的菜品照片重构了全新的背景和极佳的光影：`
          }
        ]);
      }
    }
    prevIsGenerating.current = isGenerating;
  }, [isGenerating, error, resultImages]);

  const parseGeminiResponse = async (userText: string, currentStyle: string, currentRatio: string, currentRes: string) => {
    try {
      const prompt = `你是一个高度智能、有人情味且专业的“美食美化视觉AI管家”。
当前用户输入是: "${userText}"。

系统当前状态:
- 是否已上传菜品原图: ${selectedImages.length > 0 ? "是 (已上传)" : "否 (尚未上传)"}
- 当前选择的风格: ${currentStyle}
- 当前设定的输出比例: ${currentRatio}
- 当前设定的生成画质: ${currentRes}

可选美化风格和对应ID:
1. 现代极简 (modern-minimalist) - 米白色背景，干净，柔和明亮
2. 暗调情绪 (dark-moody) - 黑色岩板桌面，纯黑背景，聚光灯打光，高级高冷
3. 乡村木质 (rustic) - 做旧老木板桌面，带有粗麻布，香料
4. 高级餐厅 (fine-dining) - 深紫色丝绸桌布，红酒杯，奢华米其林
5. 明亮清新 (bright-airy) - 白色大理石桌面，自然窗光，清新干净现代
6. 自然绿植 (natural-forest) - 苔藓与原木桌面，森林绿植，干冰烟雾缭绕

可选输出比例: "1:1", "3:4", "9:16", "16:9" （用户可以说：方形、横版、竖版、长视频、小红书比例、抖音比例等，请智能映射到最接近的比例）。
可选画质: "1K", "2K", "4K"（用户可以说：标准、高清、超清、高清画质、最高品质等）。

请根据用户输入的指令和意图：
1. 分析用户是否表达了以下任一明确指令：
   - 【开始生成/美化】（如：“开始”、“开始生成”、“一键生成”、“搞起”、“做一张”、“立即美化”、“生成”、“确定生成”、“走起”、“开始做”等）
   - 【重置/重新开始】（如：“重置”、“重新开始”、“重新选择”、“重来”、“清空”等）
   - 【修改尺寸/比例】（如：“换成16比9”、“改成方形”、“修改比例为3:4”等）
   - 【更换背景/风格】（如：“我想换成森林绿植的背景”、“用高级餐厅风格”、“改成大理石”、“帮我换成米白色”等）
   - 【修改清晰度/画质】（如：“用4K画质”、“提升清晰度为2K”等）

2. 给出非常自然、拟人化的、口语化且有温度的回复（reply）。
   - 不要像机器人一样机械重复，而是针对用户的改变直接予以确认和鼓励。
   - 如果用户要求生成（或准备好生成），在回复中兴奋地告诉他们：“好的，收到您的指令，马上为您一键重构！请看下方👇...” 或类似话语。
   - 如果用户尚未上传照片，友好地引导他们上传，如：“风格已选好！快把您的美食照片上传到这里，我这就给它化个妆~”
   - 如果用户已经上传了照片，可以顺应他们的要求，修改比例或背景后，友好地提示：“已为您切换，随时可以点击下方的‘开始 AI 美化’，或者直接对我说‘开始生成’！”

3. 务必返回以下 JSON 格式（绝对不要带有任何 markdown 格式标记如 \`\`\`json 或是 \`\`\`，必须是纯 JSON 字符串）：
{
  "reply": "非常自然拟人化的回复，总结当前的改动并引导下一步（如果有）",
  "detectedStyleId": "匹配到的风格ID，如 modern-minimalist，如果没有提到，返回 null",
  "detectedRatio": "匹配到的比例如 1:1，如果没有提到，返回 null",
  "detectedResolution": "匹配到的清晰度如 2K，如果没有提到，返回 null",
  "shouldStartGenerate": true/false (当用户表达了“开始生成/开始美化/一键美化”的意思时为 true，否则为 false),
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
    if (lowerText.includes('爆炸') || lowerText.includes('explosion') || lowerText.includes('拆解') || lowerText === '2') {
      if (onChangeTab) {
        onChangeTab('explosion');
        return;
      }
    }

    // Append user message
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

      const result = await parseGeminiResponse(textToSend, selectedStyle, selectedRatios[0] || '3:4', selectedResolution);

      setAgentMessages(prev => prev.filter(m => m.id !== thinkingId));

      if (result) {
        if (result.shouldReset) {
          resetAgentFlow();
          return;
        }

        if (result.detectedStyleId && STYLES.some(s => s.id === result.detectedStyleId)) {
          setSelectedStyle(result.detectedStyleId);
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

        // Determine next state
        let nextType: 'style-select' | 'upload' | 'config' | 'text' = 'text';
        if (selectedImages.length === 0) {
          nextType = 'upload';
        } else {
          nextType = 'config';
        }

        setAgentMessages(prev => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            sender: 'assistant',
            text: result.reply || '已为您调整对应的参数。',
            timestamp: new Date(),
            type: nextType
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
            text: '抱歉，我目前对复杂的指令有些迷茫。您可以选择下方风格或者上传照片开始美化！',
            timestamp: new Date(),
            type: selectedImages.length === 0 ? 'style-select' : 'config'
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
          text: '网络有一些开小差，请稍后再试或点击按钮进行操作。',
          timestamp: new Date(),
          type: selectedImages.length === 0 ? 'style-select' : 'config'
        }
      ]);
    } finally {
      setIsAiResponding(false);
    }
  };

  const handleSelectStyleInChat = (styleId: string) => {
    const style = STYLES.find(s => s.id === styleId);
    if (!style) return;

    setSelectedStyle(styleId);

    setAgentMessages(prev => [
      ...prev,
      {
        id: `user-style-${Date.now()}`,
        sender: 'user',
        text: `我选择「${style.name}」风格`,
        timestamp: new Date()
      },
      {
        id: `assistant-upload-${Date.now()}`,
        sender: 'assistant',
        text: `已为您选择 **${style.name}** 风格。✨ ${style.description}。\n\n接下来，请上传需要美化的菜品照片：`,
        timestamp: new Date(),
        type: 'upload'
      }
    ]);
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
          text: '⚠️ 请先上传您的菜品照片才能开始美化。'
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
        text: '正在为您精心重构光影并美化菜品，这可能需要 5-15 秒，请稍候... ⏳'
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
        type: 'style-select',
        text: '你好！我是您的**美食美化 AI 助手**。我可以帮您为菜品照片替换精美的背景、进行光影重构，并提升食物质感。✨\n\n请先选择您期望的美化风格：'
      }
    ]);
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

        // If in Agent Mode, advance chat
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
              text: `照片已收到，质感非常好！📸 接下来，请确认您期望的输出比例和清晰度，然后点击下方的「🚀 开始 AI 美化」：`,
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
              text: `❌ 图片压缩或处理失败，请重新上传。`,
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

  const generateImages = async () => {
    if (selectedImages.length === 0 || selectedRatios.length === 0) return;

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
      let style = STYLES.find(s => s.id === selectedStyle);
      if (!style) style = STYLES[0];

      const isNewGeneration = selectedStyle !== generatedStyle || JSON.stringify(selectedRatios) !== JSON.stringify(generatedRatios) || selectedResolution !== generatedResolution;
      const newResults = isNewGeneration ? Array.from({ length: selectedImages.length }, () => ({})) : [...resultImages];
      
      if (isNewGeneration) {
        setResultImages(newResults);
        setGeneratedStyle(selectedStyle);
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

        const prompt = `[CRITICAL INSTRUCTION: BACKGROUND REPLACEMENT AND FOREGROUND ENHANCEMENT]
You are a highly precise image editing AI. Your job is to change the background, add appropriate atmospheric props, AND enhance the visual quality of the main dish.

ABSOLUTE RULES:
1. FOREGROUND ENHANCEMENT (NO STRUCTURAL CHANGES): You MUST enhance the food and its container to make them look more appetizing. Improve the lighting, brightness, contrast, color saturation, and sharpness/clarity.
2. STRICT STRUCTURAL PRESERVATION: While enhancing the lighting and colors, you MUST NOT alter the actual shape, structure, ingredients, or type of food. The container's shape, material, and rim MUST remain structurally identical to the input image. Do not add or remove food items from the dish itself.
3. SCALE & COMPOSITION: Ensure the preserved food and container are perfectly centered. Scale the dish to occupy about 60-70% of the frame, leaving enough breathing room around it for background elements. Do NOT change the camera angle or perspective.
4. CONTEXTUAL PROPS: You MUST add subtle, food-related props in the background or around the dish (e.g., scattered ingredients, fresh herbs, spices, appropriate utensils, or napkins). These props MUST logically match the food in the dish and fit the requested style perfectly. Do NOT obscure the main dish.
5. REMOVE WATERMARKS: Completely remove any watermarks, text, logos, or timestamps from the background.
6. NEW BACKGROUND TO APPLY: "${style.bgPrompt}"
7. BACKGROUND CLARITY: Ensure the new background is sharp and clear with deep depth of field. Do not use heavy blur.${saasPromptAdditions}`;

        for (const ratio of selectedRatios) {
          if (!isNewGeneration && newResults[i][ratio]) continue;
          
          setGeneratingRatio(ratio);
          
          let generatedUrl = null;
          let retries = 3;
          let delay = 2000;
          
          while (retries > 0) {
            try {
              const res = await fetch("/api/gemini", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
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

          newResults[i] = { ...newResults[i], [ratio]: generatedUrl };
          setResultImages([...newResults]);

          // Standard Save Flow for this specific image result
          if (saasData) {
            saveImageStandard({
              userId: saasData.userId,
              toolId: saasData.toolId,
              imageUrl: generatedUrl,
              fileName: `beautify-${Date.now()}-${i + 1}.png`
            }).then(saveRes => {
              if (saveRes.success && saveRes.currentIntegral !== undefined) {
                window.dispatchEvent(new CustomEvent('update_points', { detail: { points: saveRes.currentIntegral } }));
              }
            }).catch(err => console.error("Save image failed:", err));
          }
        }
      }

    } catch (err: any) {
      console.error("Generation error:", err);
      let errorMessage = err.message || "生成图片时出错，请重试。";
      
      // Handle specific API errors gracefully
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

  const downloadImage = (url: string, index: number, ratio: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `beautified-food-${index + 1}-${ratio.replace(':', 'x')}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAll = () => {
    resultImages.forEach((res, index) => {
      Object.entries(res).forEach(([ratio, url]) => {
        if (url) downloadImage(url as string, index, ratio);
      });
    });
  };

  const allGenerated = resultImages.length > 0 && resultImages.every(res => selectedRatios.every(r => res[r]));
  const hasResults = resultImages.some(res => Object.values(res).some(url => url !== null));

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
                <Wand2 className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight font-display">菜品一键美化</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 min-h-0 flex flex-col">
        {mode === 'agent' ? (
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
                  <h3 className="font-bold text-sm text-neutral-800">AI 美学管家</h3>
                  <p className="text-[10px] text-neutral-400">正在在线为您定制菜品光影</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={resetAgentFlow} 
                  className="flex items-center gap-1 text-xs text-neutral-500 hover:text-brand-sage bg-white border border-neutral-200 px-3 py-1.5 rounded-xl hover:shadow-sm active:scale-95 transition-all"
                  title="重置对话"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>全新美化</span>
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
                        {/* Render rich text */}
                        <div className="whitespace-pre-wrap">
                          {renderFormattedText(msg.text)}
                        </div>

                        {/* Interactive Elements */}
                        {isAssistant && msg.type === 'style-select' && (
                          <div className="grid grid-cols-2 gap-2 mt-4">
                            {STYLES.map(style => (
                              <button
                                key={style.id}
                                onClick={() => handleSelectStyleInChat(style.id)}
                                className={`p-3 text-left rounded-xl border transition-all text-xs flex flex-col gap-1 hover:shadow-md hover:border-brand-sage/50 active:scale-98 bg-brand-sand/10 ${
                                  selectedStyle === style.id ? 'border-brand-sage bg-brand-sage/5 shadow-inner' : 'border-neutral-200 bg-white'
                                }`}
                              >
                                <span className="font-bold text-neutral-800 flex items-center gap-1.5">
                                  <Sparkles className="w-3 h-3 text-brand-amber" />
                                  {style.name}
                                </span>
                                <span className="text-[10px] text-neutral-400 leading-normal line-clamp-1">{style.description}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {isAssistant && msg.type === 'upload' && (
                          <div className="mt-4">
                            <div 
                              onClick={() => !isGenerating && fileInputRef.current?.click()}
                              className="border-2 border-dashed border-neutral-200 hover:border-brand-sage/50 bg-neutral-50 hover:bg-brand-sand/20 rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center gap-2"
                            >
                              <Upload className="w-8 h-8 text-brand-sage animate-bounce" />
                              <span className="font-bold text-neutral-800 text-xs">点击或拖入您的菜品原图</span>
                              <span className="text-[10px] text-neutral-400">支持常用图片格式，自动前端无损压缩</span>
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
                              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">输出比例 (单选)</span>
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
                              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">生成画质</span>
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
                                <Wand2 className="w-4 h-4" />
                              )}
                              <span>🚀 开始 AI 美化</span>
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
                                return (
                                  <div key={ratio} className="bg-neutral-50 p-3 rounded-2xl border border-neutral-100 flex flex-col gap-2">
                                    <div className="text-[9px] font-bold text-neutral-400 tracking-wider flex items-center justify-between">
                                      <span>比例 {ratio} 美化大片</span>
                                      <span className="text-brand-sage font-medium flex items-center gap-0.5">💡 点击图片预览放大</span>
                                    </div>
                                    <div 
                                      className="relative aspect-square rounded-xl overflow-hidden border border-neutral-200/50 shadow bg-white flex items-center justify-center cursor-zoom-in group"
                                      onClick={() => setZoomedImage(imageUrl)}
                                    >
                                      <img src={imageUrl} alt="Beautified" className="max-w-full max-h-full object-contain transition-transform duration-300 group-hover:scale-102" />
                                      {/* Zoom hover overlay */}
                                      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                        <div className="bg-white/90 p-2.5 rounded-full shadow-lg text-neutral-800 flex items-center gap-1 text-xs font-bold transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                          <ImageIcon className="w-4 h-4" />
                                          <span>点击放大预览</span>
                                        </div>
                                      </div>
                                      <div className="absolute bottom-2 right-2 flex gap-1 z-10" onClick={(e) => e.stopPropagation()}>
                                        <button 
                                          onClick={() => downloadImage(imageUrl, 0, ratio)}
                                          className="bg-white/95 text-brand-sage p-2 rounded-lg border border-neutral-200 hover:bg-brand-sand transition-all shadow"
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
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
                                      if (url) downloadImage(url as string, 0, ratio);
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
                                <span>继续美化新照片</span>
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
                placeholder="您可以输入例如：“帮我设置为暗调情绪风格，生成1:1的画质。”"
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
          <div className="space-y-6 lg:col-span-4 xl:col-span-3 lg:overflow-y-auto lg:pr-2 lg:pb-4 scrollbar-hide shrink-0">
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
                      <p className="text-neutral-400 text-[10px] sm:text-xs px-2 sm:px-4 leading-relaxed">支持常见图片格式（如 JPG, PNG, WebP），最大支持 20MB（通过前端压缩上传）</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Removing separate preview layout */}
            </section>

            <section className="bg-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl shadow-sm border border-neutral-200/50">
              <h2 className="text-base sm:text-lg font-bold font-display mb-4 sm:mb-5">2. 选择美化风格</h2>
              <div className="grid grid-cols-2 xs:grid-cols-3 lg:grid-cols-2 gap-2 sm:gap-3">
                {STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    disabled={isGenerating}
                    className={`text-center p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all duration-300 ${
                      selectedStyle === style.id 
                        ? 'border-brand-sage bg-brand-sage text-white shadow-lg shadow-brand-sage/20 font-bold translate-y-[-1px]' 
                        : 'border-neutral-100 bg-brand-sand/30 hover:border-neutral-200 hover:bg-white text-neutral-500 font-medium'
                    } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="text-xs sm:text-sm">{style.name}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl shadow-sm border border-neutral-200/50">
              <h2 className="text-base sm:text-lg font-bold font-display mb-4 sm:mb-5">3. 输出比例 & 清晰度</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-4 lg:grid-cols-2 gap-2 sm:gap-3">
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
                        className={`text-center p-2.5 sm:p-3 rounded-xl border-2 transition-all duration-300 ${
                          isSelected
                            ? 'border-brand-sage bg-brand-sage text-white shadow-lg shadow-brand-sage/20 font-bold' 
                            : 'border-neutral-100 bg-brand-sand/30 hover:border-neutral-200 hover:bg-white text-neutral-500 font-medium'
                        } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="text-xs sm:text-sm font-bold">{ratio.name}</div>
                        <div className={`text-[8px] sm:text-[10px] uppercase tracking-tighter mt-0.5 ${isSelected ? 'text-white/60' : 'text-neutral-400'}`}>{ratio.desc}</div>
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-2 border-t border-neutral-100 mt-4">
                  {RESOLUTIONS.map((res) => (
                    <button
                      key={res.id}
                      onClick={() => setSelectedResolution(res.id)}
                      disabled={isGenerating}
                      className={`text-center p-2 sm:p-2.5 rounded-xl border-2 transition-all duration-300 ${
                        selectedResolution === res.id 
                          ? 'border-brand-sage bg-brand-sage text-white shadow-md shadow-brand-sage/10 font-bold' 
                          : 'border-neutral-100 bg-brand-sand/30 hover:border-neutral-200 hover:bg-white text-neutral-400 font-medium'
                      } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="text-[10px] sm:text-xs">{res.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <button
              onClick={generateImages}
              disabled={selectedImages.length === 0 || selectedRatios.length === 0 || isGenerating || isCompressing || (allGenerated && selectedStyle === generatedStyle && JSON.stringify(selectedRatios) === JSON.stringify(generatedRatios) && selectedResolution === generatedResolution)}
              className="w-full bg-brand-sage hover:bg-brand-sage/90 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed text-white font-bold py-4 sm:py-5 px-6 rounded-xl sm:rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 sm:gap-3 shadow-xl shadow-brand-sage/30 hover:translate-y-[-2px] active:scale-[0.98]"
            >
              {isCompressing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  正在压缩...
                </>
              ) : isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  正在焕新...
                </>
              ) : (selectedStyle !== generatedStyle || JSON.stringify(selectedRatios) !== JSON.stringify(generatedRatios) || selectedResolution !== generatedResolution) && hasResults ? (
                <>
                  <Wand2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  更新风格
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  开启 AI 美化
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
              <h2 className="text-xl sm:text-2xl font-bold font-display">生成美化结果</h2>
              {hasResults && (
                <button 
                  onClick={downloadAll}
                  className="text-xs sm:text-sm font-bold text-brand-sage hover:text-brand-sage/80 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl sm:rounded-2xl bg-brand-sand/50 hover:bg-brand-sand transition-all shadow-sm w-full sm:w-auto"
                >
                  <Download className="w-4 h-4" />
                  打包保存至本地
                </button>
              )}
            </div>
            
            <div className={`flex-1 bg-brand-sand/50 rounded-2xl sm:rounded-3xl border border-neutral-200 relative flex flex-col min-h-0 ${selectedImages.length > 0 ? 'p-4 sm:p-8' : 'items-center justify-center'}`}>
              {selectedImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-neutral-300 p-8 sm:p-12 text-center h-full">
                  <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] shadow-sm mb-4 sm:mb-6">
                    <ImageIcon className="w-12 h-12 sm:w-16 sm:h-16 opacity-30" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold font-display text-neutral-800 mb-2">等候您的菜品</h3>
                  <p className="max-w-xs text-xs sm:text-sm text-neutral-400">选择心仪的风格后，AI 将为您呈现大师级的摄影佳作</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto lg:pr-4 scrollbar-custom">
                  <div className="flex flex-col gap-12 sm:gap-16">
                    {selectedImages.map((_, i) => (
                      <div key={i} className="flex flex-col gap-8">
                        
                        <div className={`grid grid-cols-1 ${selectedRatios.length > 1 ? 'xl:grid-cols-2' : ''} gap-x-8 sm:gap-x-12 gap-y-12 sm:gap-y-16`}>
                          {selectedRatios.map(ratio => {
                            const ratioInfo = RATIOS.find(r => r.id === ratio);
                            const title = `${ratioInfo?.name || ratio}: ${ratioInfo?.desc || ''}`;
                            
                            const url = resultImages[i]?.[ratio];
                            const isGeneratingThis = generatingIndex === i && generatingRatio === ratio;
                            
                            const [w, h] = ratio.split(':').map(Number);
                            const aspectRatioStyle = { aspectRatio: `${w}/${h}` };

                            return (
                              <div key={ratio} className="flex flex-col w-full items-center">
                                <div className="text-[9px] sm:text-[10px] font-bold text-neutral-400 mb-3 sm:mb-4 px-3 sm:px-4 py-1 sm:py-1.5 bg-white rounded-full shadow-sm border border-neutral-100 uppercase tracking-[0.2em] font-display w-fit">
                                  {title}
                                </div>
                                <div 
                                  style={aspectRatioStyle} 
                                  className="relative bg-white rounded-xl sm:rounded-[2rem] border border-neutral-200/50 shadow-xl sm:shadow-2xl shadow-neutral-200/40 overflow-hidden flex flex-col items-center justify-center group w-full lg:h-[60vh] lg:max-h-[700px]"
                                >
                                  {url ? (
                                    <>
                                      <img 
                                        src={url} 
                                        alt={`Result ${i} ${ratio}`} 
                                        className="w-full h-full object-contain cursor-zoom-in lg:hover:scale-105 transition-all duration-700 ease-out" 
                                        onClick={() => setZoomedImage(url)}
                                      />
                                      <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 flex gap-2 overflow-hidden">
                                        <button 
                                          onClick={() => downloadImage(url, i, ratio)}
                                          className="bg-white/95 text-brand-sage p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl shadow-2xl border border-neutral-100 hover:bg-brand-sand transition-all lg:opacity-0 lg:group-hover:opacity-100 hover:scale-110 active:scale-95"
                                          title={`下载 ${ratio} 图片`}
                                        >
                                          <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                                        </button>
                                      </div>
                                      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 bg-brand-sage/10 backdrop-blur-md border border-brand-sage/20 text-brand-sage px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-[8px] sm:text-[10px] font-bold tracking-widest uppercase lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                        Rendered
                                      </div>
                                    </>
                                  ) : isGeneratingThis ? (
                                    <div className="flex flex-col items-center justify-center px-4 text-center">
                                      <div className="relative mb-3 sm:mb-4">
                                        <Loader2 className="w-8 h-8 sm:w-12 sm:h-12 text-brand-sage animate-spin" />
                                        <div className="absolute inset-0 blur-xl bg-brand-sage/20 rounded-full animate-pulse"></div>
                                      </div>
                                      <span className="text-[10px] sm:text-xs font-bold text-brand-sage tracking-widest uppercase animate-pulse font-display">Crafting Excellence...</span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center justify-center text-neutral-200">
                                      <ImageIcon className="w-8 h-8 sm:w-12 sm:h-12 mb-3 sm:mb-4 opacity-20" />
                                      <span className="text-[10px] sm:text-xs font-bold tracking-widest uppercase font-display opacity-30">Waiting...</span>
                                    </div>
                                  )}
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
        {zoomedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
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
