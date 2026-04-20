import React, { useState, useEffect } from 'react';
import Beautify from './pages/Beautify';
import Explosion from './pages/Explosion';
import { Wand2, Layers } from 'lucide-react';

export interface SaasData {
  userId: string;
  toolId: string;
  context?: string;
  prompt?: string[];
  callbackUrl?: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'beautify' | 'explosion'>('beautify');
  const [saasData, setSaasData] = useState<SaasData | null>(null);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const data = event.data;
      if (data && data.type === 'SAAS_INIT') {
        const { userId, toolId, context, prompt, callbackUrl } = data;
        if (userId && userId !== 'null' && userId !== 'undefined' && toolId && toolId !== 'null' && toolId !== 'undefined') {
          const saasInfo = { userId, toolId, context, prompt, callbackUrl };
          setSaasData(saasInfo);
          
          try {
            await fetch('/api/tool/launch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, toolId })
            });
          } catch(e) {
            console.error("Launch error", e);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-neutral-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-neutral-200">
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">AI 美食工坊</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('beautify')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
              activeTab === 'beautify'
                ? 'bg-orange-50 text-orange-600 font-medium'
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
                ? 'bg-amber-50 text-amber-600 font-medium'
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
        {/* We render both to preserve state, but hide the inactive one */}
        <div className={`absolute inset-0 overflow-y-auto ${activeTab === 'beautify' ? 'block' : 'hidden'}`}>
          <Beautify saasData={saasData} />
        </div>
        <div className={`absolute inset-0 overflow-y-auto ${activeTab === 'explosion' ? 'block' : 'hidden'}`}>
          <Explosion saasData={saasData} />
        </div>
      </div>
    </div>
  );
}
