import React, { useState, useEffect } from 'react';
import Beautify from './pages/Beautify';
import Explosion from './pages/Explosion';
import { Wand2, Layers, Coins, Bot, Sliders, Home, ArrowLeft, ChevronRight, Sparkles } from 'lucide-react';
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
  const [mode, setMode] = useState<'agent' | 'expert'>('agent');
  const [showLanding, setShowLanding] = useState<boolean>(true);
  const [agentSubSelection, setAgentSubSelection] = useState<boolean>(false);

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
      {showLanding ? (
        <div className="flex-1 min-h-screen bg-gradient-to-b from-brand-sand/30 via-neutral-50 to-neutral-100 flex flex-col justify-between overflow-y-auto font-sans relative w-full">
          {/* Subtle decorative background circles */}
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-sage/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-brand-amber/5 rounded-full blur-3xl pointer-events-none" />

          {/* Top bar with logo and points if saasData exists */}
          <header className="w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between relative z-10 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-brand-sage text-white rounded-lg flex items-center justify-center font-black shadow-md shadow-brand-sage/10 text-sm">
                M
              </div>
              <span className="text-sm font-bold text-neutral-800 tracking-tight font-display">AI 美食视觉工坊</span>
            </div>

            {saasData && (
              <div 
                className="flex items-center gap-2 bg-brand-amber/10 px-4 py-1.5 rounded-full border border-brand-amber/15 cursor-pointer active:scale-95 transition-transform"
                onClick={() => fetchPoints(saasData.userId, saasData.toolId)}
                title="点击刷新积分"
              >
                <Coins className="w-4 h-4 text-brand-amber animate-pulse" />
                <span className="text-xs font-bold text-brand-amber">{points !== null ? points : '...'}</span>
              </div>
            )}
          </header>

          {/* Core Content Box */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 md:py-16 flex flex-col items-center justify-center relative z-10 my-auto">
            {/* Version Pill */}
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-neutral-600 rounded-full border border-neutral-200/50 shadow-sm text-xs font-semibold mb-6 shrink-0"
            >
              <span className="text-brand-sage font-bold">🏠</span>
              <span>美食视觉智能助手 V4.0</span>
            </motion.div>

            {/* Large display titles */}
            <motion.h2 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-neutral-900 text-center font-display mb-4 leading-tight max-w-3xl"
            >
              开启您的 AI 美食视觉之旅
            </motion.h2>

            {/* Subtitle */}
            <motion.p 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-xs sm:text-sm text-neutral-500 max-w-2xl text-center mx-auto mb-10 leading-relaxed font-normal"
            >
              无论您是希望得到贴心的智能设计助理引导，还是渴望在全功能的专业面板上精细调校，我们都为您提供了专属的使用方案。
            </motion.p>

            {/* Cards Container */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full px-4 items-stretch">
              {/* CARD 1: Agent Mode */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white p-8 rounded-3xl border border-neutral-200/60 shadow-xl shadow-neutral-100/30 flex flex-col justify-between hover:shadow-2xl hover:border-neutral-300/40 transition-all duration-300 min-h-[360px]"
              >
                <AnimatePresence mode="wait">
                  {!agentSubSelection ? (
                    <motion.div 
                      key="agent-main"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col justify-between h-full w-full"
                    >
                      <div>
                        {/* Icon header */}
                        <div className="w-12 h-12 bg-neutral-100/80 rounded-2xl flex items-center justify-center mb-6 text-brand-sage">
                          <Bot className="w-6 h-6" />
                        </div>

                        {/* Header title & badge */}
                        <div className="flex items-center">
                          <h3 className="text-xl font-extrabold text-neutral-800 tracking-tight font-display">智能体模式</h3>
                          <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] px-2.5 py-0.5 rounded-full font-bold ml-2.5">
                            推荐新手
                          </span>
                        </div>

                        {/* Description */}
                        <p className="text-xs sm:text-sm text-neutral-500 mt-4 leading-relaxed">
                          对话式交互，像和专业设计师聊天一样。AI 将一步步引导您选定比例、上传照片，直接在聊天框内返回生成效果。
                        </p>
                      </div>

                      <button
                        onClick={() => setAgentSubSelection(true)}
                        className="w-full mt-8 py-4 bg-brand-sage hover:bg-brand-sage-dark text-white font-bold rounded-2xl shadow-lg shadow-brand-sage/10 transition-all active:scale-95 flex items-center justify-center gap-2 hover:shadow-xl hover:shadow-brand-sage/20"
                      >
                        <Bot className="w-4 h-4" />
                        <span>开启智能对话引导</span>
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="agent-options"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col justify-between h-full w-full"
                    >
                      <div>
                        {/* Icon header */}
                        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 text-emerald-600">
                          <Bot className="w-6 h-6" />
                        </div>

                        {/* Header title */}
                        <h3 className="text-xl font-extrabold text-neutral-800 tracking-tight font-display">请选择体验项目</h3>
                        <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
                          请问您接下来想进行哪项美食视觉创作？
                        </p>

                        {/* Two major selection buttons */}
                        <div className="space-y-3 mt-6">
                          <button
                            onClick={() => {
                              setMode('agent');
                              setActiveTab('beautify');
                              setShowLanding(false);
                              setAgentSubSelection(false);
                            }}
                            className="w-full p-4 bg-brand-sand/50 hover:bg-brand-sand hover:shadow-md text-left rounded-2xl border border-brand-sage/15 transition-all flex items-center justify-between group active:scale-[0.99]"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-brand-sage text-white rounded-xl flex items-center justify-center shrink-0">
                                <Wand2 className="w-4 h-4" />
                              </div>
                              <div className="text-left">
                                <div className="text-sm font-bold text-neutral-800">菜品一键美化</div>
                                <div className="text-[10px] text-neutral-500 mt-0.5">智能更换美化菜品背景与光影</div>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-1 transition-transform shrink-0" />
                          </button>

                          <button
                            onClick={() => {
                              setMode('agent');
                              setActiveTab('explosion');
                              setShowLanding(false);
                              setAgentSubSelection(false);
                            }}
                            className="w-full p-4 bg-brand-sand/50 hover:bg-brand-sand hover:shadow-md text-left rounded-2xl border border-brand-sage/15 transition-all flex items-center justify-between group active:scale-[0.99]"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-emerald-600 text-white rounded-xl flex items-center justify-center shrink-0">
                                <Layers className="w-4 h-4" />
                              </div>
                              <div className="text-left">
                                <div className="text-sm font-bold text-neutral-800">美食爆炸图</div>
                                <div className="text-[10px] text-neutral-500 mt-0.5">多层食物级联爆炸拆解特效</div>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-1 transition-transform shrink-0" />
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={() => setAgentSubSelection(false)}
                        className="w-full mt-6 py-2.5 bg-neutral-100 hover:bg-neutral-200/80 text-neutral-600 font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 text-xs border border-neutral-200/40"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>返回上级模式</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* CARD 2: Expert Workbench */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-white p-8 rounded-3xl border border-neutral-200/60 shadow-xl shadow-neutral-100/30 flex flex-col justify-between hover:shadow-2xl hover:border-neutral-300/40 transition-all duration-300 min-h-[360px]"
              >
                <div className="flex flex-col justify-between h-full w-full">
                  <div>
                    {/* Icon header */}
                    <div className="w-12 h-12 bg-neutral-100/80 rounded-2xl flex items-center justify-center mb-6 text-neutral-600">
                      <Sliders className="w-6 h-6" />
                    </div>

                    {/* Header title & badge */}
                    <div className="flex items-center">
                      <h3 className="text-xl font-extrabold text-neutral-800 tracking-tight font-display">专家工作台</h3>
                      <span className="bg-neutral-100 text-neutral-600 border border-neutral-200 text-[10px] px-2.5 py-0.5 rounded-full font-bold ml-2.5">
                        高阶微调
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-xs sm:text-sm text-neutral-500 mt-4 leading-relaxed">
                      经典分步流程。提供高可控性的输出设置、画面比例调节，支持高清原图下载及多视图一次性生成。
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setMode('expert');
                      setShowLanding(false);
                    }}
                    className="w-full mt-8 py-4 bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 font-bold rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 border border-neutral-200/60 hover:shadow-md"
                  >
                    <Sliders className="w-4 h-4" />
                    <span>进入工程师工作台</span>
                  </button>
                </div>
              </motion.div>
            </div>
          </main>

          {/* Simple Footer */}
          <footer className="w-full text-center py-6 text-neutral-400 text-[10px] sm:text-xs relative z-10 border-t border-neutral-100/60 shrink-0">
            <p>© 2026 AI 美食视觉工坊 · 极致餐品视觉重构</p>
          </footer>
        </div>
      ) : (
        <>
          {/* Sidebar for Desktop / Mobile Header */}
          <div className="hidden lg:flex w-64 bg-brand-sand border-r border-neutral-200/60 flex-col relative z-20 shrink-0 justify-between">
            <div>
              <div className="h-20 flex items-center justify-between px-6 border-b border-neutral-200/60">
                <h1 className="text-lg font-bold text-neutral-900 tracking-tight font-display">AI 美食工坊</h1>
                <button
                  onClick={() => setShowLanding(true)}
                  className="p-1.5 hover:bg-neutral-200/50 rounded-lg text-neutral-500 hover:text-neutral-950 transition-all active:scale-95"
                  title="返回模式选择"
                >
                  <Home className="w-4.5 h-4.5" />
                </button>
              </div>
              <nav className="p-6 space-y-3">
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

            <div className="p-6 border-t border-neutral-200/60">
              <button
                onClick={() => setShowLanding(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-500 hover:bg-white hover:text-neutral-950 transition-all border border-transparent hover:border-neutral-200/50"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>切换交互模式</span>
              </button>
            </div>
          </div>

          {/* Mobile Header */}
          <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-neutral-200/60 flex items-center justify-between px-4 z-50">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowLanding(true)}
                className="p-1.5 text-neutral-500 hover:text-neutral-900 transition-colors rounded-lg hover:bg-neutral-100"
                title="返回首页"
              >
                <Home className="w-4.5 h-4.5" />
              </button>
              <h1 className="text-base font-bold text-neutral-900 tracking-tight font-display">AI 美食工坊</h1>
            </div>
            
            {/* Compact Mode Selector on Mobile */}
            <div className="flex bg-neutral-100 p-0.5 rounded-lg border border-neutral-200/30">
              <button
                onClick={() => setMode('agent')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-medium transition-all ${
                  mode === 'agent'
                    ? 'bg-white text-brand-sage shadow-sm font-bold'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>智能体</span>
              </button>
              <button
                onClick={() => setMode('expert')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-medium transition-all ${
                  mode === 'expert'
                    ? 'bg-white text-brand-sage shadow-sm font-bold'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>专家</span>
              </button>
            </div>

            {saasData ? (
              <div 
                className="flex items-center gap-1 bg-brand-amber/10 px-2 py-1 rounded-full border border-brand-amber/10 active:scale-95 transition-transform"
                onClick={() => saasData && fetchPoints(saasData.userId, saasData.toolId)}
              >
                <Coins className="w-3.5 h-3.5 text-brand-amber" />
                <span className="text-xs font-bold text-brand-amber leading-none">{points !== null ? points : '...'}</span>
              </div>
            ) : (
              <div className="w-8"></div>
            )}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-h-0 relative">
            <div className="flex-1 relative pt-16 lg:pt-0">
              <AnimatePresence mode="wait">
                {activeTab === 'beautify' && (
                  <motion.div
                    key="beautify"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="absolute inset-0 overflow-y-auto"
                  >
                    <Beautify saasData={saasData} mode={mode} setMode={setMode} />
                  </motion.div>
                )}
                {activeTab === 'explosion' && (
                  <motion.div
                    key="explosion"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="absolute inset-0 overflow-y-auto"
                  >
                    <Explosion saasData={saasData} mode={mode} setMode={setMode} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Desktop Top Right Corner - Points Display */}
              {saasData && (
                <div className="hidden lg:block absolute top-6 right-8 z-[9999] pointer-events-auto">
                  <div className="bg-white/95 backdrop-blur-md shadow-xl shadow-neutral-200/50 border border-brand-amber/10 pl-3 pr-5 py-2.5 rounded-2xl flex items-center gap-4 transition-all hover:scale-105 hover:shadow-2xl group">
                    <div 
                      className="p-2 rounded-xl transition-all duration-500 bg-brand-amber/10 text-brand-amber shadow-inner cursor-pointer"
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

            {/* Mobile Bottom Navigation */}
            <div className="lg:hidden h-[72px] bg-white border-t border-neutral-200/60 pb-safe z-50">
              <div className="grid grid-cols-2 h-full">
                <button
                  onClick={() => setActiveTab('beautify')}
                  className={`flex flex-col items-center justify-center gap-1.5 transition-colors ${
                    activeTab === 'beautify' ? 'text-brand-sage' : 'text-neutral-400'
                  }`}
                >
                  <Wand2 className={`w-6 h-6 ${activeTab === 'beautify' ? 'fill-brand-sage/10' : ''}`} />
                  <span className="text-[10px] font-bold tracking-wider">美化</span>
                </button>
                <button
                  onClick={() => setActiveTab('explosion')}
                  className={`flex flex-col items-center justify-center gap-1.5 transition-colors ${
                    activeTab === 'explosion' ? 'text-brand-sage' : 'text-neutral-400'
                  }`}
                >
                  <Layers className={`w-6 h-6 ${activeTab === 'explosion' ? 'fill-brand-sage/10' : ''}`} />
                  <span className="text-[10px] font-bold tracking-wider">爆炸图</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
