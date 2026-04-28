import React, { useState, useEffect } from 'react';
import Beautify from './pages/Beautify';
import Explosion from './pages/Explosion';
import { Wand2, Layers, Coins } from 'lucide-react';

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
    <div className="flex h-screen overflow-hidden bg-neutral-50 relative">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-neutral-200 flex flex-col relative z-10">
        <div className="h-16 flex items-center px-6 border-b border-neutral-200">
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">AI 美食工坊</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('beautify')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
              activeTab === 'beautify'
                ? 'bg-neutral-900 text-white font-medium'
                : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
            }`}
          >
            <Wand2 className="w-5 h-5" />
            菜品一键美化
          </button>
          <button
            onClick={() => setActiveTab('explosion')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
              activeTab === 'explosion'
                ? 'bg-neutral-900 text-white font-medium'
                : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
            }`}
          >
            <Layers className="w-5 h-5" />
            美食爆炸图
          </button>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        <div className={`absolute inset-0 overflow-y-auto ${activeTab === 'beautify' ? 'block' : 'hidden'}`}>
           <Beautify saasData={saasData} />
        </div>
        <div className={`absolute inset-0 overflow-y-auto ${activeTab === 'explosion' ? 'block' : 'hidden'}`}>
           <Explosion saasData={saasData} />
        </div>

        {/* Top Right Corner - Points Display (Ensured on top) */}
        {saasData && (
          <div className="absolute top-4 right-4 z-[9999] pointer-events-auto">
            <div className="bg-white/95 backdrop-blur-md shadow-lg border border-orange-100 pl-3 pr-4 py-2 rounded-full flex items-center gap-3 transition-all hover:scale-105 hover:shadow-xl group">
              <div 
                className={`p-1.5 rounded-full transition-colors ${points !== null ? 'bg-orange-100 text-orange-600' : 'bg-neutral-100 text-neutral-400'}`}
                onClick={() => saasData && fetchPoints(saasData.userId, saasData.toolId)}
                title="点击刷新积分"
              >
                <Coins className={`w-4 h-4 ${points !== null && points > 0 ? 'animate-bounce' : ''} group-hover:rotate-12 transition-transform`} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-neutral-400 font-medium leading-none mb-0.5 uppercase tracking-wider">Balance</span>
                <span className="text-sm font-bold text-neutral-800 leading-none">
                  {points !== null ? (
                    <span className="text-orange-600">{points}</span>
                  ) : (
                    <span className="text-neutral-300 animate-pulse">---</span>
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
