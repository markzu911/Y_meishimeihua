import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Loader2, Wand2, Download, X, Plus, ArrowLeft } from 'lucide-react';
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

export default function Beautify({ saasData }: { saasData: SaasData | null }) {
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
      } catch (err) {
        console.error("Compression error:", err);
        setError("图片处理失败，请稍后重试");
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
                  model: 'gemini-2.5-flash-image',
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

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 min-h-0">
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
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageSelect} 
                  accept="image/*" 
                  className="hidden" 
                />
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
