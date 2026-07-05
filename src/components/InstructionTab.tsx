import React from "react";
import { BookOpen, Github, Key, CheckCircle, Info, Monitor, Cpu, Code } from "lucide-react";

export function InstructionTab() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-300 shadow-xl space-y-5 max-h-[85vh] overflow-y-auto">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
        <BookOpen className="w-5 h-5 text-indigo-400" />
        <h2 className="text-base font-bold text-white font-sans tracking-tight">
          解説: .exe化 & 外部デプロイガイド
        </h2>
      </div>

      <div className="space-y-4 text-xs leading-relaxed">
        {/* EXE desktop conversion explanation */}
        <div className="bg-gradient-to-r from-slate-950 to-indigo-950/40 border border-indigo-900/40 p-4 rounded-xl space-y-3">
          <h3 className="font-bold text-white text-xs flex items-center gap-1.5">
            <Monitor className="w-4 h-4 text-indigo-400" />
            このアプリをデスクトップアプリ (.exe) に変換する方法
          </h3>
          <p className="text-[11px] text-slate-400">
            本アプリは React (Vite) + Node.js (Express) のフルスタック構成で、データ保存に <code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-300 font-mono">users.json</code> を使用しています。
            これを単体のパソコンで動くWindows用デスクトップアプリ（<code className="text-white font-semibold">.exeファイル</code>）にパッケージングする手法として、主に以下の2つが推奨されます。
          </p>

          <div className="space-y-2.5">
            {/* Method A: Electron */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
              <span className="text-[9px] font-bold text-indigo-400 px-1.5 py-0.5 bg-indigo-500/10 rounded uppercase">
                手法 1 (おすすめ): Electron
              </span>
              <h4 className="font-semibold text-white text-xs mt-1">Electron を使用して丸ごと移植</h4>
              <p className="text-[11px] text-slate-400 mt-1">
                ElectronはNode.jsを内包しているため、現在動いている Express バックエンドや <code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-300 font-mono">users.json</code> の読み書き処理を
                <strong>そのままローカルマシンのバックグラウンドで動かすことが可能</strong>です。
              </p>
              <div className="bg-slate-900/60 p-2 rounded text-[10px] font-mono mt-1.5 text-slate-300 space-y-1">
                <p className="text-indigo-400 font-bold">// 1. electron とビルダーをインストール</p>
                <p>npm install --save-dev electron electron-builder</p>
                <p className="text-indigo-400 font-bold">// 2. electron用エントリポイント (main.js) を作成</p>
                <p className="text-[9px] text-slate-500">Expressサーバーを子プロセスで起動し、メインウィンドウで localhost:3000 をロードします。</p>
              </div>
            </div>

            {/* Method B: Tauri */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
              <span className="text-[9px] font-bold text-emerald-400 px-1.5 py-0.5 bg-emerald-500/10 rounded uppercase">
                手法 2 (軽量・高速): Tauri (v2)
              </span>
              <h4 className="font-semibold text-white text-xs mt-1">Tauri を使用して超軽量化</h4>
              <p className="text-[11px] text-slate-400 mt-1">
                TauriはRustでバックエンドを構築し、OS標準 of WebViewを利用するため、
                <strong>アプリサイズが数MB〜数十MBと極めて軽量</strong>かつ高速です。
                Tauri化する場合、Viteで作ったフロントエンド静的ファイルをTauriに読み込ませ、データのセーブ・ロードはRustの「ローカルファイル書き込みコマンド」経由で <code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-300 font-mono">users.json</code> に保存するよう書き換えます。
              </p>
              <div className="bg-slate-900/60 p-2 rounded text-[10px] font-mono mt-1.5 text-slate-300 space-y-1">
                <p className="text-emerald-400 font-bold">// 1. Tauri CLIの追加</p>
                <p>npm install --save-dev @tauri-apps/cli</p>
                <p className="text-emerald-400 font-bold">// 2. 初期セットアップ</p>
                <p>npx tauri init</p>
              </div>
            </div>
          </div>
        </div>

        {/* Free tier explanation */}
        <div className="bg-indigo-950/30 border border-indigo-900/40 p-3.5 rounded-xl space-y-1.5">
          <h3 className="font-bold text-indigo-300 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" />
            Gemini API の無料枠と移植について
          </h3>
          <p className="text-[11px] text-slate-300">
            はい、<strong>Gemini 3.5 Flash などのモデルは、Google AI Studio の無料枠（Free Tier）</strong>で利用可能です。
            無料枠では、<strong>1分間に15回（15 RPM）</strong>まで完全に無料で呼び出すことができます。
            本テトリスAIでの「盤面の進化変異」や「育成チャット」として使うには、余りあるリクエスト回数です。
          </p>
        </div>

        {/* Steps for GitHub Pages */}
        <div className="space-y-2">
          <h3 className="font-bold text-white flex items-center gap-1.5">
            <Github className="w-3.5 h-3.5 text-slate-400" />
            GitHub Pages へのデプロイ手順
          </h3>
          <p className="text-[11px] text-slate-400">
            GitHub Pagesは静的ホスティングなため、サーバーサイドの Node.js (Express) コードを直接ホストすることはできません。
            そのため、誰でもブラウザで遊べるように無料デプロイする場合、以下のいずれかの手法を取ります。
          </p>

          <div className="grid grid-cols-1 gap-2.5">
            <div className="bg-slate-950 p-3 border border-slate-850 rounded-lg space-y-1">
              <span className="text-[9px] font-bold text-emerald-400 px-1.5 py-0.5 bg-emerald-500/10 rounded">
                おすすめ（完全静的・キー入力式）
              </span>
              <h4 className="font-bold text-white text-[11px] mt-1">1. クライアント直接キー呼び出し型</h4>
              <p className="text-[10px] text-slate-400">
                本アプリに搭載している<strong>「GitHub Pages用キー設定」機能</strong>を使用します。
                デプロイされたサイトを閲覧したユーザーが、自分のGemini APIキーをブラウザ上で入力（ブラウザのLocalStorageに保存され安全）すると、サーバー不要でブラウザから直接Geminiを叩いて育成が行えます。
              </p>
            </div>

            <div className="bg-slate-950 p-3 border border-slate-850 rounded-lg space-y-1">
              <span className="text-[9px] font-bold text-indigo-400 px-1.5 py-0.5 bg-indigo-500/10 rounded">
                本格運用（APIプロキシ型）
              </span>
              <h4 className="font-bold text-white text-[11px] mt-1">2. クラウドAPIサーバー連携型</h4>
              <p className="text-[10px] text-slate-400">
                サーバーサイドコード（<code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-300 font-mono text-[9px]">server.ts</code>）を <strong>Cloud Run や Render</strong> などの無料枠のあるホスティング先にデプロイし、静的デプロイしたフロントエンドからそのAPIエンドポイントを呼び出すことで、ユーザーキー不要で動作させます。
              </p>
            </div>
          </div>
        </div>

        {/* Specific Code Changes details */}
        <div className="space-y-2 border-t border-slate-800/60 pt-3">
          <h3 className="font-bold text-white flex items-center gap-1.5">
            <Code className="w-3.5 h-3.5 text-indigo-400" />
            AI「学習内容」とセーブデータ（JSON）
          </h3>
          <ul className="list-disc pl-4 space-y-1.5 text-[11px] text-slate-400">
            <li>
              <strong className="text-slate-200">育成セーブ（users.json）:</strong> 
              ブリーダーとしてログインしている間、育てたAIのパラメータ遺伝子をサーバー上の <code className="bg-slate-950 text-indigo-300 px-1 py-0.5 rounded font-mono text-[10px]">users.json</code> に暗号化されたパスワードとともに永続保存できます。
            </li>
            <li>
              <strong className="text-slate-200">ファイル出力/インポート:</strong> 
              JSONファイルとしてAI個体のクローンデータをPCにダウンロードし、別のブラウザや静的デプロイ先、または将来のデスクトップアプリに読み込ませて同じ能力で遊ぶことも可能です。
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
