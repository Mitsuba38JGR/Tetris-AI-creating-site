export enum Tetromino {
  I = "I",
  O = "O",
  T = "T",
  J = "J",
  L = "L",
  S = "S",
  Z = "Z",
}

export interface Point {
  x: number;
  y: number;
}

export interface Piece {
  type: Tetromino;
  matrix: number[][];
  x: number;
  y: number;
  rotationIndex: number; // 0: spawn, 1: right/90, 2: 180, 3: left/270
}

export interface HeuristicWeights {
  heightPenalty: number;
  holesPenalty: number;
  bumpinessPenalty: number;
  linesClearedReward: number;
  wellDepthPenalty: number;
  tSlotReward: number;
  speedReward: number;        // ① 速度（値が大きいほどAIのプレイ速度が向上）
  flatnessReward: number;     // ② 地形の平らさ（平坦な地形の維持）
  fourLineReward: number;     // ③ 4LINE消去（4ライン同時消しのインセンティブ）
  tSpinReward: number;        // ④ T-Spin（Tスピン消去 of T-spin incentives）
  perfectClearReward: number; // ⑤ Perfect Clear（全消しを最優先）
  avoidHoleCoveringPenalty: number; // ⑥ 下穴の上にミノを設置するのを避けるペナルティ
}

export interface AIObjectives {
  clearLine1: boolean;
  clearLine2: boolean;
  clearLine3: boolean;
  clearLine4: boolean;
  tss: boolean;
  tsd: boolean;
  tst: boolean;
  pc: boolean;
  ren4Col: boolean;
}

export interface GameMetrics {
  linesCleared: number;
  level: number;
  holesCount: number;
  maxHeight: number;
}

export interface AIAnalysisResponse {
  advice: string;
  weights: HeuristicWeights;
}

export interface TrainedAI {
  id: string;
  name: string;
  generation: number;
  weights: HeuristicWeights;
  maxScore: number;
  notes: string;
  createdAt: string;
  serialCode?: string;
  aiObjectives?: AIObjectives;
}

export interface UserSession {
  username: string;
  trainedAIs: TrainedAI[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface UserMove {
  originalBoard: string[][];
  placedPiece: Piece;
  holdPieceType: Tetromino | null;
  nextPieceType: Tetromino;
  linesCleared: number;
  isTSpin: boolean;
}

export interface CustomTemplate {
  id: string;
  name: string;
  type: string;
  prompt: string;
  board: string[][];
  createdAt: string;
  weights?: HeuristicWeights;
  aiObjectives?: AIObjectives;
}
