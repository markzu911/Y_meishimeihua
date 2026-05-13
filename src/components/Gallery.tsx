
import React, { useState, useEffect } from 'react';
import { saasService, ImageRecord } from '../services/saasService';
import { SaasData } from '../App';
import { Image as ImageIcon, Trash2, Download, ExternalLink, Calendar, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GalleryProps {
  saasData: SaasData | null;
}

export default function Gallery({ saasData }: GalleryProps) {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchImages = async () => {
    if (!saasData?.userId) return;
    setLoading(true);
    try {
      const res = await saasService.getImages(saasData.userId);
      if (res.success) {
        setImages(res.data);
      } else {
        setError('加载图片记录失败');
      }
    } catch (err) {
      console.error(err);
      setError('加载图片记录发生错误');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (saasData?.userId) {
      fetchImages();
    }
  }, [saasData?.userId]);

  const handleDelete = async (id: string) => {
    if (!saasData?.userId || !window.confirm('确定要删除这张图片记录吗？')) return;
    try {
      const res = await saasService.deleteImage(id, saasData.userId);
      if (res.success) {
        setImages(prev => prev.filter(img => img.id !== id));
      }
    } catch (err) {
      console.error(err);
      alert('删除失败');
    }
  };

  if (!saasData) return null;

  return (
    <div className="mt-20 border-t border-neutral-200/60 pt-12">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-brand-sage/10 p-2 rounded-xl text-brand-sage">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-neutral-900 font-display">我的作品集</h2>
            <p className="text-xs text-neutral-400 font-medium">展示您最近 30 天生成的所有结果图</p>
          </div>
        </div>
        <button 
          onClick={fetchImages}
          className="text-xs font-bold text-brand-sage bg-brand-sand hover:bg-brand-sage/10 px-4 py-2 rounded-full transition-all flex items-center gap-2"
          disabled={loading}
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          刷新列表
        </button>
      </div>

      {loading && images.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-20 bg-brand-sand/30 rounded-[2rem] border border-dashed border-neutral-200">
          <Loader2 className="w-10 h-10 text-brand-sage animate-spin mb-4" />
          <p className="text-neutral-400 font-medium">正在读取创作记录...</p>
        </div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-20 bg-brand-sand/30 rounded-[2rem] border border-dashed border-neutral-200 text-center">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm mb-6">
            <ImageIcon className="w-12 h-12 text-neutral-200" />
          </div>
          <h3 className="text-lg font-bold text-neutral-800 mb-2">暂无作品记录</h3>
          <p className="max-w-xs text-sm text-neutral-400">开始您的 AI 美食创作之旅，生成的精美大图将自动保存在这里</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence>
            {images.map((img) => (
              <motion.div
                key={img.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group relative bg-white rounded-3xl border border-neutral-200/60 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500"
              >
                <div className="aspect-[4/5] relative overflow-hidden bg-neutral-100">
                  <img src={img.url} alt={img.fileName} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                    <div className="flex gap-2">
                       <a 
                        href={img.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-3 bg-white/20 backdrop-blur-md rounded-2xl text-white hover:bg-white hover:text-brand-sage transition-all scale-90 group-hover:scale-100"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </a>
                      <button 
                        onClick={() => handleDelete(img.id)}
                        className="p-3 bg-white/20 backdrop-blur-md rounded-2xl text-white hover:bg-red-500 transition-all scale-90 group-hover:scale-100"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 text-neutral-400 mb-2">
                    <Calendar className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase tracking-widest leading-none">
                      {new Date(img.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-neutral-800 truncate mb-1">{img.fileName}</h4>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-[10px] text-neutral-400 font-medium">
                      {(img.fileSize / 1024 / 1024).toFixed(2)} MB
                    </span>
                    <a 
                      href={img.url} 
                      download={img.fileName}
                      className="flex items-center gap-1.5 text-xs font-bold text-brand-sage hover:opacity-70 transition-opacity"
                    >
                      <Download className="w-3.5 h-3.5" />
                      下载
                    </a>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
