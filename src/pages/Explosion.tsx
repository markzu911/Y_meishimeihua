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
  const [isCompressing, setIsCompressing] = useState(false);
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
      const file = files[0];
      
      // Use high quality processing
      setIsCompressing(true);
      try {
        const processedBase64 = await processImage(file);
        // Convert base64 back to File object to keep existing logic consistent
        const processedFile = dataURLtoFile(processedBase64, file.name);
        
        setSelectedImages([processedFile]);
        setPreviewUrls([processedBase64]);
        setResultImages([{}]);
        setError(null);
      } catch (err) {
        console.error("Image processing error:", err);
        setError("图片处理失败，请稍后重试");
      } finally {
        setIsCompressing(false);
      }
    }
  };

  const processImage = (file: File): Promise<string> => {
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
          
          // Use high resolution (2560px is excellent for quality while staying safe for size limits)
          const maxSide = 2560;

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
          
          // Ensure background is white
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // Use high quality (0.85 is standard for HQ web images and saves significant space)
          const processed = canvas.toDataURL('image/jpeg', 0.85);
          resolve(processed);
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

          // Upload generated results to SaaS
          newResults.forEach(res => {
            Object.values(res).forEach(url => {
              if (url) {
                // Convert Base64 to Blob for Binary Upload (more efficient, better for bypass 413)
                const uploadToSaaS = async () => {
                  try {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    const formData = new FormData();
                    formData.append('userId', saasData.userId);
                    formData.append('source', 'result');
                    // Ensure we send a proper filename and mime type
                    formData.append('file', blob, `result-${Date.now()}.jpg`);
                    
                    const uploadRes = await fetch('/api/upload/image', {
                       method: 'POST',
                       body: formData // Binary multipart upload
                    });

                    if (!uploadRes.ok) {
                      const errText = await uploadRes.text();
                      console.error("SaaS Upload Failed:", uploadRes.status, errText);
                    }
                  } catch (e) {
                    console.error("SaaS Binary Upload Error", e);
                  }
                };
                uploadToSaaS();
              }
            });
          });
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
    <div className="h-full flex flex-col bg-brand-paper text-neutral-900 font-sans selection:bg-brand-sage/20">
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

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 min-h-0">
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
                      <p className="text-neutral-400 text-[10px] sm:text-xs px-2 sm:px-4 leading-relaxed">支持 JPG, PNG, WebP，最大 20MB（自动保留高画质）</p>
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
                  正在预处理图片...
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
                            const aspectRatioStyle = { aspectRatio: `${w}/${h}` };

                            return (
                              <div key={ratio} className="flex flex-col w-full items-center">
                                <div className="text-[9px] sm:text-[10px] font-bold text-neutral-400 mb-3 sm:mb-4 px-3 sm:px-4 py-1 sm:py-1.5 bg-white rounded-full shadow-sm border border-neutral-100 uppercase tracking-[0.2em] font-display w-fit">
                                  {title}
                                </div>
                                <div 
                                  style={aspectRatioStyle} 
                                  className="relative bg-white rounded-xl sm:rounded-[2rem] border border-neutral-200/50 shadow-xl sm:shadow-2xl shadow-neutral-200/40 overflow-hidden flex flex-col items-center justify-center group w-full lg:h-[60vh] lg:max-h-[700px] @container"
                                >
                                  {url ? (
                                    <>
                                      <img 
                                        src={url} 
                                        alt={`Result ${i} ${ratio}`} 
                                        className="w-full h-full object-contain cursor-zoom-in lg:hover:scale-105 transition-all duration-700 ease-out" 
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
                 <div className="w-full lg:w-3/5 flex items-center justify-center bg-brand-sand rounded-2xl sm:rounded-[2rem] border border-neutral-200/60 shadow-inner p-4 sm:p-6">
                    <div 
                      className="relative w-full max-h-[50vh] lg:max-h-[65vh] @container flex items-center justify-center shadow-2xl rounded-xl sm:rounded-2xl overflow-hidden"
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
