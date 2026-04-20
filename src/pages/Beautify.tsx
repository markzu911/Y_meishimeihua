import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Loader2, Wand2, Download, X, Plus, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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

export default function Beautify({ saasData }: { saasData: SaasData | null }) {
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0].id);
  const [selectedRatios, setSelectedRatios] = useState<AspectRatio[]>(['3:4']);
  const [selectedResolution, setSelectedResolution] = useState<Resolution>('1K');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState<number>(-1);
  const [generatingRatio, setGeneratingRatio] = useState<AspectRatio | null>(null);
  const [resultImages, setResultImages] = useState<Partial<Record<AspectRatio, string | null>>[]>([]);
  const [generatedStyle, setGeneratedStyle] = useState<string | null>(null);
  const [generatedRatios, setGeneratedRatios] = useState<AspectRatio[]>([]);
  const [generatedResolution, setGeneratedResolution] = useState<Resolution | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const addFiles = (files: File[]) => {
    if (files.length > 0) {
      const file = files[0];
      setSelectedImages([file]);
      const url = URL.createObjectURL(file);
      setPreviewUrls([url]);
      setResultImages([{}]);
      setError(null);
    }
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
              const res = await fetch("/api/gemini/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  base64Data,
                  mimeType: selectedImages[i].type,
                  prompt,
                  ratio,
                  resolution: selectedResolution
                })
              });
              
              if (!res.ok) {
                 const errData = await res.json();
                 throw new Error(errData.error || "Generation failed");
              }
              const data = await res.json();
              generatedUrl = data.url;
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
        }
      }

      if (saasData && newResults.some(res => Object.values(res).some(url => url !== null))) {
        try {
          await fetch('/api/tool/consume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: saasData.userId, toolId: saasData.toolId })
          });
        } catch (e) {
          console.error("Consume error", e);
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
        if (url) downloadImage(url, index, ratio);
      });
    });
  };

  const allGenerated = resultImages.length > 0 && resultImages.every(res => selectedRatios.every(r => res[r]));
  const hasResults = resultImages.some(res => Object.values(res).some(url => url !== null));

  return (
    <div className="h-full flex flex-col bg-neutral-50 text-neutral-900 font-sans selection:bg-orange-200">
      <header className="bg-white border-b border-neutral-200 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="bg-orange-500 p-2 rounded-lg text-white">
                <Wand2 className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight">菜品一键美化</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* Left Column: Controls */}
          <div className="space-y-6 lg:col-span-4 xl:col-span-3 overflow-y-auto pr-2 pb-4">
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium">1. 上传菜品照片</h2>
                <span className="text-sm text-neutral-500">{selectedImages.length > 0 ? '已选择 1 张' : '未选择'}</span>
              </div>
              
              <div 
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer mb-4
                  ${isGenerating ? 'opacity-50 pointer-events-none' : 'border-neutral-300 hover:border-orange-400 hover:bg-orange-50/30'}`}
                onClick={() => !isGenerating && fileInputRef.current?.click()}
                onDrop={!isGenerating ? handleDrop : undefined}
                onDragOver={handleDragOver}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageSelect} 
                  accept="image/*" 
                  className="hidden" 
                />
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="bg-orange-100 p-4 rounded-full text-orange-600 mb-4">
                    <Plus className="w-8 h-8" />
                  </div>
                  <p className="text-neutral-700 font-medium mb-1">点击上传或拖拽图片到此处</p>
                  <p className="text-neutral-500 text-sm">每次仅支持 1 张</p>
                </div>
              </div>

              {previewUrls.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {previewUrls.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-neutral-200 group">
                      <img src={url} alt={`Preview ${i}`} className="w-full h-full object-cover" />
                      {!isGenerating && (
                        <button 
                          onClick={() => removeImage(i)}
                          className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
              <h2 className="text-lg font-medium mb-4">2. 选择美化风格</h2>
              <div className="grid grid-cols-2 gap-3">
                {STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    disabled={isGenerating}
                    className={`text-center p-3 rounded-xl border transition-all ${
                      selectedStyle === style.id 
                        ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500 text-orange-700' 
                        : 'border-neutral-200 hover:border-orange-300 hover:bg-neutral-50 text-neutral-700'
                    } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="font-medium">{style.name}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
              <h2 className="text-lg font-medium mb-4">3. 选择输出比例（可多选）</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                      className={`text-center p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500 text-orange-700' 
                          : 'border-neutral-200 hover:border-orange-300 hover:bg-neutral-50 text-neutral-700'
                      } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="font-medium">{ratio.name}</div>
                      <div className="text-xs opacity-70 mt-0.5">{ratio.desc}</div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
              <h2 className="text-lg font-medium mb-4">4. 选择清晰度</h2>
              <div className="grid grid-cols-3 gap-3">
                {RESOLUTIONS.map((res) => (
                  <button
                    key={res.id}
                    onClick={() => setSelectedResolution(res.id)}
                    disabled={isGenerating}
                    className={`text-center p-3 rounded-xl border transition-all ${
                      selectedResolution === res.id 
                        ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500 text-orange-700' 
                        : 'border-neutral-200 hover:border-orange-300 hover:bg-neutral-50 text-neutral-700'
                    } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="font-medium">{res.name}</div>
                    <div className="text-xs opacity-70 mt-0.5">{res.desc}</div>
                  </button>
                ))}
              </div>
            </section>

            <button
              onClick={generateImages}
              disabled={selectedImages.length === 0 || selectedRatios.length === 0 || isGenerating || (allGenerated && selectedStyle === generatedStyle && JSON.stringify(selectedRatios) === JSON.stringify(generatedRatios) && selectedResolution === generatedResolution)}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-medium py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  正在美化 - {generatingRatio}...
                </>
              ) : (selectedStyle !== generatedStyle || JSON.stringify(selectedRatios) !== JSON.stringify(generatedRatios) || selectedResolution !== generatedResolution) && hasResults ? (
                <>
                  <Wand2 className="w-5 h-5" />
                  使用新设置重新美化
                </>
              ) : allGenerated ? (
                <>
                  <Wand2 className="w-5 h-5" />
                  美化完成
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  开始美化
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
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 flex flex-col lg:col-span-8 xl:col-span-9 min-h-0">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-lg font-medium">生成结果</h2>
              {hasResults && (
                <button 
                  onClick={downloadAll}
                  className="text-sm font-medium text-orange-600 hover:text-orange-700 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-orange-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  全部下载
                </button>
              )}
            </div>
            
            <div className={`flex-1 bg-white rounded-xl border border-neutral-200 overflow-hidden relative flex flex-col min-h-0 ${selectedImages.length > 0 ? 'p-6' : 'items-center justify-center'}`}>
              {selectedImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-neutral-400 p-8 text-center h-full">
                  <ImageIcon className="w-12 h-12 mb-3 opacity-50" />
                  <p>美化后的图片将显示在这里</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto pr-2">
                  <div className="flex flex-col gap-10">
                    {selectedImages.map((_, i) => (
                      <div key={i} className="flex flex-col gap-6">
                        
                        <div className={`grid grid-cols-1 ${selectedRatios.length > 1 ? 'xl:grid-cols-2' : ''} gap-x-8 gap-y-10`}>
                          {selectedRatios.map(ratio => {
                            const ratioInfo = RATIOS.find(r => r.id === ratio);
                            const title = `${ratioInfo?.name || ratio}: ${ratioInfo?.desc || ''}`;
                            
                            const url = resultImages[i]?.[ratio];
                            const isGeneratingThis = generatingIndex === i && generatingRatio === ratio;
                            
                            const [w, h] = ratio.split(':').map(Number);
                            const aspectRatioStyle = { aspectRatio: `${w}/${h}` };

                            return (
                              <div key={ratio} className="flex flex-col w-full items-center">
                                <div className="text-sm font-medium text-neutral-800 mb-3 border-b border-neutral-800 pb-2 w-full">
                                  {title}
                                </div>
                                <div 
                                  style={aspectRatioStyle} 
                                  className="relative bg-[#f8f9fa] rounded-xl border border-neutral-200 overflow-hidden flex flex-col items-center justify-center group h-[55vh] max-h-[600px] max-w-full"
                                >
                                  {url ? (
                                    <>
                                      <img 
                                        src={url} 
                                        alt={`Result ${i} ${ratio}`} 
                                        className="w-full h-full object-contain cursor-pointer hover:scale-105 transition-transform duration-300" 
                                        onClick={() => setZoomedImage(url)}
                                      />
                                      <button 
                                        onClick={() => downloadImage(url, i, ratio)}
                                        className="absolute bottom-2 right-2 bg-white/90 text-neutral-800 p-2 rounded-lg shadow-sm hover:bg-white transition-colors opacity-0 group-hover:opacity-100"
                                        title={`下载 ${ratio} 图片`}
                                      >
                                        <Download className="w-4 h-4" />
                                      </button>
                                    </>
                                  ) : isGeneratingThis ? (
                                    <div className="flex flex-col items-center justify-center text-orange-500">
                                      <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                      <span className="text-xs font-medium">生成中...</span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center justify-center text-neutral-300">
                                      <ImageIcon className="w-8 h-8 mb-2 opacity-30" />
                                      <span className="text-sm opacity-60">等待生成</span>
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
