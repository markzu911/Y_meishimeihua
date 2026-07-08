import React, { useState, useEffect, useRef } from 'react';
import Beautify from './pages/Beautify';
import Explosion from './pages/Explosion';
import { Wand2, Layers, Coins, Bot, Sliders, Home, ArrowLeft, ChevronRight, Sparkles, Loader2, Send } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'choice' | 'beautify' | 'explosion'>('choice');
  const [saasData, setSaasData] = useState<SaasData | null>(null);
  const [points, setPoints] = useState<number | null>(null);
  const [mode, setMode] = useState<'agent' | 'expert'>('agent');
  const [showLanding, setShowLanding] = useState<boolean>(true);

  // States for unified selection/greeting chat
  const [choiceMessages, setChoiceMessages] = useState<any[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: '您好！我是您的 **AI 美食视觉管家**。🍱✨\n\n请问您今天想进行哪项美食视觉创作？\n\n1. **菜品一键美化**（智能更换美化菜品背景与光影）\n2. **美食爆炸图**（多层食物级联爆炸拆解特效）\n\n请直接告诉我想进行哪一项，或者输入对应的数字或名字，我将立刻为您开启专属空间。',
      timestamp: new Date()
    }
  ]);
  const [choiceInput, setChoiceInput] = useState('');
  const [isChoiceResponding, setIsChoiceResponding] = useState(false);
  const choiceEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    choiceEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [choiceMessages]);

  const handleChoiceSubmit = async () => {
    const text = choiceInput.trim();
    if (!text) return;
    setChoiceInput('');

    setChoiceMessages(prev => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: text,
        timestamp: new Date()
      }
    ]);

    setIsChoiceResponding(true);

    setTimeout(() => {
      const lowerText = text.toLowerCase();
      let matchedTab: 'beautify' | 'explosion' | null = null;

      if (lowerText.includes('1') || lowerText.includes('美化') || lowerText.includes('beautify') || lowerText.includes('背景') || lowerText.includes('光影') || lowerText.includes('一键')) {
        matchedTab = 'beautify';
      } else if (lowerText.includes('2') || lowerText.includes('爆炸') || lowerText.includes('explosion') || lowerText.includes('拆解') || lowerText.includes('层级')) {
        matchedTab = 'explosion';
      }

      if (matchedTab) {
        setChoiceMessages(prev => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            sender: 'assistant',
            text: `已为您选择 **${matchedTab === 'beautify' ? '菜品一键美化' : '美食爆炸图'}**！✨ 正在为您加载并进入专属创作空间...`,
            timestamp: new Date()
          }
        ]);
        
        setTimeout(() => {
          setActiveTab(matchedTab!);
          setIsChoiceResponding(false);
        }, 1000);
      } else {
        setChoiceMessages(prev => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            sender: 'assistant',
            text: `抱歉，我没有完全理解您的选择。🥺\n\n请告诉我想进行 **1. 菜品一键美化** 还是 **2. 美食爆炸图** 呢？您也可以直接输入对应数字。`,
            timestamp: new Date()
          }
        ]);
        setIsChoiceResponding(false);
      }
    }, 600);
  };

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
                <div className="flex flex-col justify-between h-full w-full">
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
                    onClick={() => {
                      setMode('agent');
                      setActiveTab('choice');
                      setShowLanding(false);
                    }}
                    className="w-full mt-8 py-4 bg-brand-sage hover:bg-brand-sage-dark text-white font-bold rounded-2xl shadow-lg shadow-brand-sage/10 transition-all active:scale-95 flex items-center justify-center gap-2 hover:shadow-xl hover:shadow-brand-sage/20"
                  >
                    <Bot className="w-4 h-4" />
                    <span>开启智能对话引导</span>
                  </button>
                </div>
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
                      setActiveTab('beautify');
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
          {activeTab !== 'choice' && (
            <div className="hidden lg:flex w-64 bg-brand-sand border-r border-neutral-200/60 flex-col relative z-20 shrink-0 justify-between">
              <div>
                <div className="h-20 flex items-center justify-between px-6 border-b border-neutral-200/60">
                  <h1 className="text-lg font-bold text-neutral-900 tracking-tight font-display">AI 美食工坊</h1>
                  <button
                    onClick={() => {
                      if (mode === 'expert') {
                        setShowLanding(true);
                      } else {
                        setActiveTab('choice');
                      }
                    }}
                    className="p-1.5 hover:bg-neutral-200/50 rounded-lg text-neutral-500 hover:text-neutral-950 transition-all active:scale-95"
                    title={mode === 'expert' ? "返回模式选择" : "返回主选择"}
                  >
                    <Home className="w-4.5 h-4.5" />
                  </button>
                </div>
                
                {mode === 'expert' ? (
                  /* Expert Mode Tab Navigation Switchers */
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
                ) : (
                  /* Agent Mode Beautiful Tips Section */
                  <div className="p-6 space-y-4">
                    <div className="bg-white/70 border border-neutral-200/40 rounded-2xl p-5 text-xs text-neutral-600 leading-relaxed shadow-sm">
                      <p className="font-bold text-neutral-800 mb-2.5 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-brand-sage animate-pulse" />
                        智能对话指令
                      </p>
                      您可以在下方的对话框里输入任意诉求，例如：
                      <ul className="list-disc pl-4 mt-2 space-y-1.5">
                        <li>“帮我修改输出比例为 1:1 格式”</li>
                        <li>“画质调整为高清 4K”</li>
                        <li>“我想换成现代极简风格”</li>
                        <li>说 <strong>“开始生成”</strong> 或 <strong>“一键美化”</strong></li>
                        <li>随时说 <strong>“切换到美食爆炸图”</strong> 或 <strong>“切换到一键美化”</strong></li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-neutral-200/60">
                <button
                  onClick={() => {
                    if (mode === 'expert') {
                      setShowLanding(true);
                    } else {
                      setActiveTab('choice');
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-500 hover:bg-white hover:text-neutral-950 transition-all border border-transparent hover:border-neutral-200/50"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{mode === 'expert' ? "返回模式选择" : "重新选择创作"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Mobile Header */}
          <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-neutral-200/60 flex items-center justify-between px-4 z-50">
            <div className="flex items-center gap-1.5">
              {activeTab !== 'choice' && (
                <button
                  onClick={() => setActiveTab('choice')}
                  className="p-1.5 text-neutral-500 hover:text-neutral-900 transition-colors rounded-lg hover:bg-neutral-100"
                  title="返回首页"
                >
                  <Home className="w-4.5 h-4.5" />
                </button>
              )}
              <h1 className="text-base font-bold text-neutral-900 tracking-tight font-display">AI 美食工坊</h1>
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
            <div className="flex-1 relative pt-16 lg:pt-0 flex flex-col justify-center bg-neutral-50/30">
              <AnimatePresence mode="wait">
                {activeTab === 'choice' && (
                  <motion.div
                    key="choice"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="flex-1 max-w-4xl w-full mx-auto flex flex-col h-[calc(100vh-140px)] min-h-[450px] bg-white rounded-3xl border border-neutral-200/50 shadow-xl overflow-hidden self-center my-auto"
                  >
                    {/* Chat Header */}
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
                          <h3 className="font-bold text-sm text-neutral-800">AI 美食视觉管家</h3>
                          <p className="text-[10px] text-neutral-400">正在为您开启专属创作通道</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowLanding(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-500 hover:text-neutral-900 hover:bg-white/80 transition-all border border-transparent hover:border-neutral-200/30 active:scale-95 shadow-sm"
                      >
                        <Home className="w-3.5 h-3.5" />
                        <span>返回模式选择</span>
                      </button>
                    </div>

                    {/* Chat Messages Body */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-neutral-50/50">
                      {choiceMessages.map((msg) => {
                        const isAssistant = msg.sender === 'assistant';
                        return (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm text-xs font-bold ${
                              isAssistant ? 'bg-brand-sage text-white' : 'bg-brand-amber/10 text-brand-amber'
                            }`}>
                              {isAssistant ? <Bot className="w-4 h-4" /> : 'ME'}
                            </div>

                            <div className="flex flex-col max-w-[85%] space-y-2">
                              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                                isAssistant 
                                  ? 'bg-white text-neutral-800 border border-neutral-200/60' 
                                  : 'bg-brand-sage text-white'
                              }`}>
                                <div className="whitespace-pre-wrap">
                                  {renderFormattedText(msg.text)}
                                </div>
                              </div>
                              <span className="text-[9px] text-neutral-400 px-1">
                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}
                      <div ref={choiceEndRef} />
                    </div>

                    {/* Chat Input Bar */}
                    <div className="bg-white px-4 py-3.5 border-t border-neutral-200/60 flex items-center gap-2">
                      <input
                        type="text"
                        value={choiceInput}
                        onChange={(e) => setChoiceInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !isChoiceResponding && handleChoiceSubmit()}
                        placeholder="请选择（例如：“我要做一键美化” 或直接输入 “1”）..."
                        className="flex-1 bg-neutral-100 rounded-xl px-4 py-3 text-sm border-0 focus:ring-2 focus:ring-brand-sage/30 placeholder-neutral-400 focus:outline-none transition-all"
                        disabled={isChoiceResponding}
                      />
                      <button
                        onClick={handleChoiceSubmit}
                        disabled={isChoiceResponding || !choiceInput.trim()}
                        className={`p-3 rounded-xl shadow-lg shadow-brand-sage/15 flex items-center justify-center transition-all active:scale-95 ${
                          choiceInput.trim() && !isChoiceResponding
                            ? 'bg-brand-sage text-white hover:bg-brand-sage-dark'
                            : 'bg-neutral-100 text-neutral-400 shadow-none'
                        }`}
                      >
                        {isChoiceResponding ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
                {activeTab === 'beautify' && (
                  <motion.div
                    key="beautify"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="absolute inset-0 overflow-y-auto"
                  >
                    <Beautify saasData={saasData} mode={mode} setMode={setMode} onChangeTab={(tab) => setActiveTab(tab)} />
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
                    <Explosion saasData={saasData} mode={mode} setMode={setMode} onChangeTab={(tab) => setActiveTab(tab)} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Desktop Top Right Corner - Points Display */}
              {saasData && activeTab !== 'choice' && (
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

            {/* Mobile Bottom Navigation for Expert Mode */}
            {mode === 'expert' && (
              <div className="lg:hidden h-[72px] bg-white border-t border-neutral-200/60 pb-safe z-50 shrink-0">
                <div className="grid grid-cols-2 h-full">
                  <button
                    onClick={() => setActiveTab('beautify')}
                    className={`flex flex-col items-center justify-center gap-1.5 transition-colors ${
                      activeTab === 'beautify' ? 'text-brand-sage' : 'text-neutral-400'
                    }`}
                  >
                    <Wand2 className={`w-5 h-5 ${activeTab === 'beautify' ? 'fill-brand-sage/10' : ''}`} />
                    <span className="text-[10px] font-bold tracking-wider">菜品美化</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('explosion')}
                    className={`flex flex-col items-center justify-center gap-1.5 transition-colors ${
                      activeTab === 'explosion' ? 'text-brand-sage' : 'text-neutral-400'
                    }`}
                  >
                    <Layers className={`w-5 h-5 ${activeTab === 'explosion' ? 'fill-brand-sage/10' : ''}`} />
                    <span className="text-[10px] font-bold tracking-wider">美食爆炸图</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
