import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Bot, User, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { ChatMessage } from "../types";

interface StrategyCoachProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  onClearChat: () => void;
}

const QUICK_PROMPTS = [
  "SRS回転法則（ウォールキック）とは？",
  "T-Spin（ティースピン）の組み方を教えて！",
  "AIの評価パラメータはどう調整すべき？",
  "テトリスで生き残るための最重要ルールは？",
];

export function StrategyCoach({
  messages,
  onSendMessage,
  isLoading,
  onClearChat,
}: StrategyCoachProps) {
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput("");
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-[520px] shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-slate-950 px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm font-sans tracking-tight">
              SRS-X テトリスAI軍師
            </h3>
            <p className="text-[10px] text-indigo-400 font-mono font-medium">
              Powered by Gemini 3.5 Flash
            </p>
          </div>
        </div>
        <button
          onClick={onClearChat}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:border-slate-700"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          チャットをクリア
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 min-h-0 bg-slate-900/50">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
            <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">
                テトリスの神髄、SRS回転や戦術について聞いてみよう！
              </p>
              <p className="text-xs text-slate-500 max-w-sm">
                テトリス独自のSuper Rotation System（SRS）における壁蹴りや、効率的なAIの評価指標の調整について、Geminiがアドバイスします。
              </p>
            </div>
            {/* Quick Prompts */}
            <div className="flex flex-wrap gap-2 justify-center max-w-md pt-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => onSendMessage(prompt)}
                  disabled={isLoading}
                  className="text-xs bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-indigo-500/30 rounded-lg px-3 py-1.5 transition-all text-left"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[85%] ${
                  msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border ${
                    msg.role === "user"
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={`rounded-xl p-3 text-sm ${
                    msg.role === "user"
                      ? "bg-emerald-600/10 border border-emerald-500/20 text-slate-100"
                      : "bg-slate-950 border border-slate-850 text-slate-200"
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  <span className="block text-[9px] text-slate-550 text-right mt-1 font-mono">
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 mr-auto max-w-[85%]">
                <div className="w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0 animate-spin">
                  <Loader2 className="w-4 h-4" />
                </div>
                <div className="rounded-xl p-3 bg-slate-950 border border-slate-850 text-slate-400 text-sm flex items-center gap-2">
                  <span>思考中...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          placeholder="テトリスの回転入れ（SRS）や戦術についてチャット..."
          className="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl px-4 py-2 flex items-center justify-center transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
