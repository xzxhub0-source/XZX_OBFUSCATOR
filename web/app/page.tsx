"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Copy,
  Download,
  Settings,
  Code,
  Shield,
  Sparkles,
  Upload,
  File,
  X,
  Shuffle,
  CheckCircle,
  Zap,
  Loader2,
  ChevronRight,
  Atom,
  GanttChartSquare,
  Milestone
} from "lucide-react";
import { CodeEditor } from "@/components/CodeEditor";
import { obfuscateLua } from "@/lib/obfuscator";
import {
  trackObfuscation,
  trackCopy,
  trackDownload,
  trackSessionStart,
  trackTimeOnPage,
} from "@/lib/analytics-client";
import type { ObfuscationMetrics } from "@/lib/metrics";

const DEFAULT_LUA_CODE = "-- Welcome to XZX v2\nprint('System initialized...')\n\nfunction protect() \n  local secret = \"Space-Grade Encryption\"\n  return secret\nend";

export default function Home() {
  const [inputCode, setInputCode] = useState(DEFAULT_LUA_CODE);
  const [outputCode, setOutputCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [metrics, setMetrics] = useState<ObfuscationMetrics | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [starPositions, setStarPositions] = useState<{ x: number; y: number; size: number; pulse: number }[]>([]);

  const [settings, setSettings] = useState({
    mangleNames: true,
    encodeStrings: true,
    controlFlow: true,
    antiDebugging: true,
    protectionLevel: 75,
  });

  // Track mouse for light reflection effects
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setMousePos({ 
        x: (e.clientX / window.innerWidth) * 100, 
        y: (e.clientY / window.innerHeight) * 100 
      });
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  // Generate dynamic stars with glow properties
  useEffect(() => {
    const stars = [];
    for (let i = 0; i < 100; i++) {
      stars.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        pulse: Math.random() * 2 * Math.PI,
      });
    }
    setStarPositions(stars);

    const interval = setInterval(() => {
      setStarPositions(prev => prev.map(star => ({
        ...star,
        pulse: (star.pulse + 0.02) % (2 * Math.PI)
      })));
    }, 50);

    return () => clearInterval(interval);
  }, []);

  const obfuscateCode = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const result = await obfuscateLua(inputCode, settings);
      if (result.success) {
        setOutputCode(result.code);
        setMetrics(result.metrics);
        setShowSuccessAnimation(true);
        setTimeout(() => setShowSuccessAnimation(false), 3000);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Celestial interference: Transformation failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(outputCode);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Calculate star glow intensity based on mouse proximity
  const getStarGlow = (starX: number, starY: number) => {
    const dx = starX - mousePos.x;
    const dy = starY - mousePos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return Math.max(0, 1 - distance / 30);
  };

  return (
    <div className="relative min-h-screen w-full bg-[#02010a] text-slate-200 overflow-hidden font-sans selection:bg-purple-500/30">
      
      {/* --- DYNAMIC STAR FIELD WITH LIGHT EMISSION --- */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Base cosmic gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />
        
        {/* Stars with real light emission */}
        {starPositions.map((star, i) => {
          const glowIntensity = getStarGlow(star.x, star.y);
          const pulseIntensity = 0.5 + Math.sin(star.pulse) * 0.3;
          const finalIntensity = glowIntensity * 0.5 + pulseIntensity * 0.5;
          
          return (
            <div key={i}>
              {/* Star core */}
              <div
                className="absolute rounded-full bg-white"
                style={{
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  width: `${star.size}px`,
                  height: `${star.size}px`,
                  boxShadow: `0 0 ${star.size * (4 + glowIntensity * 4)}px rgba(255, 255, 255, ${0.3 + glowIntensity * 0.4})`,
                  opacity: 0.6 + finalIntensity * 0.4,
                  transition: 'box-shadow 0.1s ease-out',
                }}
              />
              
              {/* Light rays (visible on dark background) */}
              {star.size > 1.5 && (
                <>
                  <div
                    className="absolute bg-gradient-to-r from-transparent via-white/10 to-transparent blur-sm"
                    style={{
                      left: `${star.x}%`,
                      top: `${star.y}%`,
                      width: `${star.size * 8}px`,
                      height: `${star.size * 0.5}px`,
                      transform: 'rotate(45deg) translate(-50%, -50%)',
                      opacity: 0.1 + glowIntensity * 0.2,
                    }}
                  />
                  <div
                    className="absolute bg-gradient-to-r from-transparent via-white/10 to-transparent blur-sm"
                    style={{
                      left: `${star.x}%`,
                      top: `${star.y}%`,
                      width: `${star.size * 8}px`,
                      height: `${star.size * 0.5}px`,
                      transform: 'rotate(-45deg) translate(-50%, -50%)',
                      opacity: 0.1 + glowIntensity * 0.2,
                    }}
                  />
                </>
              )}
            </div>
          );
        })}

        {/* Ambient light following mouse */}
        <div 
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(139,92,246,0.15), transparent 50%)`,
          }}
        />
      </div>

      {/* --- MAIN INTERFACE WITH GLASS REFLECTIONS --- */}
      <main className="relative z-10 container mx-auto p-4 md:p-8 flex flex-col gap-6 max-w-7xl">
        
        {/* Header with dynamic light reflection */}
        <header 
          className="flex flex-col md:flex-row justify-between items-center gap-6 p-6 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl group relative overflow-hidden"
          style={{
            boxShadow: `0 20px 40px -15px rgba(139,92,246,0.3)`,
          }}
        >
          {/* Mouse-following light reflection */}
          <div 
            className="absolute inset-0 pointer-events-none transition-opacity duration-500 opacity-0 group-hover:opacity-100"
            style={{
              background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(255,255,255,0.15), transparent 60%)`,
            }}
          />
          
          {/* Edge glow that follows mouse */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(168,85,247,0.1), transparent 70%)`,
              filter: 'blur(30px)',
            }}
          />
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="relative">
              <div 
                className="absolute inset-0 bg-purple-500 blur-xl transition-opacity duration-300"
                style={{
                  opacity: 0.3 + getStarGlow(50, 50) * 0.3,
                }}
              />
              <div className="relative p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl shadow-2xl">
                <Shield className="w-8 h-8 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-200 to-slate-400">
                XZX OBFUSCATOR
              </h1>
              <p className="text-xs text-purple-400/60 font-mono tracking-widest uppercase">Space-Grade Protection v2.0</p>
            </div>
          </div>

          <div className="flex gap-3 relative z-10">
            <Button 
              variant="outline" 
              className="border-white/10 bg-white/5 hover:bg-white/10 text-white backdrop-blur-md relative overflow-hidden group/btn"
              style={{
                boxShadow: `0 5px 15px -5px rgba(139,92,246,0.3)`,
              }}
              onClick={copyToClipboard}
              disabled={!outputCode}
            >
              <div 
                className="absolute inset-0 pointer-events-none opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"
                style={{
                  background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(255,255,255,0.2), transparent 60%)`,
                }}
              />
              {copySuccess ? <CheckCircle className="w-4 h-4 mr-2 text-green-400" /> : <Copy className="w-4 h-4 mr-2" />}
              {copySuccess ? "Copied" : "Copy Output"}
            </Button>
            <Button 
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white border-none shadow-lg relative overflow-hidden group/btn"
              style={{
                boxShadow: `0 10px 25px -10px rgba(139,92,246,0.5)`,
              }}
              onClick={obfuscateCode}
              disabled={isProcessing}
            >
              <div 
                className="absolute inset-0 pointer-events-none opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"
                style={{
                  background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(255,255,255,0.25), transparent 60%)`,
                }}
              />
              {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shuffle className="w-4 h-4 mr-2" />}
              Generate Bytecode
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Settings with glass reflection */}
          <aside className="lg:col-span-3 space-y-6">
            <Card 
              className="p-6 border-white/10 bg-white/[0.03] backdrop-blur-xl relative overflow-hidden group"
              style={{
                boxShadow: `0 20px 40px -15px rgba(139,92,246,0.2)`,
              }}
            >
              {/* Light reflection that follows mouse */}
              <div 
                className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(255,255,255,0.1), transparent 50%)`,
                }}
              />
              
              <h3 className="flex items-center gap-2 text-sm font-bold text-purple-300 mb-6 uppercase tracking-wider relative z-10">
                <Settings className="w-4 h-4" /> Parameters
              </h3>
              
              <div className="space-y-6 relative z-10">
                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <Label className="text-slate-400">Aggression Level</Label>
                    <span className="text-purple-400 font-mono">{settings.protectionLevel}%</span>
                  </div>
                  <Slider 
                    value={[settings.protectionLevel]} 
                    onValueChange={(v) => setSettings({...settings, protectionLevel: v[0]})}
                    max={100} 
                    step={1}
                    className="py-2"
                  />
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between group/switch">
                    <Label className="text-sm text-slate-300">Mangle Names</Label>
                    <Switch 
                      checked={settings.mangleNames} 
                      onCheckedChange={(v) => setSettings({...settings, mangleNames: v})}
                      className="data-[state=checked]:bg-purple-600"
                    />
                  </div>
                  <div className="flex items-center justify-between group/switch">
                    <Label className="text-sm text-slate-300">String Encryption</Label>
                    <Switch 
                      checked={settings.encodeStrings} 
                      onCheckedChange={(v) => setSettings({...settings, encodeStrings: v})}
                      className="data-[state=checked]:bg-purple-600"
                    />
                  </div>
                  <div className="flex items-center justify-between group/switch">
                    <Label className="text-sm text-slate-300">Control Flow</Label>
                    <Switch 
                      checked={settings.controlFlow} 
                      onCheckedChange={(v) => setSettings({...settings, controlFlow: v})}
                      className="data-[state=checked]:bg-purple-600"
                    />
                  </div>
                  <div className="flex items-center justify-between group/switch">
                    <Label className="text-sm text-slate-300">Anti-Debugging</Label>
                    <Switch 
                      checked={settings.antiDebugging} 
                      onCheckedChange={(v) => setSettings({...settings, antiDebugging: v})}
                      className="data-[state=checked]:bg-purple-600"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Metrics Card with light reflection */}
            {metrics && (
              <Card 
                className="p-4 border-purple-500/20 bg-purple-500/5 backdrop-blur-md animate-in fade-in slide-in-from-left duration-500 relative overflow-hidden group"
                style={{
                  boxShadow: `0 10px 25px -10px rgba(139,92,246,0.3)`,
                }}
              >
                <div 
                  className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(168,85,247,0.15), transparent 60%)`,
                  }}
                />
                <h4 className="text-[10px] font-bold text-purple-400 uppercase mb-3 relative z-10">Telemetry Data</h4>
                <div className="grid grid-cols-2 gap-4 relative z-10">
                  <div>
                    <p className="text-[10px] text-slate-500">Processing Time</p>
                    <p className="text-lg font-mono text-white">{metrics.duration}ms</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">Size Delta</p>
                    <p className="text-lg font-mono text-green-400">+{Math.round(metrics.sizeRatio * 100)}%</p>
                  </div>
                </div>
              </Card>
            )}
          </aside>

          {/* Right Column: Editors with glass reflections */}
          <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[500px]">
            {/* Input Editor */}
            <div 
              className="flex flex-col rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md overflow-hidden relative group"
              style={{
                boxShadow: `0 20px 40px -15px rgba(0,0,0,0.5)`,
              }}
            >
              <div 
                className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(139,92,246,0.1), transparent 50%)`,
                }}
              />
              <div className="p-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02] relative z-10">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Code className="w-3 h-3" /> Raw Source
                </span>
                <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => setFileName(e.target.files?.[0]?.name || "")} />
                <button onClick={() => fileInputRef.current?.click()} className="text-[10px] hover:text-purple-400 transition-colors">
                  UPLOAD FILE
                </button>
              </div>
              <div className="flex-1 p-2 relative z-10">
                <CodeEditor
                  value={inputCode}
                  onChange={setInputCode}
                  language="lua"
                  theme="vs-dark"
                />
              </div>
            </div>

            {/* Output Editor */}
            <div 
              className="flex flex-col rounded-2xl border border-purple-500/20 bg-purple-900/5 backdrop-blur-md overflow-hidden relative group"
              style={{
                boxShadow: `0 20px 40px -15px rgba(139,92,246,0.2)`,
              }}
            >
              <div 
                className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(168,85,247,0.15), transparent 50%)`,
                }}
              />
              <div className="p-3 border-b border-purple-500/10 flex items-center justify-between bg-purple-500/5 relative z-10">
                <span className="text-[10px] font-bold uppercase tracking-widest text-purple-300 flex items-center gap-2">
                  <Atom className="w-3 h-3 animate-spin-slow" /> Obfuscated Output
                </span>
                {outputCode && (
                  <button onClick={() => setOutputCode("")} className="text-[10px] text-slate-500 hover:text-white transition-colors">
                    CLEAR
                  </button>
                )}
              </div>
              <div className="flex-1 p-2 relative z-10">
                <CodeEditor
                  value={outputCode}
                  language="lua"
                  theme="vs-dark"
                  options={{ readOnly: true }}
                />
                {!outputCode && !isProcessing && (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-600 pointer-events-none">
                    <p className="text-xs italic font-mono">Awaiting transmission...</p>
                  </div>
                )}
                {isProcessing && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-4 animate-in fade-in">
                    <div className="relative">
                      <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                      <div 
                        className="absolute inset-0 blur-xl"
                        style={{
                          background: `radial-gradient(circle at center, rgba(168,85,247,0.3), transparent 70%)`,
                        }}
                      />
                    </div>
                    <p className="text-xs font-mono text-purple-400 animate-pulse">RESTRUCTURING BYTECODE...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Success Animation Overlay */}
        {showSuccessAnimation && (
          <div 
            className="fixed top-20 right-6 z-50 animate-in slide-in-from-top fade-in duration-300"
            style={{
              filter: `drop-shadow(0 0 20px rgba(139,92,246,0.5))`,
            }}
          >
            <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 backdrop-blur-xl rounded-2xl px-6 py-4 shadow-2xl border border-purple-400/30 flex items-center gap-3 relative overflow-hidden">
              <div 
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(255,255,255,0.2), transparent 60%)`,
                }}
              />
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">Obfuscation Complete!</p>
                <p className="text-purple-200/80 text-xs">Bytecode successfully transformed</p>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="fixed top-20 right-6 z-50 animate-in slide-in-from-top fade-in duration-300">
            <div className="bg-gradient-to-r from-red-500/20 to-pink-500/20 backdrop-blur-xl rounded-2xl px-6 py-4 shadow-2xl border border-red-400/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <X className="w-5 h-5 text-red-300" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">Error</p>
                <p className="text-red-200/80 text-xs">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-auto py-8 text-center relative z-10">
          <div className="inline-block px-6 py-3 rounded-full bg-white/5 backdrop-blur-md border border-white/10 hover:border-purple-500/30 transition-colors duration-300">
            <p className="text-[10px] text-slate-400 font-mono tracking-widest">
              &copy; 2026 XZX INTERSTELLAR SYSTEMS // ENCRYPTED NODE 04
            </p>
          </div>
        </footer>
      </main>

      <style jsx global>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
        
        /* Light reflection effect on hover */
        .group:hover {
          border-color: rgba(168, 85, 247, 0.3);
          transition: all 0.3s ease;
        }
        
        /* Switch styling */
        [data-state="checked"].bg-purple-600 {
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
        }
        
        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 10px;
        }
        
        ::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #8b5cf6, #3b82f6);
          border-radius: 10px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, #9f7aea, #60a5fa);
        }
      `}</style>
    </div>
  );
}
