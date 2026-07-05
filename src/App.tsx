import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  COLS,
  ROWS,
  COLOR_MAP,
  DEFAULT_WEIGHTS,
  SHAPES,
  PREVIEW_SHAPES,
  createEmptyBoard,
  checkCollision,
  clonePiece,
  rotatePieceSRS,
  placePieceOnBoard,
  getGhostY,
  findBestMove,
  generateNewBag,
  analyzeBoardMetrics,
  trainWeightsFromMoves,
} from "./tetrisCore";
import { decoder } from "tetris-fumen";
import {
  Tetromino,
  Piece,
  HeuristicWeights,
  GameMetrics,
  ChatMessage,
  TrainedAI,
  UserMove,
  AIObjectives,
  CustomTemplate,
} from "./types";
import { HeuristicPanel } from "./components/HeuristicPanel";
import { StrategyCoach } from "./components/StrategyCoach";
import { InstructionTab } from "./components/InstructionTab";
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Key,
  BookOpen,
  MessageSquare,
  HelpCircle,
  Eye,
  Info,
  FolderOpen,
  Video,
  History,
  Download,
  Upload,
} from "lucide-react";

const COLOR_MAP_HEX: Record<string, string> = {
  I: "#06b6d4", // cyan-500
  O: "#eab308", // yellow-500
  T: "#a855f7", // purple-500
  J: "#3b82f6", // blue-500
  L: "#f97316", // orange-500
  S: "#22c55e", // green-500
  Z: "#ef4444", // red-500
};

export default function App() {
  // Game States
  const [board, setBoard] = useState<string[][]>(createEmptyBoard());
  const [activePiece, setActivePiece] = useState<Piece | null>(null);
  const [nextPieces, setNextPieces] = useState<Tetromino[]>([]);
  const [holdPiece, setHoldPiece] = useState<Tetromino | null>(null);
  const [hasHeldThisTurn, setHasHeldThisTurn] = useState<boolean>(false);
  const [bag, setBag] = useState<Tetromino[]>([]);

  // Scores & Levels
  const [score, setScore] = useState<number>(0);
  const [lines, setLines] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // AI Play Settings
  const [autoPlay, setAutoPlay] = useState<boolean>(false);
  const [aiSpeed, setAiSpeed] = useState<number>(250); // Speed in ms per drop/move
  const [aiMode, setAiMode] = useState<"instant" | "smooth">("smooth");

  // Heuristics (Learning contents)
  const [weights, setWeights] = useState<HeuristicWeights>(DEFAULT_WEIGHTS);

  // Control Preferences
  const [controlType, setControlType] = useState<"keyboard" | "touch">("keyboard");

  // Imitation Learning
  const [playerHistory, setPlayerHistory] = useState<UserMove[]>([]);
  const [realTimeLearning, setRealTimeLearning] = useState<boolean>(true);
  const [learningLog, setLearningLog] = useState<string>("");

  // Replay States
  const [currentGameHistory, setCurrentGameHistory] = useState<UserMove[]>([]);
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [replayHistory, setReplayHistory] = useState<UserMove[]>([]);
  const [replayIndex, setReplayIndex] = useState<number>(0);
  const [replaySpeed, setReplaySpeed] = useState<number>(500); // ms per step
  const [isReplayPlaying, setIsReplayPlaying] = useState<boolean>(false);

  // Particles & T-Spin Popups
  const [particles, setParticles] = useState<Array<{ id: number; left: string; top: string; color: string; size: string; dx: string; dy: string; duration: string }>>([]);
  const nextParticleId = useRef(0);
  const [tSpinText, setTSpinText] = useState<string | null>(null);
  const [tSpinActive, setTSpinActive] = useState<boolean>(false);
  const [perfectClearText, setPerfectClearText] = useState<string | null>(null);
  const [perfectClearActive, setPerfectClearActive] = useState<boolean>(false);

  // AI Breeder / Training States
  const [aiName, setAiName] = useState<string>("テトちゃん v1");
  const [aiGeneration, setAiGeneration] = useState<number>(1);
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return localStorage.getItem("TETRIS_BREEDER_USER") || null;
  });
  const [savedAIs, setSavedAIs] = useState<TrainedAI[]>([]);

  // Fetch saved AIs if user is already logged in
  useEffect(() => {
    if (currentUser) {
      fetch(`/api/ai/list?username=${encodeURIComponent(currentUser)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.trainedAIs) {
            setSavedAIs(data.trainedAIs);
          }
        })
        .catch((err) => console.error("Failed to fetch saved AIs:", err));
    }
  }, [currentUser]);

  // Auth Handlers
  const handleLoginSuccess = (username: string, userAIs: TrainedAI[]) => {
    setCurrentUser(username);
    setSavedAIs(userAIs);
    localStorage.setItem("TETRIS_BREEDER_USER", username);
    alert(`ブリーダー「${username}」としてログインしました！`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSavedAIs([]);
    localStorage.removeItem("TETRIS_BREEDER_USER");
    alert("ログアウトしました。");
  };

  // Cloud Save via users.json API
  const handleSaveToCloud = async () => {
    if (!currentUser) return;
    const modelToSave: TrainedAI = {
      id: `${aiName}-${Date.now()}`,
      name: aiName,
      generation: aiGeneration,
      weights,
      maxScore: score,
      notes: `レベル${level}に到達、${lines}ライン消去。`,
      createdAt: new Date().toISOString(),
      aiObjectives,
    };

    try {
      const res = await fetch("/api/ai/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: currentUser, aiModel: modelToSave }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSavedAIs(data.trainedAIs || []);
      const savedItem = data.trainedAIs?.find((item: any) => item.name === aiName);
      const codeMsg = savedItem?.serialCode ? `\n（割り当てられた5桁シリアルコード: ${savedItem.serialCode}）` : "";
      alert(`AI「${aiName}」の遺伝子配列をクラウド(users.json)にセーブしました！${codeMsg}`);
    } catch (err: any) {
      alert("セーブに失敗しました: " + err.message);
    }
  };

  // Load from Cloud (users.json)
  const handleLoadFromCloud = (ai: TrainedAI) => {
    setAiName(ai.name);
    setAiGeneration(ai.generation);
    setWeights(ai.weights);
    if (ai.aiObjectives) {
      setAiObjectives(ai.aiObjectives);
    }
    const codeMsg = ai.serialCode ? `\n（シリアルコード: ${ai.serialCode}）` : "";
    alert(`AI「${ai.name}」(第${ai.generation}世代) の遺伝子配列を呼び出して適用しました！${codeMsg}`);
  };

  // AI Genetic Evolution: Mutate weights slightly to next generation
  const handleEvolve = () => {
    const mutate = (val: number, minVal: number, maxVal: number) => {
      // Small mutation of -0.15 to +0.15
      const change = (Math.random() * 0.3 - 0.15);
      const mutated = val + change;
      return Math.max(minVal, Math.min(maxVal, mutated));
    };

    const newWeights: HeuristicWeights = {
      heightPenalty: mutate(weights.heightPenalty, -2.0, 0.0),
      holesPenalty: mutate(weights.holesPenalty, -3.0, 0.0),
      bumpinessPenalty: mutate(weights.bumpinessPenalty, -2.0, 0.0),
      linesClearedReward: mutate(weights.linesClearedReward, 0.0, 2.0),
      wellDepthPenalty: mutate(weights.wellDepthPenalty, -2.0, 0.0),
      tSlotReward: mutate(weights.tSlotReward, 0.0, 2.0),
      speedReward: mutate(weights.speedReward || 0.5, 0.0, 2.0),
      flatnessReward: mutate(weights.flatnessReward || 0.3, 0.0, 2.0),
      fourLineReward: mutate(weights.fourLineReward || 1.5, 0.0, 5.0),
      tSpinReward: mutate(weights.tSpinReward || 2.0, 0.0, 5.0),
      perfectClearReward: mutate(weights.perfectClearReward || 4.0, 0.0, 10.0),
      avoidHoleCoveringPenalty: mutate(weights.avoidHoleCoveringPenalty || -0.5, -3.0, 0.0),
    };

    setWeights(newWeights);
    setAiGeneration((prev) => prev + 1);

    // Dynamic advice from Lab Assistant
    setAdvice(
      `第 ${aiGeneration + 1} 世代への「遺伝子変異」を行いました。
      高さペナルティが ${newWeights.heightPenalty.toFixed(2)} に、空洞ペナルティが ${newWeights.holesPenalty.toFixed(2)} に変異しました。
      さらに、新要素である【①速度特性: ${(newWeights.speedReward || 0).toFixed(2)}】、【②地形の平坦さ: ${(newWeights.flatnessReward || 0).toFixed(2)}】、【③4LINE消去特化: ${(newWeights.fourLineReward || 0).toFixed(2)}】、【④T-Spin優先: ${(newWeights.tSpinReward || 0).toFixed(2)}】、【⑤全消し特化: ${(newWeights.perfectClearReward || 0).toFixed(2)}】、【⑥下穴上の設置回避: ${(newWeights.avoidHoleCoveringPenalty || 0).toFixed(2)}】に進化・変異しました。
      実際のプレイでどのように生存能力や消去戦略が向上するかテストしてください。`
    );
    
    // Automatically rename if default name to reflect gen
    if (aiName === "テトちゃん v1" || aiName.startsWith("テトちゃん v")) {
      setAiName(`テトちゃん v${aiGeneration + 1}`);
    }
  };

  // Gemini Advisors
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [advice, setAdvice] = useState<string | null>(null);
  const [recommendedWeights, setRecommendedWeights] = useState<HeuristicWeights | null>(null);

  // Chat Advisor
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  // Active Panel Tab
  const [activeTab, setActiveTab] = useState<"chat" | "instructions">("chat");

  // Custom API Key (for GitHub Pages clients)
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    return localStorage.getItem("SRS_X_CUSTOM_GEMINI_KEY") || "";
  });
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);

  // AI Objectives
  const [aiObjectives, setAiObjectives] = useState<AIObjectives>({
    clearLine1: true,
    clearLine2: true,
    clearLine3: true,
    clearLine4: true,
    tss: true,
    tsd: true,
    tst: true,
    pc: true,
    ren4Col: false,
  });

  // Keep references to prevent stale states in intervals
  const isPlayingRef = useRef(isPlaying);
  const boardRef = useRef(board);
  const activePieceRef = useRef(activePiece);
  const nextPiecesRef = useRef(nextPieces);
  const holdPieceRef = useRef(holdPiece);
  const hasHeldThisTurnRef = useRef(hasHeldThisTurn);
  const bagRef = useRef(bag);
  const autoPlayRef = useRef(autoPlay);
  const weightsRef = useRef(weights);
  const aiModeRef = useRef(aiMode);
  const playerHistoryRef = useRef(playerHistory);
  const realTimeLearningRef = useRef(realTimeLearning);
  const aiObjectivesRef = useRef(aiObjectives);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { activePieceRef.current = activePiece; }, [activePiece]);
  useEffect(() => { nextPiecesRef.current = nextPieces; }, [nextPieces]);
  useEffect(() => { holdPieceRef.current = holdPiece; }, [holdPiece]);
  useEffect(() => { hasHeldThisTurnRef.current = hasHeldThisTurn; }, [hasHeldThisTurn]);
  useEffect(() => { bagRef.current = bag; }, [bag]);
  useEffect(() => { autoPlayRef.current = autoPlay; }, [autoPlay]);
  useEffect(() => { weightsRef.current = weights; }, [weights]);
  useEffect(() => { aiModeRef.current = aiMode; }, [aiMode]);
  useEffect(() => { playerHistoryRef.current = playerHistory; }, [playerHistory]);
  useEffect(() => { realTimeLearningRef.current = realTimeLearning; }, [realTimeLearning]);
  useEffect(() => { aiObjectivesRef.current = aiObjectives; }, [aiObjectives]);

  // Spawn a new piece
  const spawnPiece = useCallback((
    currentNext: Tetromino[],
    currentBag: Tetromino[],
    currentHold: Tetromino | null,
    isHoldSpawn: boolean = false
  ) => {
    let activeBag = [...currentBag];
    let activeNext = [...currentNext];

    // Replenish bag if low
    if (activeBag.length < 7) {
      activeBag = [...activeBag, ...generateNewBag()];
    }

    // Refill next pieces preview (keep 6 in queue so 5 remain in NEXT previews)
    while (activeNext.length < 6) {
      activeNext.push(activeBag.shift()!);
    }

    const type = activeNext.shift()!;
    const matrix = SHAPES[type];

    // Standard starting positions (centered, at top)
    const startX = Math.floor((COLS - matrix[0].length) / 2);
    const startY = type === Tetromino.I ? -1 : 0; // standard I starts one line higher

    const newPiece: Piece = {
      type,
      matrix,
      x: startX,
      y: startY,
      rotationIndex: 0,
    };

    // Check if spawn collides -> Game Over!
    if (checkCollision(newPiece.matrix, newPiece.x, newPiece.y, boardRef.current)) {
      setGameOver(true);
      setIsPlaying(false);
      return;
    }

    setActivePiece(newPiece);
    setNextPieces(activeNext);
    setBag(activeBag);
    setHasHeldThisTurn(isHoldSpawn);
  }, []);

  // Initialize a new game
  const initGame = useCallback(() => {
    const emptyBoard = createEmptyBoard();
    const initialBag = generateNewBag();
    const initialNext: Tetromino[] = [];

    while (initialNext.length < 6) {
      initialNext.push(initialBag.shift()!);
    }

    setBoard(emptyBoard);
    setHoldPiece(null);
    setScore(0);
    setLines(0);
    setLevel(1);
    setGameOver(false);
    setIsPlaying(true);
    setHasHeldThisTurn(false);

    // Reset Replay Tracker & Particles
    setCurrentGameHistory([]);
    setParticles([]);
    setTSpinActive(false);

    spawnPiece(initialNext, initialBag, null);
  }, [spawnPiece]);

  // Template & Fumen Importer State and Functions
  const [templateInput, setTemplateInput] = useState<string>("");
  const [tptType, setTptType] = useState<string>("opener");
  const [tptPrompt, setTptPrompt] = useState<string>("");
  const tptFileRef = useRef<HTMLInputElement>(null);
  const [templateName, setTemplateName] = useState<string>("");
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>(() => {
    const saved = localStorage.getItem("TETRIS_CUSTOM_TEMPLATES");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      {
        id: "dt-cannon",
        name: "DT砲 (DT Cannon)",
        type: "opener",
        prompt: "左側にDT砲（Double-Triple Cannon）の土台があります。Tミノを差し込んでT-Spin DoubleからT-Spin Tripleを連続で狙いましょう。",
        board: [
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["I", "I", "", "", "", "", "", "L", "L", "L"],
          ["I", "I", "S", "S", "", "", "", "Z", "Z", "L"],
          ["I", "I", "O", "O", "S", "S", "Z", "Z", "J", "J"],
          ["I", "I", "O", "O", "J", "J", "J", "O", "O", ""],
          ["I", "I", "L", "L", "L", "O", "O", "O", "O", ""]
        ],
        createdAt: new Date().toISOString()
      },
      {
        id: "t-spin-donate",
        name: "T-Spin ドネイト基本形",
        type: "donate",
        prompt: "Jミノ、Oミノで屋根を作り、意図的な隙間（ドネイト）を空けてT-Spinを誘発します。Tミノを差し込みT-Spin Doubleを完成させてください。",
        board: [
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", "", ""],
          ["", "", "", "J", "J", "J", "L", "L", "", ""],
          ["I", "I", "", "J", "S", "S", "Z", "L", "L", "L"],
          ["I", "I", "O", "O", "S", "S", "Z", "Z", "J", "J"],
          ["I", "I", "O", "O", "T", "T", "T", "O", "O", "O"]
        ],
        createdAt: new Date().toISOString()
      }
    ];
  });

  const parseTPT = (text: string): string[][] => {
    const rawLines = text.split("\n").map(l => l.trim());
    
    // Extract weights and objectives first
    let weightsData: any = null;
    let objectivesData: any = null;
    
    const filteredLines = rawLines.filter(line => {
      if (line.startsWith("WEIGHTS:")) {
        try {
          weightsData = JSON.parse(line.substring(8));
        } catch (e) {
          console.error("Failed to parse weights from TPT", e);
        }
        return false;
      }
      if (line.startsWith("OBJECTIVES:")) {
        try {
          objectivesData = JSON.parse(line.substring(11));
        } catch (e) {
          console.error("Failed to parse objectives from TPT", e);
        }
        return false;
      }
      return true;
    });

    const boardLines: string[] = [];
    let typeLine = "";
    const promptLines: string[] = [];
    
    let state: "board" | "type" | "prompt" = "board";
    
    for (let i = 0; i < filteredLines.length; i++) {
      const line = filteredLines[i];
      if (state === "board") {
        const isBoardRow = /^[0-7]{10}$/.test(line);
        if (isBoardRow && boardLines.length < 20) {
          boardLines.push(line);
        } else {
          if (line === "") {
            continue;
          }
          typeLine = line;
          state = "prompt";
        }
      } else if (state === "prompt") {
        promptLines.push(line);
      }
    }
    
    const parsed: string[][] = Array.from({ length: 20 }, () => Array(10).fill(""));
    const TPT_MAP: Record<string, string> = {
      "0": "",
      "1": Tetromino.I,
      "2": Tetromino.L,
      "3": Tetromino.J,
      "4": Tetromino.S,
      "5": Tetromino.Z,
      "6": Tetromino.T,
      "7": Tetromino.O,
    };

    const linesCount = boardLines.length;
    const startRow = Math.max(0, 20 - linesCount);

    for (let i = 0; i < linesCount; i++) {
      const rowIdx = startRow + i;
      const lineChars = boardLines[i].split("");
      for (let c = 0; c < 10; c++) {
        const char = lineChars[c] || "0";
        parsed[rowIdx][c] = TPT_MAP[char] || "";
      }
    }

    const normalizedType = typeLine.toLowerCase();
    if (["opener", "mid", "donate"].includes(normalizedType)) {
      setTptType(normalizedType);
    } else if (typeLine) {
      setTptType(typeLine);
    } else {
      setTptType("opener");
    }

    const promptText = promptLines.join("\n").trim();
    setTptPrompt(promptText);

    if (weightsData) {
      setWeights(weightsData);
    }
    if (objectivesData) {
      setAiObjectives(objectivesData);
    }

    return parsed;
  };

  const cleanFumenCode = (text: string): string => {
    let code = text.trim();
    if (code.includes("?")) {
      const parts = code.split("?");
      code = parts[parts.length - 1];
    }
    
    // Convert e.g. "d=115@" or "m=115@" or "v=115@" to "d115@" or "m115@" or "v115@"
    // and "d=110@" or "m=110@" or "v=110@" to "d110@" or "m110@" or "v110@"
    code = code.replace(/([vmd])=(11[05]@)/gi, "$1$2");
    
    // Remove other trailing parameters like &key=val or spaces
    const ampIdx = code.indexOf("&");
    if (ampIdx !== -1) {
      code = code.substring(0, ampIdx);
    }
    
    return code.trim();
  };

  const isFumenInput = (text: string): boolean => {
    const cleaned = text.trim();
    return /([vmd]=?11[05]@)|fumen|zui\.jp/i.test(cleaned);
  };

  const parseFumen = (text: string): string[][] | null => {
    const code = cleanFumenCode(text);
    
    try {
      const pages = decoder.decode(code);
      if (!pages || pages.length === 0) return null;
      
      const fumenField = pages[0].field;
      const parsed: string[][] = Array.from({ length: 20 }, () => Array(10).fill(""));
      for (let r = 0; r < 20; r++) {
        const fumenY = 19 - r;
        for (let c = 0; c < 10; c++) {
          const block = fumenField.at(c, fumenY) as any;
          if (block && block !== "Empty") {
            if (block === "Gray") {
              parsed[r][c] = Tetromino.I;
            } else {
              parsed[r][c] = block as string;
            }
          }
        }
      }
      return parsed;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const handleImportTemplate = (rawText: string) => {
    if (!rawText.trim()) {
      alert("テキスト欄にテンプレートデータ（.tpt またはテト譜）を入力してください。");
      return;
    }
    
    if (isFumenInput(rawText)) {
      try {
        const code = cleanFumenCode(rawText);
        
        const pages = decoder.decode(code);
        if (!pages || pages.length === 0) {
          alert("テト譜のデコード結果が空でした。形式を確認してください。");
          return;
        }

        const allFrames: string[][][] = pages.map(page => {
          const fumenField = page.field;
          const boardFrame: string[][] = Array.from({ length: 20 }, () => Array(10).fill(""));
          for (let r = 0; r < 20; r++) {
            const fumenY = 19 - r;
            for (let c = 0; c < 10; c++) {
              const block = fumenField.at(c, fumenY) as any;
              if (block && block !== "Empty") {
                if (block === "Gray") {
                  boardFrame[r][c] = Tetromino.I; // Gray fallback
                } else {
                  boardFrame[r][c] = block as string;
                }
              }
            }
          }
          return boardFrame;
        });

        // Set live board to the first frame
        setBoard(allFrames[0]);

        // Reset live game state
        const initialBag = generateNewBag();
        const initialNext: Tetromino[] = [];
        while (initialNext.length < 6) {
          initialNext.push(initialBag.shift()!);
        }
        setHoldPiece(null);
        setScore(0);
        setLines(0);
        setLevel(1);
        setGameOver(false);
        setIsPlaying(true);
        setHasHeldThisTurn(false);
        spawnPiece(initialNext, initialBag, null);

        if (allFrames.length > 1) {
          const loadToReplay = window.confirm(
            `テト譜から全 ${allFrames.length} ページの「組み方手順・ライン消去アクション」を検出しました！\n\nリプレイ再生機にロードして、盤面の動きを1コマずつ再現・自動再生しますか？`
          );

          if (loadToReplay) {
            const mockMoves: UserMove[] = allFrames.map((frame) => {
              const dummyPiece: Piece = {
                type: Tetromino.I,
                matrix: [[0]], // empty shape so it doesn't draw extra blocks
                x: 0,
                y: 0,
                rotationIndex: 0,
              };
              return {
                originalBoard: frame,
                placedPiece: dummyPiece,
                holdPieceType: null,
                nextPieceType: Tetromino.I,
                linesCleared: 0,
                isTSpin: false,
              };
            });

            setReplayHistory(mockMoves);
            setReplayIndex(0);
            setIsReplaying(true);
            setIsReplayPlaying(true);
            setReplaySpeed(600); // comfortable speed
            alert(`リプレイ再生機にテト譜の「${allFrames.length} 手順」をロードしました！盤面右下の再生機で再生・一時停止・コマ送りできます。`);
          } else {
            alert(`テト譜の1枚目の盤面をロードしました。`);
          }
        } else {
          alert("テト譜テンプレートを解析し、盤面にロードしました！");
        }
      } catch (err: any) {
        alert("テト譜のデコードに失敗しました。形式を確認してください。 " + err.message);
      }
    } else {
      const parsed = parseTPT(rawText);
      alert(".tpt形式テンプレートを解析し、盤面にロードしました！");
      if (parsed) {
        setBoard(parsed);
        const initialBag = generateNewBag();
        const initialNext: Tetromino[] = [];
        while (initialNext.length < 6) {
          initialNext.push(initialBag.shift()!);
        }
        setHoldPiece(null);
        setScore(0);
        setLines(0);
        setLevel(1);
        setGameOver(false);
        setIsPlaying(true);
        setHasHeldThisTurn(false);
        spawnPiece(initialNext, initialBag, null);
      }
    }
  };

  const handleTrainOnTemplate = () => {
    const currentSimBoard = board.map(row => [...row]);
    const simulatedPieces: Tetromino[] = [];
    const bagGen = generateNewBag();
    for (let i = 0; i < 10; i++) {
      simulatedPieces.push(bagGen[i % bagGen.length]);
    }
    
    const simMoves: UserMove[] = [];
    let tempBoard = currentSimBoard.map(row => [...row]);
    
    for (let i = 0; i < simulatedPieces.length - 1; i++) {
      const currentType = simulatedPieces[i];
      const nextType = simulatedPieces[i + 1];
      
      const currentPiece: Piece = {
        type: currentType,
        matrix: SHAPES[currentType],
        x: Math.floor((COLS - SHAPES[currentType][0].length) / 2),
        y: currentType === Tetromino.I ? -1 : 0,
        rotationIndex: 0,
      };
      
      const bestMove = findBestMove(
        currentPiece,
        null,
        nextType,
        tempBoard,
        weights,
        aiObjectives
      );
      
      let placedPiece = clonePiece(currentPiece);
      for (let r = 0; r < bestMove.rotationIndex; r++) {
        const rotated = rotatePieceSRS(placedPiece, 1, tempBoard);
        if (rotated) placedPiece = rotated;
      }
      placedPiece.x = bestMove.x;
      const finalY = getGhostY(placedPiece, tempBoard);
      placedPiece.y = finalY;
      
      if (checkCollision(placedPiece.matrix, placedPiece.x, placedPiece.y, tempBoard)) {
        break;
      }
      
      const { newBoard, linesCleared, isTSpin } = placePieceOnBoard(placedPiece, tempBoard);
      
      simMoves.push({
        originalBoard: tempBoard.map(row => [...row]),
        placedPiece: clonePiece(placedPiece),
        holdPieceType: null,
        nextPieceType: nextType,
        linesCleared,
        isTSpin
      });
      
      tempBoard = newBoard;
    }
    
    if (simMoves.length === 0) {
      alert("この盤面上ではAIのシミュレーション（ミノの配置）ができませんでした。盤面にブロックが詰まりすぎている可能性があります。");
      return;
    }
    
    const trained = trainWeightsFromMoves(weights, simMoves, 0.08);
    setWeights(trained);
    setLearningLog(`テンプレート盤面から ${simMoves.length} 手分のAI手順を生成して自動最適化を完了しました`);
    alert(`テンプレート盤面をもとに ${simMoves.length} 手のAI自動手順を生成し、模倣学習を実行しました！評価パラメータが更新されました。`);
  };

  const handleExportTPT = () => {
    const TPT_REVERSE_MAP: Record<string, string> = {
      "": "0",
      [Tetromino.I]: "1",
      [Tetromino.L]: "2",
      [Tetromino.J]: "3",
      [Tetromino.S]: "4",
      [Tetromino.Z]: "5",
      [Tetromino.T]: "6",
      [Tetromino.O]: "7",
    };

    let serializedBoard = "";
    for (let r = 0; r < 20; r++) {
      let rowStr = "";
      for (let c = 0; c < 10; c++) {
        const cell = board[r][c];
        rowStr += TPT_REVERSE_MAP[cell] || "0";
      }
      serializedBoard += rowStr + "\n";
    }

    const weightsLine = `WEIGHTS:${JSON.stringify(weights)}`;
    const objectivesLine = `OBJECTIVES:${JSON.stringify(aiObjectives)}`;
    const fileContent = `${serializedBoard}${tptType || "opener"}\n${tptPrompt || ""}\n${weightsLine}\n${objectivesLine}`;

    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `template_${tptType || "custom"}.tpt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    alert(`.tpt テンプレートファイルをエクスポートしました！\n種類: ${tptType}\nプロンプト文字数: ${tptPrompt ? tptPrompt.length : 0}`);
  };

  const handleLoadTemplate = (template: CustomTemplate) => {
    setBoard(template.board);
    setTptType(template.type);
    setTptPrompt(template.prompt);
    
    if (template.weights) {
      setWeights(template.weights);
    }
    if (template.aiObjectives) {
      setAiObjectives(template.aiObjectives);
    }
    
    const initialBag = generateNewBag();
    const initialNext: Tetromino[] = [];
    while (initialNext.length < 6) {
      initialNext.push(initialBag.shift()!);
    }
    setHoldPiece(null);
    setScore(0);
    setLines(0);
    setLevel(1);
    setGameOver(false);
    setIsPlaying(true);
    setHasHeldThisTurn(false);
    spawnPiece(initialNext, initialBag, null);
    
    // reset replay index
    setIsReplaying(false);
    setIsReplayPlaying(false);
    
    alert(`テンプレート「${template.name}」を盤面にロードしました！\nAIコーチ（軍師）の指導方針も自動調整されました。`);
  };

  const handleAddAsTemplate = () => {
    let resolvedBoard = board.map(row => [...row]);
    
    // If there is templateInput, try to parse it first
    if (templateInput.trim()) {
      if (isFumenInput(templateInput)) {
        const parsed = parseFumen(templateInput);
        if (parsed) {
          resolvedBoard = parsed;
        } else {
          alert("入力されたテト譜の解析に失敗したため、現在の盤面状態を使用します。");
        }
      } else {
        try {
          const parsed = parseTPT(templateInput);
          if (parsed) {
            resolvedBoard = parsed;
          }
        } catch (e) {
          // fallback to board
        }
      }
    }

    const nameToUse = templateName.trim() || `カスタム盤面 (${tptType === "opener" ? "開幕" : tptType === "mid" ? "中盤" : "T-Spinドネイト"})`;
    
    const newTemplate: CustomTemplate = {
      id: `tpt-${Date.now()}`,
      name: nameToUse,
      type: tptType,
      prompt: tptPrompt,
      board: resolvedBoard,
      createdAt: new Date().toISOString(),
      weights: { ...weights },
      aiObjectives: { ...aiObjectives },
    };

    const updated = [newTemplate, ...customTemplates];
    setCustomTemplates(updated);
    localStorage.setItem("TETRIS_CUSTOM_TEMPLATES", JSON.stringify(updated));
    setTemplateName("");
    setTemplateInput("");
    
    // Load it to board automatically
    setBoard(resolvedBoard);
    
    alert(`テンプレート「${nameToUse}」をマイ・テンプレートに追加しました！\nいつでも以下の一覧から1クリックで呼び出せます。`);
  };

  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    localStorage.setItem("TETRIS_CUSTOM_TEMPLATES", JSON.stringify(updated));
    alert("テンプレートを削除しました。");
  };

  // Record manual player moves and run imitation learning
  const recordPlayerMove = useCallback((placedPiece: Piece, originalBoard: string[][]) => {
    if (autoPlayRef.current) return; // Only learn when player is playing!

    const holdType = holdPieceRef.current;
    const nextType = nextPiecesRef.current[0] || Tetromino.I;
    
    const { linesCleared, isTSpin } = placePieceOnBoard(placedPiece, originalBoard);

    const newMove: UserMove = {
      originalBoard: originalBoard.map(row => [...row]),
      placedPiece: clonePiece(placedPiece),
      holdPieceType: holdType,
      nextPieceType: nextType,
      linesCleared,
      isTSpin
    };

    setPlayerHistory((prev) => [...prev, newMove]);

    if (realTimeLearningRef.current) {
      setWeights((currentWeights) => {
        const trained = trainWeightsFromMoves(currentWeights, [newMove], 0.05);
        
        // Compute learning logs/deltas
        const logs: string[] = [];
        const diffHeight = (trained.heightPenalty - currentWeights.heightPenalty).toFixed(3);
        const diffHoles = (trained.holesPenalty - currentWeights.holesPenalty).toFixed(3);
        const diffHoleCover = (trained.avoidHoleCoveringPenalty - currentWeights.avoidHoleCoveringPenalty).toFixed(3);
        const diffFlatness = (trained.flatnessReward - currentWeights.flatnessReward).toFixed(3);

        if (parseFloat(diffHeight) !== 0) logs.push(`高さ: ${diffHeight}`);
        if (parseFloat(diffHoles) !== 0) logs.push(`下穴: ${diffHoles}`);
        if (parseFloat(diffHoleCover) !== 0) logs.push(`下穴カバー: ${diffHoleCover}`);
        if (parseFloat(diffFlatness) !== 0) logs.push(`平坦さ: ${diffFlatness}`);

        if (logs.length > 0) {
          setLearningLog(`学習適用: ${logs.join(", ")}`);
        } else {
          setLearningLog("AIは配置パターンを評価完了（調整なし）");
        }
        
        return trained;
      });
    }
  }, []);

  // Record every piece placed for replay logging
  const recordMoveForReplay = useCallback((placedPiece: Piece, originalBoard: string[][]) => {
    const holdType = holdPieceRef.current;
    const nextType = nextPiecesRef.current[0] || Tetromino.I;
    const { newBoard, linesCleared, isTSpin } = placePieceOnBoard(placedPiece, originalBoard);

    const newMove: UserMove = {
      originalBoard: originalBoard.map(row => [...row]),
      placedPiece: clonePiece(placedPiece),
      holdPieceType: holdType,
      nextPieceType: nextType,
      linesCleared,
      isTSpin
    };

    setCurrentGameHistory((prev) => [...prev, newMove]);

    // If T-spin with lines cleared is detected, trigger the overlay popup
    if (isTSpin && linesCleared > 0) {
      let msg = "T-SPIN!";
      if (linesCleared === 1) msg = "T-SPIN SINGLE!";
      else if (linesCleared === 2) msg = "T-SPIN DOUBLE!";
      else if (linesCleared === 3) msg = "T-SPIN TRIPLE!";
      
      setTSpinText(msg);
      setTSpinActive(true);
      
      setTimeout(() => {
        setTSpinActive(false);
      }, 1500);
    }

    // Check for Perfect Clear (All Clear)
    const isPerfectClear = linesCleared > 0 && newBoard.every(row => row.every(cell => cell === ""));
    if (isPerfectClear) {
      setPerfectClearText("PERFECT CLEAR!");
      setPerfectClearActive(true);
      setTimeout(() => {
        setPerfectClearActive(false);
      }, 2500);
    }
  }, []);

  const spawnParticles = useCallback((piece: Piece, finalY: number) => {
    const color = COLOR_MAP_HEX[piece.type] || "#a855f7";
    const newParticles: any[] = [];
    
    for (let r = 0; r < piece.matrix.length; r++) {
      for (let c = 0; c < piece.matrix[r].length; c++) {
        if (piece.matrix[r][c] !== 0) {
          const boardY = finalY + r;
          const boardX = piece.x + c;
          if (boardY >= 0 && boardY < 20 && boardX >= 0 && boardX < 10) {
            for (let p = 0; p < 5; p++) {
              const angle = Math.random() * Math.PI * 2;
              const speed = Math.random() * 40 + 20; // travel distance
              const dx = `${Math.cos(angle) * speed}px`;
              const dy = `${Math.sin(angle) * speed}px`;
              newParticles.push({
                id: ++nextParticleId.current,
                left: `${(boardX + 0.5) * 10}%`,
                top: `${(boardY + 0.5) * 5}%`,
                color,
                size: `${Math.random() * 5 + 3}px`,
                dx,
                dy,
                duration: `${Math.random() * 0.4 + 0.3}s`,
              });
            }
          }
        }
      }
    }
    setParticles((prev) => [...prev, ...newParticles].slice(-100));
  }, []);


  // Force tick drop
  const dropActivePiece = useCallback(() => {
    const piece = activePieceRef.current;
    if (!piece || gameOver || !isPlayingRef.current) return;

    if (!checkCollision(piece.matrix, piece.x, piece.y + 1, boardRef.current)) {
      setActivePiece({
        ...piece,
        y: piece.y + 1,
      });
    } else {
      // Lock piece and clear lines
      const { newBoard, linesCleared, isTSpin } = placePieceOnBoard(piece, boardRef.current);
      setBoard(newBoard);

      // Record player move for imitation learning
      recordPlayerMove(piece, boardRef.current);

      // Record for Replay
      recordMoveForReplay(piece, boardRef.current);

      // Spawn particles
      spawnParticles(piece, piece.y);

      // Score additions (Tetris, single, double, triple, T-spins)
      let pts = 0;
      if (linesCleared === 1) pts = 100 * level;
      else if (linesCleared === 2) pts = 300 * level;
      else if (linesCleared === 3) pts = 500 * level;
      else if (linesCleared === 4) pts = 800 * level;

      if (isTSpin && linesCleared > 0) {
        pts = linesCleared * 1000 * level; // Massive T-spin bonus score!
      }

      // Perfect Clear bonus points
      const isPerfectClear = linesCleared > 0 && newBoard.every(row => row.every(cell => cell === ""));
      if (isPerfectClear) {
        pts += 2000 * level;
      }

      setScore((prev) => prev + pts);
      setLines((prev) => {
        const nextLines = prev + linesCleared;
        const nextLevel = Math.floor(nextLines / 10) + 1;
        setLevel(nextLevel);
        return nextLines;
      });

      spawnPiece(nextPiecesRef.current, bagRef.current, holdPieceRef.current);
    }
  }, [gameOver, spawnPiece, level, recordPlayerMove]);

  // Hard drop
  const hardDrop = useCallback(() => {
    const piece = activePieceRef.current;
    if (!piece || gameOver || !isPlayingRef.current) return;

    const ghostY = getGhostY(piece, boardRef.current);
    const droppedPiece = { ...piece, y: ghostY };

    const { newBoard, linesCleared, isTSpin } = placePieceOnBoard(droppedPiece, boardRef.current);
    setBoard(newBoard);

    // Record player move for imitation learning
    recordPlayerMove(droppedPiece, boardRef.current);

    // Record for Replay
    recordMoveForReplay(droppedPiece, boardRef.current);

    // Spawn particles on hard drop at final depth
    spawnParticles(droppedPiece, ghostY);

    let pts = (ghostY - piece.y) * 2; // drop height pts
    if (linesCleared === 1) pts += 100 * level;
    else if (linesCleared === 2) pts += 300 * level;
    else if (linesCleared === 3) pts += 500 * level;
    else if (linesCleared === 4) pts += 800 * level;

    if (isTSpin && linesCleared > 0) {
       pts += linesCleared * 1000 * level;
    }

    // Perfect Clear bonus points
    const isPerfectClear = linesCleared > 0 && newBoard.every(row => row.every(cell => cell === ""));
    if (isPerfectClear) {
      pts += 2000 * level;
    }

    setScore((prev) => prev + pts);
    setLines((prev) => {
      const nextLines = prev + linesCleared;
      const nextLevel = Math.floor(nextLines / 10) + 1;
      setLevel(nextLevel);
      return nextLines;
    });

    spawnPiece(nextPiecesRef.current, bagRef.current, holdPieceRef.current);
  }, [gameOver, spawnPiece, level, recordPlayerMove]);

  // Move left/right
  const moveHorizontal = useCallback((dir: number) => {
    const piece = activePieceRef.current;
    if (!piece || gameOver || !isPlayingRef.current) return;

    if (!checkCollision(piece.matrix, piece.x + dir, piece.y, boardRef.current)) {
      setActivePiece({
        ...piece,
        x: piece.x + dir,
      });
    }
  }, [gameOver]);

  // Hold piece function
  const holdActivePiece = useCallback(() => {
    const piece = activePieceRef.current;
    if (!piece || gameOver || !isPlayingRef.current || hasHeldThisTurnRef.current) return;

    const currentHold = holdPieceRef.current;
    setHoldPiece(piece.type);
    setHasHeldThisTurn(true);

    if (currentHold === null) {
      // Spawn new piece from bag
      spawnPiece(nextPiecesRef.current, bagRef.current, piece.type, true);
    } else {
      // Spawn held piece at top
      const type = currentHold;
      const matrix = SHAPES[type];
      const startX = Math.floor((COLS - matrix[0].length) / 2);
      const startY = type === Tetromino.I ? -1 : 0;

      const newPiece: Piece = {
        type,
        matrix,
        x: startX,
        y: startY,
        rotationIndex: 0,
      };

      if (checkCollision(newPiece.matrix, newPiece.x, newPiece.y, boardRef.current)) {
        setGameOver(true);
        setIsPlaying(false);
        return;
      }
      setActivePiece(newPiece);
    }
  }, [gameOver, spawnPiece]);

  // Rotate piece manually
  const rotatePiece = useCallback((dir: number) => {
    const piece = activePieceRef.current;
    if (!piece || gameOver || !isPlayingRef.current) return;

    const rotated = rotatePieceSRS(piece, dir, boardRef.current);
    if (rotated) {
      setActivePiece(rotated);
    }
  }, [gameOver]);

  const controlTypeRef = useRef(controlType);
  useEffect(() => {
    controlTypeRef.current = controlType;
  }, [controlType]);

  // Touch & Swipe Control states
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchLastRef = useRef<{ x: number; y: number } | null>(null);
  const swipeMovedRef = useRef<boolean>(false);
  const hasSoftDroppedRef = useRef<boolean>(false);

  // Rotate 180 degrees helper
  const rotatePiece180 = useCallback(() => {
    const piece = activePieceRef.current;
    if (!piece || gameOver || !isPlayingRef.current) return;
    const r1 = rotatePieceSRS(piece, 1, boardRef.current);
    if (r1) {
      const r2 = rotatePieceSRS(r1, 1, boardRef.current);
      if (r2) {
        setActivePiece(r2);
      } else {
        setActivePiece(r1);
      }
    }
  }, [gameOver]);

  // Touch Action Handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (controlTypeRef.current !== "touch" || autoPlayRef.current || gameOver || !isPlayingRef.current || isReplaying) return;
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
    touchLastRef.current = {
      x: touch.clientX,
      y: touch.clientY
    };
    swipeMovedRef.current = false;
    hasSoftDroppedRef.current = false;
  }, [gameOver, isReplaying]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (controlTypeRef.current !== "touch" || autoPlayRef.current || gameOver || !isPlayingRef.current || isReplaying) return;
    if (!touchStartRef.current || !touchLastRef.current) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchLastRef.current.x;
    const deltaY = touch.clientY - touchLastRef.current.y;

    const totalDeltaX = touch.clientX - touchStartRef.current.x;
    const totalDeltaY = touch.clientY - touchStartRef.current.y;

    // Increase general sensitivity by lowering the drag-start detection threshold
    if (Math.abs(totalDeltaX) > 10 || Math.abs(totalDeltaY) > 10) {
      swipeMovedRef.current = true;
    }

    // Swiping Left/Right (Highly responsive with lower threshold)
    if (deltaX > 14) {
      moveHorizontal(1);
      touchLastRef.current.x = touch.clientX;
    } else if (deltaX < -14) {
      moveHorizontal(-1);
      touchLastRef.current.x = touch.clientX;
    }

    // Swiping Down (Maintain -> Soft Drop)
    if (deltaY > 15) {
      dropActivePiece();
      hasSoftDroppedRef.current = true;
      touchLastRef.current.y = touch.clientY;
    }
  }, [gameOver, moveHorizontal, dropActivePiece, isReplaying]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (controlTypeRef.current !== "touch" || autoPlayRef.current || gameOver || !isPlayingRef.current || isReplaying) return;
    if (!touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const totalDeltaX = touch.clientX - touchStartRef.current.x;
    const totalDeltaY = touch.clientY - touchStartRef.current.y;
    const duration = Date.now() - touchStartRef.current.time;

    // Tap Detection
    if (!swipeMovedRef.current && duration < 300 && Math.abs(totalDeltaX) < 15 && Math.abs(totalDeltaY) < 15) {
      const rect = e.currentTarget.getBoundingClientRect();
      const tapX = touch.clientX - rect.left;
      const halfWidth = rect.width / 2;

      if (tapX < halfWidth) {
        // Left side -> ccw
        rotatePiece(-1);
      } else {
        // Right side -> cw
        rotatePiece(1);
      }
    } else {
      // Swipe End Detection
      // Swipe Up -> 180 rotate
      if (totalDeltaY < -60 && Math.abs(totalDeltaX) < Math.abs(totalDeltaY)) {
        rotatePiece180();
      }
      // Swipe Down -> Hard drop (Only trigger with a sharp swipe: deep drag AND fast duration)
      else if (totalDeltaY > 80 && Math.abs(totalDeltaX) < Math.abs(totalDeltaY) && duration < 220) {
        hardDrop();
      }
    }

    touchStartRef.current = null;
    touchLastRef.current = null;
  }, [gameOver, rotatePiece, rotatePiece180, hardDrop, isReplaying]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (autoPlayRef.current || isReplaying) return; // Ignore keyboard input if AI is playing or in Replay mode
      if (controlTypeRef.current !== "keyboard") return; // Only process if in keyboard mode

      switch (e.key) {
        case "ArrowLeft":
          moveHorizontal(-1);
          break;
        case "ArrowRight":
          moveHorizontal(1);
          break;
        case "ArrowDown":
          dropActivePiece();
          break;
        case "ArrowUp":
          rotatePiece(1); // Clockwise rotation
          break;
        case "z":
        case "Z":
          rotatePiece(-1); // Counter-clockwise rotation
          break;
        case " ":
          hardDrop();
          break;
        case "c":
        case "C":
        case "Shift":
          holdActivePiece();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [moveHorizontal, dropActivePiece, rotatePiece, hardDrop, holdActivePiece]);

  // --- Replay Auto-Play Loop & Handlers ---
  useEffect(() => {
    if (!isReplaying || !isReplayPlaying) return;

    const interval = setInterval(() => {
      setReplayIndex((prev) => {
        if (prev >= replayHistory.length - 1) {
          setIsReplayPlaying(false);
          alert("リプレイ再生が完了しました！");
          return prev;
        }
        return prev + 1;
      });
    }, replaySpeed);

    return () => clearInterval(interval);
  }, [isReplaying, isReplayPlaying, replayHistory, replaySpeed]);

  const handlePrevReplayStep = () => {
    if (replayIndex > 0) {
      setReplayIndex(prev => prev - 1);
    }
  };

  const handleNextReplayStep = () => {
    if (replayIndex < replayHistory.length - 1) {
      setReplayIndex(prev => prev + 1);
    }
  };

  const handleToggleReplayPlay = () => {
    setIsReplayPlaying(prev => !prev);
  };

  const handleStopReplay = () => {
    setIsReplayPlaying(false);
    setIsReplaying(false);
    setReplayHistory([]);
    setReplayIndex(0);
    initGame();
  };

  const handleReplayImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (parsed[0].originalBoard && parsed[0].placedPiece) {
            setReplayHistory(parsed);
            setReplayIndex(0);
            setIsReplaying(true);
            setIsReplayPlaying(false);
            setAutoPlay(false);
            setIsPlaying(false);
            alert(`過去のプレイ内容（合計 ${parsed.length} 手）を読み込みました！再生ボタンで再現プレイを開始できます。`);
          } else {
            alert("無効なリプレイファイル形式です。");
          }
        } else {
          alert("リプレイデータが空、または配列形式ではありません。");
        }
      } catch (err) {
        alert("JSONファイルの解析に失敗しました。");
      }
    };
    reader.readAsText(file);
  };

  const exportReplayJSON = () => {
    if (currentGameHistory.length === 0) {
      alert("エクスポートする直近のプレイ履歴がありません。一度ゲームをプレイしてください。");
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentGameHistory, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `tetris-replay-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };


  // Standard Gravity Drop Speed (increases with levels)
  useEffect(() => {
    if (!isPlaying || gameOver || autoPlay) return;

    const speed = Math.max(50, 1000 - (level - 1) * 100);
    const interval = setInterval(dropActivePiece, speed);

    return () => clearInterval(interval);
  }, [isPlaying, gameOver, level, dropActivePiece, autoPlay]);

  // --- AI Auto-Play Loop ---
  useEffect(() => {
    if (!isPlaying || gameOver || !autoPlay) return;

    let isScheduled = false;

    const aiInterval = setInterval(() => {
      if (isScheduled) return;

      const piece = activePieceRef.current;
      if (!piece) return;

      // 1. Solve board to find the best target move
      const targetMove = findBestMove(
        piece,
        holdPieceRef.current,
        nextPiecesRef.current[0] || Tetromino.I,
        boardRef.current,
        weightsRef.current,
        aiObjectivesRef.current
      );

      // If the solver suggests holding, and we can hold:
      if (targetMove.useHold && !hasHeldThisTurnRef.current) {
        isScheduled = true;
        holdActivePiece();
        setTimeout(() => { isScheduled = false; }, 50);
        return;
      }

      // If we are in INSTANT AI play mode, simply snap and drop immediately!
      if (aiModeRef.current === "instant") {
        isScheduled = true;

        // Apply rotation
        let currentSim = clonePiece(piece);
        for (let r = 0; r < targetMove.rotationIndex; r++) {
          const rotated = rotatePieceSRS(currentSim, 1, boardRef.current);
          if (rotated) currentSim = rotated;
        }

        // Apply X positioning
        currentSim.x = targetMove.x;

        // Apply hard drop
        const finalY = getGhostY(currentSim, boardRef.current);
        currentSim.y = finalY;

        if (checkCollision(currentSim.matrix, currentSim.x, currentSim.y, boardRef.current)) {
          setGameOver(true);
          setIsPlaying(false);
          isScheduled = false;
          return;
        }

        // Lock it down!
        const { newBoard, linesCleared, isTSpin } = placePieceOnBoard(currentSim, boardRef.current);
        setBoard(newBoard);

        // Record for Replay
        recordMoveForReplay(currentSim, boardRef.current);

        // Particles!
        spawnParticles(currentSim, finalY);

        let pts = 10;
        if (linesCleared === 1) pts += 100 * level;
        else if (linesCleared === 2) pts += 300 * level;
        else if (linesCleared === 3) pts += 500 * level;
        else if (linesCleared === 4) pts += 800 * level;

        if (isTSpin && linesCleared > 0) {
          pts += linesCleared * 1000 * level;
        }

        // Perfect Clear bonus points
        const isPerfectClear = linesCleared > 0 && newBoard.every(row => row.every(cell => cell === ""));
        if (isPerfectClear) {
          pts += 2000 * level;
        }

        setScore((prev) => prev + pts);
        setLines((prev) => {
          const nextLines = prev + linesCleared;
          const nextLevel = Math.floor(nextLines / 10) + 1;
          setLevel(nextLevel);
          return nextLines;
        });

        spawnPiece(nextPiecesRef.current, bagRef.current, holdPieceRef.current);
        isScheduled = false;
        return;
      }

      // Smooth simulation (moves piece towards targets step by step)
      isScheduled = true;

      // Check rotation first
      if (piece.rotationIndex !== targetMove.rotationIndex) {
        const nextRot = rotatePieceSRS(piece, 1, boardRef.current);
        if (nextRot) {
          setActivePiece(nextRot);
        } else {
          // If kick fails, force adjust index or try translation
          piece.rotationIndex = targetMove.rotationIndex;
          setActivePiece({ ...piece });
        }
        isScheduled = false;
        return;
      }

      // Check horizontal positioning
      if (piece.x !== targetMove.x) {
        const dx = Math.sign(targetMove.x - piece.x);
        if (!checkCollision(piece.matrix, piece.x + dx, piece.y, boardRef.current)) {
          setActivePiece({
            ...piece,
            x: piece.x + dx,
          });
        } else {
          // Force snap x if blocked by edge cases
          piece.x = targetMove.x;
          setActivePiece({ ...piece });
        }
        isScheduled = false;
        return;
      }

      // Locked in position, drop!
      hardDrop();
      isScheduled = false;

    }, Math.max(10, Math.floor(aiSpeed * Math.max(0.05, 1 - (weightsRef.current.speedReward || 0.5) * 0.45))));

    return () => clearInterval(aiInterval);
  }, [isPlaying, gameOver, autoPlay, aiSpeed, spawnPiece, hardDrop, level, weights]);

  // Compute live metrics for Gemini scans
  const getLiveMetrics = (): GameMetrics => {
    const analysis = analyzeBoardMetrics(board);
    return {
      linesCleared: lines,
      level: level,
      holesCount: analysis.totalHoles,
      maxHeight: analysis.maxColHeight,
    };
  };

  // Helper: Direct Client-Side Gemini Call (for GitHub Pages static demo)
  const callGeminiDirectly = async (endpoint: "analyze" | "chat", payload: any) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${customApiKey}`;

    let systemInstruction = "";
    let contents: any[] = [];

    if (endpoint === "analyze") {
      systemInstruction = "You are an expert Tetris grandmaster and computer science AI researcher specializing in Super Rotation System (SRS) heuristics. You have a default knowledge base of standard SRS wall kicks and T-spin criteria (3-corner rule).";
      const boardString = payload.board
        .map((row: number[]) => row.map((cell: any) => (cell ? "█" : ".")).join(""))
        .join("\n");

      contents = [{
        role: "user",
        parts: [{
          text: `
You are the AI Brain Optimizer for SRS-X Tetris. Analyze the current board state and recommend optimized weights.

### Current Board State (█ = block, . = empty):
${boardString}

### Game Context:
- Active Piece: ${payload.activePiece || "None"}
- Hold Piece: ${payload.holdPiece || "None"}
- Current Performance Metrics:
  * Total Lines Cleared: ${payload.metrics?.linesCleared || 0}
  * Number of Holes: ${payload.metrics?.holesCount || 0}
  * Maximum Height: ${payload.metrics?.maxHeight || 0}

Provide your response in JSON format matching this schema:
{
  "advice": "Japanese tactical recommendation (2-3 sentences)",
  "weights": {
    "heightPenalty": number (typically negative between -2.0 and 0.0),
    "holesPenalty": number (typically negative between -3.0 and 0.0),
    "bumpinessPenalty": number (typically negative between -2.0 and 0.0),
    "linesClearedReward": number (positive between 0.0 and 2.0),
    "wellDepthPenalty": number (typically negative between -2.0 and 0.0),
    "tSlotReward": number (positive between 0.0 and 2.0)
  }
}
`
        }]
      }];
    } else {
      systemInstruction = "You are the SRS-X Tetris Strategist Coach. Explain SRS kicks, T-spins, heuristics, and survival strategies clearly in Japanese. You have a default knowledge base of standard SRS wall kicks and T-spin rules to help explain how pieces move.";
      contents = payload.messages.map((m: any) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }]
      }));
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          responseMimeType: endpoint === "analyze" ? "application/json" : "text/plain",
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Gemini direct call failed");
    }

    const resJson = await response.json();
    const textOutput = resJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return textOutput;
  };

  // Trigger Gemini Board Scan & Optimization
  const handleAnalyzeBoard = async () => {
    setIsAnalyzing(true);
    try {
      const metrics = getLiveMetrics();
      const currentWeights = weights;

      if (customApiKey) {
        // Direct Client-Side call
        const responseText = await callGeminiDirectly("analyze", {
          board,
          activePiece: activePiece?.type || "None",
          holdPiece,
          nextPieces: nextPieces.slice(0, 3),
          metrics,
          currentWeights,
          tptType,
          tptPrompt,
        });

        const data = JSON.parse(responseText.trim());
        if (data.advice) setAdvice(data.advice);
        if (data.weights) setRecommendedWeights(data.weights);
      } else {
        // Standard Server-Side Proxy Call
        const response = await fetch("/api/gemini/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            board,
            activePiece: activePiece?.type || "None",
            holdPiece,
            nextPieces: nextPieces.slice(0, 3),
            metrics,
            currentWeights,
            tptType,
            tptPrompt,
          }),
        });

        const data = await response.json();
        if (response.ok) {
          if (data.advice) setAdvice(data.advice);
          if (data.weights) setRecommendedWeights(data.weights);
        } else {
          throw new Error(data.error || "Failed to fetch scan");
        }
      }
    } catch (err: any) {
      alert("AI分析エラー: " + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Apply weights suggested by Gemini
  const handleApplyRecommended = () => {
    if (recommendedWeights) {
      setWeights(recommendedWeights);
      alert("Geminiの推奨パラメータをAIのブレインに適用しました！");
    }
  };

  // Reset Weights
  const handleResetWeights = () => {
    setWeights(DEFAULT_WEIGHTS);
  };

  // Send message to Coach
  const handleSendChatMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString(),
    };

    const nextMessages = [...chatMessages, userMsg];
    setChatMessages(nextMessages);
    setIsChatLoading(true);

    try {
      if (customApiKey) {
        // Direct client side chat
        const responseText = await callGeminiDirectly("chat", {
          messages: nextMessages,
          tptType,
          tptPrompt,
        });

        const botMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: responseText,
          timestamp: new Date().toLocaleTimeString(),
        };
        setChatMessages((prev) => [...prev, botMsg]);
      } else {
        // Server side proxy chat
        const response = await fetch("/api/gemini/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: nextMessages,
            tptType,
            tptPrompt,
          }),
        });

        const data = await response.json();
        if (response.ok) {
          const botMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: data.reply,
            timestamp: new Date().toLocaleTimeString(),
          };
          setChatMessages((prev) => [...prev, botMsg]);
        } else {
          throw new Error(data.error || "Chat failed");
        }
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: `軍師との通信エラーが発生しました: ${err.message}`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSaveApiKey = (key: string) => {
    setCustomApiKey(key);
    if (key) {
      localStorage.setItem("SRS_X_CUSTOM_GEMINI_KEY", key);
    } else {
      localStorage.removeItem("SRS_X_CUSTOM_GEMINI_KEY");
    }
    setShowKeyModal(false);
  };

  // Display mappings depending on whether we are in a Replay session or live gameplay
  const holdPieceToDisplay = isReplaying
    ? (replayHistory[replayIndex]?.holdPiece || null)
    : holdPiece;

  const nextPiecesToDisplay = isReplaying
    ? (replayHistory[replayIndex]?.nextPieces || [])
    : nextPieces;

  // Ghost Rendering block calculations
  const ghostY = activePiece ? getGhostY(activePiece, board) : 0;

  // Render standard 10x20 Grid
  const renderGrid = () => {
    if (isReplaying) {
      if (replayHistory.length === 0 || !replayHistory[replayIndex]) return [];
      const move = replayHistory[replayIndex];
      const overlayBoard = move.originalBoard.map((row) => [...row]);

      // Draw replayed placed piece
      const piece = move.placedPiece;
      for (let r = 0; r < piece.matrix.length; r++) {
        for (let c = 0; c < piece.matrix[r].length; c++) {
          if (piece.matrix[r][c] !== 0) {
            const py = piece.y + r;
            const px = piece.x + c;
            if (py >= 0 && py < ROWS && px >= 0 && px < COLS) {
              overlayBoard[py][px] = piece.type;
            }
          }
        }
      }

      const gridCells = [];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cellType = overlayBoard[r][c];
          const colorClass = cellType ? COLOR_MAP[cellType] : COLOR_MAP.empty;
          gridCells.push(
            <div
              key={`replay-${r}-${c}`}
              className={`w-full aspect-square rounded-sm transition-all duration-75 ${colorClass}`}
            />
          );
        }
      }
      return gridCells;
    }

    const gridCells = [];

    // Base board overlay
    const overlayBoard = board.map((row) => [...row]);

    // Draw ghost piece if active
    if (activePiece && !autoPlay) {
      const piece = activePiece;
      for (let r = 0; r < piece.matrix.length; r++) {
        for (let c = 0; c < piece.matrix[r].length; c++) {
          if (piece.matrix[r][c] !== 0) {
            const gy = ghostY + r;
            const gx = piece.x + c;
            if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) {
              if (overlayBoard[gy][gx] === "") {
                overlayBoard[gy][gx] = "ghost";
              }
            }
          }
        }
      }
    }

    // Draw active falling piece
    if (activePiece) {
      const piece = activePiece;
      for (let r = 0; r < piece.matrix.length; r++) {
        for (let c = 0; c < piece.matrix[r].length; c++) {
          if (piece.matrix[r][c] !== 0) {
            const py = piece.y + r;
            const px = piece.x + c;
            if (py >= 0 && py < ROWS && px >= 0 && px < COLS) {
              overlayBoard[py][px] = piece.type;
            }
          }
        }
      }
    }

    // Generate grid items
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cellType = overlayBoard[r][c];
        const colorClass = cellType ? COLOR_MAP[cellType] : COLOR_MAP.empty;
        gridCells.push(
          <div
            key={`${r}-${c}`}
            className={`w-full aspect-square rounded-sm transition-all duration-75 ${colorClass}`}
          />
        );
      }
    }

    return gridCells;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Navbar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-900/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent">
              SRS-X Tetris AI Brain
            </h1>
            <p className="text-[10px] text-slate-500 font-medium">
              スーパー回転法則（SRS） & Gemini 自律型AIテトリス
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Key selector button */}
          <button
            onClick={() => setShowKeyModal(true)}
            className={`flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3.5 rounded-xl border transition-all ${
              customApiKey
                ? "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                : "bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>
              {customApiKey ? "GitHub Pages用キー設定済" : "GitHub Pages用キー設定"}
            </span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Tetris Game & Controls (Column Span 4) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col items-center">
            {/* Header score info */}
            <div className="w-full flex justify-between items-center mb-4 bg-slate-950 py-2.5 px-4 rounded-xl border border-slate-850">
              <div>
                <span className="text-[10px] text-slate-500 font-mono block">SCORE</span>
                <span className="text-xl font-black text-indigo-400 font-mono tracking-wider">
                  {score}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 font-mono block">LEVEL</span>
                <span className="text-lg font-bold text-white font-mono">
                  {level}
                </span>
              </div>
            </div>

            {/* Board Layout (HOLD on left, Grid in middle, 5 NEXT previews on right) */}
            <div className="flex gap-3 w-full justify-center items-start">
              {/* Left Panel: HOLD (Moved to left side) */}
              <div className="flex flex-col gap-3 w-[84px] justify-start pt-2">
                <div 
                  onClick={holdActivePiece}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    holdActivePiece();
                  }}
                  className="bg-slate-950/80 border border-slate-850 rounded-xl p-2 flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-500 active:scale-95 transition-all select-none"
                >
                  <span className="text-[9px] text-slate-500 font-mono font-extrabold tracking-wider block mb-1">
                    HOLD
                  </span>
                  <div className="h-12 w-full flex items-center justify-center bg-slate-900/40 border border-slate-850 rounded-lg">
                    {holdPieceToDisplay ? (
                      <div className="flex flex-col gap-0.5 items-center justify-center scale-[0.85]">
                        {PREVIEW_SHAPES[holdPieceToDisplay].map((row, r) => (
                          <div key={`hold-row-${r}`} className="flex gap-0.5">
                            {row.map((val, c) => (
                              <div
                                key={`hold-${r}-${c}`}
                                className={`w-2.5 h-2.5 rounded-sm ${
                                  val ? COLOR_MAP[holdPieceToDisplay] : "bg-transparent"
                                }`}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-600 font-mono">-</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Main Board */}
              <div 
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="relative bg-slate-950 p-2 rounded-2xl border-2 border-slate-850/80 w-[240px] flex-shrink-0 shadow-2xl select-none touch-none"
              >
                {gameOver && (
                  <div className="absolute inset-0 bg-slate-950/90 rounded-2xl flex flex-col items-center justify-center p-4 text-center z-10 animate-fade-in">
                    <span className="text-red-500 font-extrabold font-sans text-xl tracking-tight mb-1">
                      GAME OVER
                    </span>
                    <p className="text-xs text-slate-400 max-w-[180px] mb-4 leading-relaxed">
                      ブロックが上部に達しました。AIパラメータを調整して、再挑戦しましょう！
                    </p>
                    <button
                      onClick={initGame}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-6 rounded-xl transition-all shadow-md shadow-indigo-900/40"
                    >
                      リトライする
                    </button>
                  </div>
                )}

                {/* Replay Active Banner */}
                {isReplaying && (
                  <div className="absolute top-2 left-2 right-2 bg-emerald-500/95 border border-emerald-400 text-slate-950 font-bold text-[10px] tracking-wider py-1 px-2.5 rounded-lg flex items-center justify-between shadow-lg z-20 animate-pulse">
                    <div className="flex items-center gap-1">
                      <History className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "3s" }} />
                      <span>REPLAY ACTIVE</span>
                    </div>
                    <span className="font-mono text-[9px] bg-slate-950 text-emerald-400 px-1.5 py-0.5 rounded">
                      #{replayIndex + 1}/{replayHistory.length}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-10 gap-[2px] w-full relative">
                  {renderGrid()}

                  {/* Hard Drop Particles Overlay */}
                  {particles.map((p) => (
                    <div
                      key={p.id}
                      className="absolute rounded-full pointer-events-none animate-particle"
                      style={{
                        left: p.left,
                        top: p.top,
                        width: p.size,
                        height: p.size,
                        backgroundColor: p.color,
                        "--dx": p.dx,
                        "--dy": p.dy,
                        "--duration": p.duration,
                      } as any}
                    />
                  ))}
                </div>

                {/* T-Spin text overlay */}
                {tSpinActive && tSpinText && (
                  <div className="absolute inset-x-0 top-1/3 flex justify-center items-center pointer-events-none z-20">
                    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 border border-purple-450 text-white font-black text-[11px] px-3.5 py-2 rounded-full shadow-2xl tracking-widest uppercase animate-bounce">
                      ✨ {tSpinText} ✨
                    </div>
                  </div>
                )}

                {/* Perfect Clear (PC) text overlay */}
                {perfectClearActive && perfectClearText && (
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center items-center pointer-events-none z-25 animate-pulse">
                    <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500 border-2 border-yellow-300 text-slate-950 font-black text-xs px-4 py-3 rounded-2xl shadow-[0_0_25px_rgba(251,191,36,0.8)] tracking-widest uppercase flex flex-col items-center gap-1 scale-105">
                      <span className="text-[10px] tracking-widest opacity-80">ALL CLEAR!</span>
                      <span className="text-sm tracking-widest font-extrabold text-white font-sans drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">PERFECT CLEAR</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Panel: NEXT Previews (Showing 5 items, slightly larger) */}
              <div className="flex flex-col gap-3 w-[84px] justify-start pt-2">
                <div className="bg-slate-950/80 border border-slate-850 rounded-xl p-2 flex flex-col items-center gap-1.5">
                  <span className="text-[9px] text-slate-500 font-mono font-extrabold tracking-wider block mb-0.5">
                    NEXT
                  </span>
                  {nextPiecesToDisplay.slice(0, 5).map((type, index) => (
                    <div
                      key={`next-${index}`}
                      className="h-12 w-full flex items-center justify-center bg-slate-900/40 border border-slate-850 rounded-lg"
                    >
                      <div className="flex flex-col gap-0.5 items-center justify-center scale-[0.8]">
                        {PREVIEW_SHAPES[type].map((row, r) => (
                          <div key={`n-row-${index}-${r}`} className="flex gap-0.5">
                            {row.map((val, c) => (
                              <div
                                key={`n-${index}-${r}-${c}`}
                                className={`w-2.5 h-2.5 rounded-sm ${
                                  val ? COLOR_MAP[type] : "bg-transparent"
                                }`}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Manual controls buttons */}
            <div className="w-full grid grid-cols-2 gap-2 mt-4 border-t border-slate-800/60 pt-4">
              {isPlaying ? (
                <button
                  onClick={() => setIsPlaying(false)}
                  className="bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  <Pause className="w-3.5 h-3.5" />
                  一時停止
                </button>
              ) : (
                <button
                  onClick={activePiece ? () => setIsPlaying(true) : initGame}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  <Play className="w-3.5 h-3.5" />
                  {activePiece ? "再開" : "ゲーム開始"}
                </button>
              )}
              <button
                onClick={initGame}
                className="bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                リセット
              </button>
            </div>
          </div>

          {/* AI Autonomous Driving Controller */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm">
                  AI自動運転 (AI Auto-Play)
                </h3>
                <p className="text-[10px] text-slate-500">
                  設定された評価値（重み）に基づき自律プレイします
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPlay}
                  onChange={(e) => setAutoPlay(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white"></div>
              </label>
            </div>

            {autoPlay && (
              <div className="space-y-3 bg-slate-950 p-3 rounded-xl border border-slate-850 text-xs animate-fade-in">
                {/* AI Mode selection */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">AI 動作スタイル:</span>
                  <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
                    <button
                      onClick={() => setAiMode("smooth")}
                      className={`px-2 py-1 text-[10px] rounded font-bold transition-all ${
                        aiMode === "smooth"
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      物理移動
                    </button>
                    <button
                      onClick={() => setAiMode("instant")}
                      className={`px-2 py-1 text-[10px] rounded font-bold transition-all ${
                        aiMode === "instant"
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      即時スナップ
                    </button>
                  </div>
                </div>

                {/* Speed adjustment (for smooth mode only) */}
                {aiMode === "smooth" && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">AI 思考動作ウェイト:</span>
                      <span className="text-indigo-400 font-mono font-bold">
                        {aiSpeed}ms
                      </span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="1000"
                      step="50"
                      value={aiSpeed}
                      onChange={(e) => setAiSpeed(parseInt(e.target.value))}
                      className="w-full accent-indigo-500 h-1 rounded bg-slate-800 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Controls Settings Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div>
              <h3 className="font-bold text-white text-sm">
                操作モード設定 (Controls)
              </h3>
              <p className="text-[10px] text-slate-500">
                キーボード操作、またはスマホ・タップ操作を選択できます
              </p>
            </div>

            <div className="flex bg-slate-950 p-1 border border-slate-850 rounded-xl">
              <button
                onClick={() => setControlType("keyboard")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  controlType === "keyboard"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                キーボード操作
              </button>
              <button
                onClick={() => setControlType("touch")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  controlType === "touch"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                タップ・スワイプ
              </button>
            </div>

            {/* Instruction manual */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-xs space-y-2">
              {controlType === "keyboard" ? (
                <>
                  <span className="text-[10px] text-indigo-400 font-bold block uppercase tracking-wider">
                    キーボード操作方法
                  </span>
                  <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-[11px] text-slate-300">
                    <div><kbd className="bg-slate-900 px-1 py-0.5 rounded text-[10px] border border-slate-850 font-mono">←</kbd> / <kbd className="bg-slate-900 px-1 py-0.5 rounded text-[10px] border border-slate-850 font-mono">→</kbd></div>
                    <div>左右移動</div>
                    <div><kbd className="bg-slate-900 px-1 py-0.5 rounded text-[10px] border border-slate-850 font-mono">↑</kbd></div>
                    <div>右回転</div>
                    <div><kbd className="bg-slate-900 px-1 py-0.5 rounded text-[10px] border border-slate-850 font-mono">Z</kbd></div>
                    <div>左回転</div>
                    <div><kbd className="bg-slate-900 px-1 py-0.5 rounded text-[10px] border border-slate-850 font-mono">↓</kbd></div>
                    <div>ソフトドロップ</div>
                    <div><kbd className="bg-slate-900 px-1.5 py-0.5 rounded text-[10px] border border-slate-850 font-mono">Space</kbd></div>
                    <div>ハードドロップ</div>
                    <div><kbd className="bg-slate-900 px-1 py-0.5 rounded text-[10px] border border-slate-850 font-mono">Shift</kbd> / <kbd className="bg-slate-900 px-1 py-0.5 rounded text-[10px] border border-slate-850 font-mono">C</kbd></div>
                    <div>ホールド</div>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-[10px] text-indigo-400 font-bold block uppercase tracking-wider">
                    タップ＆スワイプ操作方法
                  </span>
                  <div className="space-y-1.5 text-[11px] text-slate-300 leading-relaxed">
                    <p>・<strong>左側タップ:</strong> 左回転（CCW）</p>
                    <p>・<strong>右側タップ:</strong> 右回転（CW）</p>
                    <p>・<strong>上スワイプ:</strong> 180度回転</p>
                    <p>・<strong>左右スワイプ:</strong> 左右移動（スライド）</p>
                    <p>・<strong>下スワイプ維持:</strong> ソフトドロップ</p>
                    <p>・<strong>下スワイプ放す:</strong> ハードドロップ</p>
                    <p>・<strong>ホールド欄タップ:</strong> ホールド（HOLD）</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* AI Player Imitation Learning Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  プレイヤー模倣学習 (Imitation)
                </h3>
                <p className="text-[10px] text-slate-500">
                  あなたのプレイスタイルをAIに学習させます
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={realTimeLearning}
                  onChange={(e) => setRealTimeLearning(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white"></div>
              </label>
            </div>

            {/* Live Learning Feedback log */}
            {learningLog && (
              <div className="bg-indigo-950/40 p-2.5 border border-indigo-900/50 rounded-xl text-[11px] text-indigo-300 leading-relaxed font-medium animate-pulse">
                {learningLog}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                <span className="text-slate-500 text-[10px] block font-mono">DEMO DATA</span>
                <span className="text-sm font-bold font-mono text-white">
                  {playerHistory.length} 手分
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                <span className="text-slate-500 text-[10px] block font-mono">STYLE PROFILE</span>
                <span className="text-[11px] font-bold text-emerald-400 truncate block">
                  {playerHistory.length === 0 ? "データなし" : (() => {
                    let fourLineCount = 0;
                    let isTSpinCount = 0;
                    let linesClearedTotal = 0;
                    playerHistory.forEach(m => {
                      if (m.linesCleared === 4) fourLineCount++;
                      if (m.isTSpin) isTSpinCount++;
                      linesClearedTotal += m.linesCleared;
                    });
                    if (isTSpinCount > 0) return "T-Spin狙い型";
                    if (fourLineCount > playerHistory.length * 0.2) return "4LINEテトリス重視型";
                    if (linesClearedTotal / playerHistory.length < 0.5) return "下地・平坦維持型";
                    return "バランス安定型";
                  })()}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (playerHistory.length === 0) {
                    alert("手動プレイをして学習データを貯めてから実行してください。");
                    return;
                  }
                  // Run full epoch update
                  const trained = trainWeightsFromMoves(weights, playerHistory, 0.08);
                  setWeights(trained);
                  alert(`過去 ${playerHistory.length} 手のプレイデータからAIを最適化しました！評価パラメータが更新されました。`);
                  setLearningLog("プレイデータから一括学習を適用しました");
                }}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-1.5 px-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1 shadow"
              >
                一括再学習
              </button>
              <button
                onClick={() => {
                  setPlayerHistory([]);
                  setLearningLog("");
                  alert("学習データ履歴をクリアしました。");
                }}
                className="bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-slate-800 text-slate-400 py-1.5 px-3 rounded-xl text-xs transition-all"
              >
                クリア
              </button>
            </div>
          </div>

          {/* Gameplay Replay Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                <Video className="w-4 h-4 text-emerald-400" />
                ゲームプレイ録画・再現 (Replay & Export)
              </h3>
              <p className="text-[10px] text-slate-500">
                直前のプレイ内容をJSONでエクスポートし、読み込ませてAIが「再現再生」できます
              </p>
            </div>

            {/* Current Session Recording Status */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">現在の録画状態</span>
                <span className="text-slate-500 font-mono text-[10px]">
                  {currentGameHistory.length} 手 記録済
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 text-[11px] text-slate-400 flex items-center gap-1.5 bg-slate-900/50 py-1 px-2.5 rounded border border-slate-800">
                  <span className={`w-2 h-2 rounded-full ${currentGameHistory.length > 0 ? "bg-emerald-500 animate-pulse" : "bg-slate-600"}`}></span>
                  <span>{currentGameHistory.length > 0 ? "録画中（バックグラウンド）" : "待機中（プレイで録画開始）"}</span>
                </div>
                <button
                  onClick={exportReplayJSON}
                  disabled={currentGameHistory.length === 0}
                  className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                    currentGameHistory.length > 0
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow shadow-emerald-900/30"
                      : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-850"
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  JSONエクスポート
                </button>
              </div>
            </div>

            {/* Replay Player Controls */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-indigo-400 font-bold flex items-center gap-1">
                  <History className="w-3.5 h-3.5" />
                  再現・リプレイ再生機
                </span>
                {isReplaying ? (
                  <span className="text-emerald-400 font-mono text-[11px] font-bold">
                    再生位置: {replayIndex + 1} / {replayHistory.length} 手
                  </span>
                ) : (
                  <span className="text-slate-600 text-[10px]">ファイル未読込</span>
                )}
              </div>

              {isReplaying ? (
                <div className="space-y-3">
                  {/* Control buttons */}
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={handlePrevReplayStep}
                      disabled={replayIndex === 0}
                      className="bg-slate-900 hover:bg-slate-850 text-white font-bold p-2 rounded-lg border border-slate-800 text-xs transition-all disabled:opacity-40"
                      title="1手戻る"
                    >
                      ◀ 戻る
                    </button>
                    <button
                      onClick={handleToggleReplayPlay}
                      className={`flex-1 font-bold py-2 px-3 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 shadow ${
                        isReplayPlaying
                          ? "bg-amber-600 hover:bg-amber-500 text-white"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white"
                      }`}
                    >
                      {isReplayPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      {isReplayPlaying ? "一時停止" : "自動再生"}
                    </button>
                    <button
                      onClick={handleNextReplayStep}
                      disabled={replayIndex === replayHistory.length - 1}
                      className="bg-slate-900 hover:bg-slate-850 text-white font-bold p-2 rounded-lg border border-slate-800 text-xs transition-all disabled:opacity-40"
                      title="1手進む"
                    >
                      進む ▶
                    </button>
                    <button
                      onClick={handleStopReplay}
                      className="bg-red-950/40 hover:bg-red-900/50 border border-red-900/40 text-red-400 font-bold p-2 rounded-lg text-xs transition-all"
                      title="再生終了"
                    >
                      停止
                    </button>
                  </div>

                  {/* Replay Speed Config */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>再生スピード調整:</span>
                      <span className="font-mono text-indigo-400 font-semibold">{replaySpeed}ms</span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="2000"
                      step="100"
                      value={replaySpeed}
                      onChange={(e) => setReplaySpeed(parseInt(e.target.value))}
                      className="w-full accent-emerald-500 h-1 rounded bg-slate-800 cursor-pointer"
                    />
                  </div>

                  {/* Move Details */}
                  {replayHistory[replayIndex] && (
                    <div className="bg-slate-900/50 p-2 rounded border border-slate-800 text-[11px] text-slate-400 space-y-1">
                      <div className="flex justify-between">
                        <span>消去ライン数:</span>
                        <span className="font-mono text-white font-bold">{replayHistory[replayIndex].linesCleared} line</span>
                      </div>
                      <div className="flex justify-between">
                        <span>T-Spin判定:</span>
                        <span className={`font-semibold ${replayHistory[replayIndex].isTSpin ? "text-purple-400" : "text-slate-600"}`}>
                          {replayHistory[replayIndex].isTSpin ? "あり (TRUE)" : "なし (FALSE)"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl p-4 text-center bg-slate-900/20 group hover:border-emerald-500/45 transition-all">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleReplayImport}
                    className="hidden"
                    id="replay-file-input"
                  />
                  <label
                    htmlFor="replay-file-input"
                    className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
                  >
                    <Upload className="w-6 h-6 text-slate-500 group-hover:text-emerald-400 transition-all" />
                    <span className="text-[11px] text-slate-400 group-hover:text-emerald-300 font-medium">
                      リプレイJSONファイルをインポートする
                    </span>
                    <span className="text-[9px] text-slate-600">
                      過去にエクスポートした .json ファイルを選択
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Template / Fumen Importer Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4 text-indigo-400" />
                テンプレート / テト譜インポート (Template Import)
              </h3>
              <p className="text-[10px] text-slate-500">
                独自テンプレート（.tptファイル）またはテト譜（Fumen）をロードしてAIに模倣学習させられます
              </p>
            </div>

            <div className="space-y-3">
              {/* Text Area */}
              <div className="space-y-1.5">
                <textarea
                  value={templateInput}
                  onChange={(e) => setTemplateInput(e.target.value)}
                  placeholder="ここに.tpt形式（20行×10文字の0〜7の数字列）または、テト譜URL/コード（v115@...）を貼り付け"
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono resize-none leading-relaxed"
                />
              </div>

              {/* Drag & Drop or Custom File input */}
              <div 
                onClick={() => tptFileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const text = event.target?.result as string;
                      setTemplateInput(text);
                      handleImportTemplate(text);
                    };
                    reader.readAsText(file);
                  }
                }}
                className="border border-dashed border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-950/10 rounded-xl p-3 text-center cursor-pointer transition-all group"
              >
                <input
                  type="file"
                  ref={tptFileRef}
                  accept=".tpt,text/plain"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const text = event.target?.result as string;
                        setTemplateInput(text);
                        handleImportTemplate(text);
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="hidden"
                />
                <span className="text-[10px] text-slate-500 group-hover:text-indigo-400 font-medium block">
                  ドラッグ＆ドロップ、またはクリックして .tpt ファイルを読み込む
                </span>
              </div>

              {/* TPT Custom Metadata Setting Area */}
              <div className="bg-slate-950/50 rounded-xl p-3.5 border border-slate-850 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider block">
                    テンプレート設定 (.tptカスタム情報)
                  </span>
                  <span className="text-[9px] text-slate-500">21行目: 種類 / 22行目: 説明</span>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-medium block">
                    テンプレの種類 (Template Type):
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {(["opener", "mid", "donate"] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setTptType(type)}
                        className={`py-1 rounded-lg text-[10px] font-bold transition-all border ${
                          tptType === type
                            ? "bg-indigo-600 text-white border-indigo-500 shadow"
                            : "bg-slate-950 hover:bg-slate-900 text-slate-400 border-slate-850 hover:border-slate-800"
                        }`}
                      >
                        {type === "opener" ? "開幕 (Opener)" : type === "mid" ? "中盤 (Mid)" : "T-Spinドネイト (Donate)"}
                      </button>
                    ))}
                  </div>

                  {!["opener", "mid", "donate"].includes(tptType) && (
                    <div className="flex gap-1.5 items-center bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1 mt-1">
                      <span className="text-[9px] text-slate-500 font-mono">Custom Type:</span>
                      <input
                        type="text"
                        value={tptType}
                        onChange={(e) => setTptType(e.target.value)}
                        className="bg-transparent text-xs text-white focus:outline-none flex-1 font-mono"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-medium block">
                    テンプレート名 (テンプレ一覧への登録用):
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="例: DT砲、T-Spinドネイト、パフェ開幕"
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 leading-relaxed font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-medium block">
                    カスタムプロンプト（動き・手順・攻撃指示など）:
                  </label>
                  <textarea
                    value={tptPrompt}
                    onChange={(e) => setTptPrompt(e.target.value)}
                    placeholder="例: この開幕テンプレから、Lミノをホールドし、T-Spin Doubleを作った後、Perfect Clearを狙いなさい。"
                    rows={2.5}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 leading-relaxed font-sans"
                  />
                </div>

                {tptPrompt && (
                  <div className="bg-indigo-950/20 rounded-lg p-2 border border-indigo-950/40 text-[10px] text-indigo-300">
                    <p className="font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-yellow-400" />
                      AIコーチ（軍師）連動中
                    </p>
                    <p className="opacity-80 mt-0.5 leading-snug text-[9px]">
                      このプロンプト指示が自動的にAI軍師（Gemini）の指導方針に組み込まれます。
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleImportTemplate(templateInput)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-2 rounded-xl text-xs transition-all flex items-center justify-center gap-1 shadow"
                  title="貼り付けたデータまたはファイルを読み込み、盤面に展開します"
                >
                  盤面に展開
                </button>
                <button
                  onClick={handleAddAsTemplate}
                  className="bg-indigo-950 hover:bg-indigo-900 border border-indigo-500/30 text-indigo-200 font-semibold py-2 px-2 rounded-xl text-xs transition-all flex items-center justify-center gap-1 shadow"
                  title="入力内容（または現在の盤面）を指定の種類でテンプレート一覧に追加します"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                  テンプレ追加
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleTrainOnTemplate}
                  className="bg-slate-950 hover:bg-slate-850 border border-slate-850 text-slate-300 font-semibold py-2 px-2 rounded-xl text-xs transition-all flex items-center justify-center gap-1"
                  title="現在のテンプレート盤面からAIを模倣学習させます"
                >
                  AIに模倣学習させる
                </button>
                <button
                  onClick={handleExportTPT}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-2 rounded-xl text-xs transition-all flex items-center justify-center gap-1 shadow"
                  title="現在の盤面＋テンプレート設定を.tptファイルとしてダウンロードします"
                >
                  .tptで保存
                </button>
              </div>

              {/* Saved Templates List Area */}
              <div className="pt-3 border-t border-slate-850 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider block">
                    登録済みテンプレート一覧
                  </span>
                  <span className="text-[9px] text-slate-500">クリックで盤面にロード</span>
                </div>
                
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {customTemplates.map((template) => (
                    <div
                      key={template.id}
                      onClick={() => handleLoadTemplate(template)}
                      className="bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-indigo-500/40 rounded-xl p-2 cursor-pointer transition-all flex items-start justify-between gap-2 group"
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                            template.type === "opener"
                              ? "bg-sky-500/15 text-sky-400 border border-sky-500/30"
                              : template.type === "mid"
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              : "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                          }`}>
                            {template.type === "opener"
                              ? "開幕"
                              : template.type === "mid"
                              ? "中盤"
                              : "T-Spinドネイト"}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-200 group-hover:text-indigo-300 transition-all truncate">
                            {template.name}
                          </span>
                        </div>
                        {template.prompt && (
                          <p className="text-[9px] text-slate-400 leading-snug line-clamp-2">
                            {template.prompt}
                          </p>
                        )}
                      </div>
                      
                      {template.id !== "dt-cannon" && template.id !== "t-spin-donate" && (
                        <button
                          onClick={(e) => handleDeleteTemplate(template.id, e)}
                          className="text-[9px] text-slate-500 hover:text-red-400 px-1 py-0.5 rounded transition-all"
                          title="削除"
                        >
                          削除
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Column: Heuristic Weights Settings Panel (Column Span 4) */}
        <div className="lg:col-span-4">
          <HeuristicPanel
            weights={weights}
            onWeightsChange={setWeights}
            metrics={getLiveMetrics()}
            onAnalyzeBoard={handleAnalyzeBoard}
            isAnalyzing={isAnalyzing}
            advice={advice}
            recommendedWeights={recommendedWeights}
            onApplyRecommended={handleApplyRecommended}
            onResetWeights={handleResetWeights}
            aiName={aiName}
            onAiNameChange={setAiName}
            aiGeneration={aiGeneration}
            onAiGenerationChange={setAiGeneration}
            onEvolve={handleEvolve}
            currentUser={currentUser}
            onLoginSuccess={handleLoginSuccess}
            onLogout={handleLogout}
            savedAIs={savedAIs}
            onSaveToCloud={handleSaveToCloud}
            onLoadFromCloud={handleLoadFromCloud}
            aiObjectives={aiObjectives}
            onAiObjectivesChange={setAiObjectives}
          />
        </div>

        {/* Right Column: AI Coach / Strategist Chat (Column Span 4) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Navigation Tab */}
          <div className="flex bg-slate-900 p-1 border border-slate-800 rounded-xl">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "chat"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              AI軍師チャット
            </button>
            <button
              onClick={() => setActiveTab("instructions")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "instructions"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Pagesデプロイ解説
            </button>
          </div>

          {activeTab === "chat" ? (
            <StrategyCoach
              messages={chatMessages}
              onSendMessage={handleSendChatMessage}
              isLoading={isChatLoading}
              onClearChat={() => setChatMessages([])}
            />
          ) : (
            <InstructionTab />
          )}
        </div>
      </main>

      {/* API Key configuration modal */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="space-y-1.5">
              <h3 className="font-bold text-white text-base">
                GitHub Pagesデプロイ用 Gemini APIキー設定
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                GitHub Pagesに静的デプロイしたサイトでも、<strong>無料でGemini AI機能を使えるようにする</strong>ためのカスタムキー設定です。
                キーを入力すると、サーバーを経由せず直接ブラウザからGemini APIを叩きます。
              </p>
            </div>

            <div className="bg-indigo-950/40 p-3 border border-indigo-900/50 rounded-xl space-y-1">
              <span className="text-[10px] text-indigo-400 font-bold block uppercase tracking-wider">
                安心セキュア設計
              </span>
              <p className="text-[11px] text-slate-300">
                入力されたキーはあなた自身のブラウザの<strong>LocalStorageにのみ格納され、いかなるサーバーにも収集・送信されることはありません</strong>（外部流出は一切発生しません）。
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-medium block">
                あなたの Gemini API キー (GEMINI_API_KEY)
              </label>
              <input
                type="password"
                defaultValue={customApiKey}
                placeholder="AI Studioから取得した AIzaSy... で始まるキーを入力"
                id="keyInput"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowKeyModal(false)}
                className="flex-1 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-400 rounded-xl py-2 text-xs font-semibold"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  const val = (document.getElementById("keyInput") as HTMLInputElement).value.trim();
                  handleSaveApiKey(val);
                }}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2 text-xs font-semibold"
              >
                キーを保存して適用
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
