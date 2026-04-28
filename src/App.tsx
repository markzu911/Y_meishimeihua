import React, { useState, useEffect } from 'react';
import Beautify from './pages/Beautify';
import Explosion from './pages/Explosion';
import { Wand2, Layers, Coins } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface SaasData {
  userId: string;
  toolId: string;
  context?: string;
  prompt?: string[];
  callbackUrl?: string;
}

const extractPoints = (data: any): number | null => {
  if (!data) return null;
  const keys = ['points', 'balance', 'remain', 'credit', 'credits', 'left', 'currentIntegral'];
  for (const obj of [data, data.data]) {
    if (!obj) continue;
    for (const key of keys) {
      if (typeof obj[key] === 'number') return obj[key];
      if (typeof obj[key] === 'string' && !isNaN(Number(obj[key]))) return Number(obj[key]);
    }
  }
  return null;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'beautify' | 'explosion'>('beautify');
  const [saasData, setSaasData] = useState<SaasData | null>(null);
  const [points, setPoints] = useState<number | null>(null);

  const fetchPoints = async (userId: string, toolId: string) => {
    try {
      const res = await fetch('/api/tool/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, toolId })
      });
      const data = await res.json();
      const pts = extractPoints(data);
      if (pts !== null) setPoints(pts);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const data = event.data;
      if (data && data.type === 'SAAS_INIT') {
        console.log('SAAS_INIT received:', data);
        const { userId, toolId, context, prompt, callbackUrl } = data;
        const pts = extractPoints(data);
        if (pts !== null) setPoints(pts);

        if (userId && userId !== 'null' && userId !== 'undefined' && toolId && toolId !== 'null' && toolId !== 'undefined') {
          const saasInfo = { userId, toolId, context, prompt, callbackUrl };
          setSaasData(saasInfo);
          
          try {
            const launchRes = await fetch('/api/tool/launch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, toolId })
            });
            const launchData = await launchRes.json();
            console.log('Launch response:', launchData);
            const launchPts = extractPoints(launchData);
            if (launchPts !== null) setPoints(launchPts);
            else fetchPoints(userId, toolId);
          } catch(e) {
            console.error("Launch error", e);
            // Fallback points fetch
            fetchPoints(userId, toolId);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    const handlePointsUpdate = (e: any) => {
      if (e.detail?.points !== undefined) setPoints(e.detail.points);
      else if (saasData) fetchPoints(saasData.userId, saasData.toolId);
    };
    window.addEventListener('update_points', handlePointsUpdate);
    
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('update_points', handlePointsUpdate);
    };
  }, [saasData]);

  return (
    <div className="flex h-screen overflow-hidden bg-brand-paper relative">
      {/* Sidebar */}
      <div className="w-64 bg-brand-sand border-r border-neutral-200/60 flex flex-col relative z-10">
        <div className="h-20 flex items-center px-8 border-b border-neutral-200/60">
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight font-display">AI 美食工坊</h1>
        </div>
        <nav className="flex-1 p-6 space-y-3">
          <button
            onClick={() => setActiveTab('beautify')}
            className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all duration-300 ${
              activeTab === 'beautify'
                ? 'bg-brand-sage text-white shadow-lg shadow-brand-sage/20 font-medium'
                : 'text-neutral-500 hover:bg-white hover:text-neutral-900 hover:shadow-sm'
            }`}
          >
            <div className={`p-1.5 rounded-lg ${activeTab === 'beautify' ? 'bg-white/20' : 'bg-neutral-100'}`}>
              <Wand2 className="w-4 h-4" />
            </div>
            菜品一键美化
          </button>
          <button
            onClick={() => setActiveTab('explosion')}
            className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all duration-300 ${
              activeTab === 'explosion'
                ? 'bg-brand-sage text-white shadow-lg shadow-brand-sage/20 font-medium'
                : 'text-neutral-500 hover:bg-white hover:text-neutral-900 hover:shadow-sm'
            }`}
          >
            <div className={`p-1.5 rounded-lg ${activeTab === 'explosion' ? 'bg-white/20' : 'bg-neutral-100'}`}>
              <Layers className="w-4 h-4" />
            </div>
            美食爆炸图
          </button>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {activeTab === 'beautify' && (
            <motion.div
              key="beautify"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="absolute inset-0 overflow-y-auto"
            >
              <Beautify saasData={saasData} />
            </motion.div>
          )}
          {activeTab === 'explosion' && (
            <motion.div
              key="explosion"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="absolute inset-0 overflow-y-auto"
            >
              <Explosion saasData={saasData} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Right Corner - Points Display (Ensured on top) */}
        {saasData && (
          <div className="absolute top-6 right-8 z-[9999] pointer-events-auto">
            <div className="bg-white/95 backdrop-blur-md shadow-xl shadow-neutral-200/50 border border-brand-amber/10 pl-3 pr-5 py-2.5 rounded-2xl flex items-center gap-4 transition-all hover:scale-105 hover:shadow-2xl group">
              <div 
                className={`p-2 rounded-xl transition-all duration-500 ${points !== null ? 'bg-brand-amber/10 text-brand-amber shadow-inner' : 'bg-neutral-100 text-neutral-400'}`}
                onClick={() => saasData && fetchPoints(saasData.userId, saasData.toolId)}
                title="点击刷新积分"
              >
                <Coins className={`w-5 h-5 ${points !== null && points > 0 ? 'animate-pulse' : ''} group-hover:rotate-12 transition-transform`} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-neutral-400 font-bold leading-none mb-1 uppercase tracking-[0.15em] font-display">Balance</span>
                <span className="text-base font-bold text-neutral-900 leading-none">
                  {points !== null ? (
                    <span className="text-brand-amber">{points}</span>
                  ) : (
                    <span className="text-neutral-300 animate-pulse italic font-medium">pending</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
