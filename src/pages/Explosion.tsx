import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Loader2, Layers, Download, X, Plus, ArrowLeft, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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

export default function Explosion({ saasData }: { saasData: SaasData | null }) {
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [selectedRatios, setSelectedRatios] = useState<AspectRatio[]>(['3:4']);
  const [selectedResolution, setSelectedResolution] = useState<Resolution>('1K');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState<number>(-1);
  const [generatingRatio, setGeneratingRatio] = useState<AspectRatio | null>(null);
  const [resultImages, setResultImages] = useState<Partial<Record<AspectRatio, string | null>>[]>([]);
  const [generatedRatios, setGeneratedRatios] = useState<AspectRatio[]>([]);
  const [generatedResolution, setGeneratedResolution] = useState<Resolution | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
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

  const detectLayers = async (base64Url: string) => {
    const base64Data = base64Url.split(',')[1];
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
           body: JSON.stringify({
              model: "gemini-2.5-flash",
              payload: {
                base64Data,
                prompt
              }
           })
        });
        if (!res.ok) {
           throw new Error("Layer detection failed");
        }
        const data = await res.json();
        const text = data.text || '';
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
        
        // Ensure points always reflect latest verified amount
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
          
          // Clear old layers data for this specific generation
          setLayersData(prev => {
            const next = { ...prev };
            delete next[`${i}-${ratio}`];
            return next;
          });
          setDishNamesData(prev => {
            const next = { ...prev };
            delete next[`${i}-${ratio}`];
            return next;
          });
          setDishNameYData(prev => {
            const next = { ...prev };
            delete next[`${i}-${ratio}`];
            return next;
          });
          setDishNameSizeData(prev => {
            const next = { ...prev };
            delete next[`${i}-${ratio}`];
            return next;
          });
          setLayerNameSizeData(prev => {
            const next = { ...prev };
            delete next[`${i}-${ratio}`];
            return next;
          });
          setDefaultLayersData(prev => {
            const next = { ...prev };
            delete next[`${i}-${ratio}`];
            return next;
          });
          setDefaultDishNamesData(prev => {
            const next = { ...prev };
            delete next[`${i}-${ratio}`];
            return next;
          });
          setDefaultDishNameYData(prev => {
            const next = { ...prev };
            delete next[`${i}-${ratio}`];
            return next;
          });
          setDetectingLayers(prev => {
            const next = { ...prev };
            delete next[`${i}-${ratio}`];
            return next;
          });

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
                      base64Data,
                      mimeType: selectedImages[i].type,
                      prompt,
                      ratio,
                      resolution: selectedResolution
                    }
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

          setResultImages(prev => {
            const next = [...prev];
            next[i] = { ...next[i], [ratio]: generatedUrl };
            return next;
          });

          setDetectingLayers(prev => ({ ...prev, [`${i}-${ratio}`]: true }));
          try {
            const detected = await detectLayers(generatedUrl);
            if (detected && detected.layers) {
              setDefaultLayersData(prev => ({ ...prev, [`${i}-${ratio}`]: detected.layers }));
              setDefaultDishNamesData(prev => ({ ...prev, [`${i}-${ratio}`]: detected.dishName || '招牌美食' }));
              setDefaultDishNameYData(prev => ({ ...prev, [`${i}-${ratio}`]: 5 }));
            }
          } catch (e) {
            console.error("Failed to detect layers", e);
          } finally {
            setDetectingLayers(prev => ({ ...prev, [`${i}-${ratio}`]: false }));
          }
        }
      }

      if (saasData && newResults.some(res => Object.values(res).some(url => url !== null))) {
        try {
          const consumeRes = await fetch('/api/tool/consume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: saasData.userId, toolId: saasData.toolId })
          });
          const consumeData = await consumeRes.json();
          const pts = consumeData?.currentIntegral ?? consumeData?.points ?? consumeData?.balance ?? consumeData?.remain ?? consumeData?.data?.balance ?? consumeData?.data?.points ?? consumeData?.data?.currentIntegral;
          window.dispatchEvent(new CustomEvent('update_points', { detail: { points: pts } }));
        } catch (e) {
          console.error("Consume error", e);
        }
      }

    } catch (err: any) {
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

  const downloadImageWithLabels = async (url: string, index: number, ratio: string) => {
    const layers = layersData[`${index}-${ratio}`];
    const dishName = dishNamesData[`${index}-${ratio}`] || '';
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

  return (
    <div className="h-full flex flex-col bg-neutral-50 text-neutral-900 font-sans selection:bg-neutral-200">
      <header className="bg-white border-b border-neutral-200 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="bg-black p-2 rounded-lg text-white">
                <Layers className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight">美食爆炸图</h1>
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
                className={`border-2 border-dashed rounded-xl overflow-hidden transition-colors cursor-pointer mb-4
                  ${isGenerating ? 'opacity-50 pointer-events-none' : 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50'}`}
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
                    <img src={previewUrls[0]} alt="Preview" className="w-full h-full object-contain bg-neutral-100" />
                    <div 
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                      onClick={() => !isGenerating && fileInputRef.current?.click()}
                    >
                      <div className="bg-white/20 backdrop-blur-sm border border-white/30 text-white px-4 py-2 rounded-full text-sm font-medium">
                        点击更换图片
                      </div>
                    </div>
                    {!isGenerating && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(0);
                        }}
                        className="absolute top-2 right-2 z-10 bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <div className="flex flex-col items-center justify-center py-4">
                      <div className="bg-neutral-100 p-4 rounded-full text-neutral-900 mb-4">
                        <Plus className="w-8 h-8" />
                      </div>
                      <p className="text-neutral-700 font-medium mb-1">点击上传或拖拽图片到此处</p>
                      <p className="text-neutral-500 text-sm">每次仅支持 1 张</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Removing separate preview layout */}
            </section>

            <section className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
              <h2 className="text-lg font-medium mb-4">2. 选择输出比例（可多选）</h2>
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
                          ? 'border-black bg-neutral-900 ring-1 ring-black text-white' 
                          : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 text-neutral-700'
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
              <h2 className="text-lg font-medium mb-4">3. 选择清晰度</h2>
              <div className="grid grid-cols-3 gap-3">
                {RESOLUTIONS.map((res) => (
                  <button
                    key={res.id}
                    onClick={() => setSelectedResolution(res.id)}
                    disabled={isGenerating}
                    className={`text-center p-3 rounded-xl border transition-all ${
                      selectedResolution === res.id 
                        ? 'border-black bg-neutral-900 ring-1 ring-black text-white' 
                        : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 text-neutral-700'
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
              disabled={selectedImages.length === 0 || selectedRatios.length === 0 || isGenerating || (allGenerated && JSON.stringify(selectedRatios) === JSON.stringify(generatedRatios) && selectedResolution === generatedResolution)}
              className="w-full bg-black hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-medium py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  正在生成 - {generatingRatio}...
                </>
              ) : (JSON.stringify(selectedRatios) !== JSON.stringify(generatedRatios) || selectedResolution !== generatedResolution) && hasResults ? (
                <>
                  <Layers className="w-5 h-5" />
                  使用新设置重新生成
                </>
              ) : allGenerated ? (
                <>
                  <Layers className="w-5 h-5" />
                  生成完成
                </>
              ) : (
                <>
                  <Layers className="w-5 h-5" />
                  开始生成
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
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-medium">生成结果</h2>
                {hasResults && (
                  <span className="text-sm text-neutral-700 bg-neutral-100 px-3 py-1 rounded-full flex items-center gap-1.5 border border-neutral-200">
                    <Tag className="w-3.5 h-3.5" />
                    提示：点击图片右下角的标签按钮，即可添加或修改文字标注
                  </span>
                )}
              </div>
              {hasResults && (
                <button 
                  onClick={downloadAll}
                  className="text-sm font-medium text-black hover:text-neutral-700 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-neutral-50 transition-colors"
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
                  <p>生成的爆炸图将显示在这里</p>
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
                                <div className="text-sm font-medium text-neutral-800 mb-3 border-b border-neutral-200 pb-2 w-full">
                                  {title}
                                </div>
                                <div 
                                  style={aspectRatioStyle} 
                                  className="relative bg-[#f8f9fa] rounded-xl border border-neutral-200 overflow-hidden flex flex-col items-center justify-center group h-[55vh] max-h-[600px] max-w-full @container"
                                >
                                  {url ? (
                                    <>
                                      <img 
                                        src={url} 
                                        alt={`Result ${i} ${ratio}`} 
                                        className="w-full h-full object-contain cursor-pointer hover:scale-105 transition-transform duration-300" 
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
                                        className={`absolute bottom-2 right-12 bg-white/90 p-2 rounded-lg shadow-sm transition-colors ${
                                          detectingLayers[`${i}-${ratio}`] 
                                            ? 'text-neutral-400 opacity-100 cursor-not-allowed' 
                                            : 'text-neutral-900 hover:bg-neutral-100 opacity-0 group-hover:opacity-100'
                                        }`}
                                        title={detectingLayers[`${i}-${ratio}`] ? "正在智能识别图层..." : "编辑标注"}
                                      >
                                        {detectingLayers[`${i}-${ratio}`] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
                                      </button>
                                      <button 
                                        onClick={() => downloadImageWithLabels(url, i, ratio)}
                                        className="absolute bottom-2 right-2 bg-white/90 text-neutral-900 p-2 rounded-lg shadow-sm hover:bg-neutral-100 transition-colors opacity-0 group-hover:opacity-100"
                                        title="下载图片"
                                      >
                                        <Download className="w-4 h-4" />
                                      </button>
                                    </>
                                  ) : isGeneratingThis ? (
                                    <div className="flex flex-col items-center justify-center text-neutral-500">
                                      <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                      <span className="text-xs font-medium">生成中...</span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center justify-center text-neutral-400">
                                      <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
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
              className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
                <h3 className="text-lg font-semibold text-neutral-800">编辑图层标注</h3>
                <button onClick={() => setEditingLabel(null)} className="p-1.5 text-neutral-500 hover:bg-neutral-200 rounded-full transition-colors"><X className="w-5 h-5"/></button>
              </div>
              <div className="p-6 overflow-y-auto flex flex-col md:flex-row gap-8 bg-white">
                 <div className="w-full md:w-1/2 flex items-center justify-center bg-neutral-100 rounded-xl border border-neutral-200 overflow-hidden p-2">
                    <div 
                      className="relative w-full max-h-[60vh] @container flex items-center justify-center"
                      style={{ aspectRatio: editingLabel.ratio.replace(':', '/') }}
                    >
                      <img src={editingLabel.url} className="absolute inset-0 w-full h-full object-contain" />
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
                 <div className="w-full md:w-1/2 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                      <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100 space-y-1">
                        <label className="text-xs font-medium text-neutral-500">菜品名称 (顶部居中显示)</label>
                        <div className="flex gap-3">
                          <input 
                            type="text" 
                            value={editingLabel.dishName}
                            onChange={(e) => setEditingLabel({ ...editingLabel, dishName: e.target.value })}
                            placeholder="例如：招牌牛肉面"
                            className="flex-1 border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-800 focus:border-neutral-800 outline-none bg-white"
                          />
                          <div className="w-20 space-y-1">
                            <label className="text-xs font-medium text-neutral-500">位置 (%)</label>
                            <input 
                              type="number" 
                              min="0" max="100"
                              value={editingLabel.dishNameY}
                              onChange={(e) => setEditingLabel({ ...editingLabel, dishNameY: Number(e.target.value) })}
                              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-800 focus:border-neutral-800 outline-none bg-white"
                            />
                          </div>
                          <div className="w-20 space-y-1">
                            <label className="text-xs font-medium text-neutral-500">大小 (%)</label>
                            <input 
                              type="number" 
                              min="10" max="300"
                              value={editingLabel.dishNameSize}
                              onChange={(e) => setEditingLabel({ ...editingLabel, dishNameSize: Number(e.target.value) })}
                              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-800 focus:border-neutral-800 outline-none bg-white"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-neutral-500">您可以修改识别出的图层名称，或调整其垂直位置（0-100%）。</div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-medium text-neutral-500">图层文字大小 (%)</label>
                          <input 
                            type="number" 
                            min="10" max="300"
                            value={editingLabel.layerNameSize}
                            onChange={(e) => setEditingLabel({ ...editingLabel, layerNameSize: Number(e.target.value) })}
                            className="w-20 border border-neutral-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-neutral-800 focus:border-neutral-800 outline-none bg-white"
                          />
                        </div>
                      </div>
                      {editingLabel.layers.map((layer, idx) => (
                        <div key={idx} className="flex gap-3 items-start bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                          <div className="flex-1 space-y-1">
                            <label className="text-xs font-medium text-neutral-500">名称</label>
                            <input 
                              type="text" 
                              value={layer.name}
                              onChange={(e) => {
                                const newLayers = [...editingLabel.layers];
                                newLayers[idx].name = e.target.value;
                                setEditingLabel({ ...editingLabel, layers: newLayers });
                              }}
                              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-800 focus:border-neutral-800 outline-none bg-white"
                            />
                          </div>
                          <div className="w-20 space-y-1">
                            <label className="text-xs font-medium text-neutral-500">位置 (%)</label>
                            <input 
                              type="number" 
                              min="0" max="100"
                              value={layer.y}
                              onChange={(e) => {
                                const newLayers = [...editingLabel.layers];
                                newLayers[idx].y = Number(e.target.value);
                                setEditingLabel({ ...editingLabel, layers: newLayers });
                              }}
                              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-800 focus:border-neutral-800 outline-none bg-white"
                            />
                          </div>
                          <button 
                            onClick={() => {
                              const newLayers = editingLabel.layers.filter((_, i) => i !== idx);
                              setEditingLabel({ ...editingLabel, layers: newLayers });
                            }}
                            className="mt-6 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="删除"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button onClick={() => {
                         setEditingLabel({ ...editingLabel, layers: [...editingLabel.layers, { y: 50, name: '新图层' }]});
                      }} className="w-full py-3 border-2 border-dashed border-neutral-300 text-neutral-600 text-sm font-medium rounded-xl hover:border-neutral-400 hover:text-black hover:bg-neutral-50 transition-colors flex items-center justify-center gap-2">
                        <Plus className="w-4 h-4" /> 添加图层标注
                      </button>
                    </div>
                 </div>
              </div>
              <div className="p-4 border-t border-neutral-200 flex justify-end gap-3 bg-neutral-50">
                <button onClick={() => setEditingLabel(null)} className="px-5 py-2.5 text-neutral-600 hover:bg-neutral-200 rounded-xl font-medium transition-colors">跳过 / 取消</button>
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
                  className="px-5 py-2.5 bg-black text-white rounded-xl font-medium hover:bg-neutral-800 transition-colors shadow-sm"
                >
                  确认并应用
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
