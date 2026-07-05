import { Tetromino, Piece, HeuristicWeights, Point, UserMove, AIObjectives } from "./types";

// Standard Tetris dimensions
export const COLS = 10;
export const ROWS = 20;

// Tetromino matrices (0 = empty, 1 = solid)
export const SHAPES: Record<Tetromino, number[][]> = {
  [Tetromino.I]: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  [Tetromino.O]: [
    [1, 1],
    [1, 1],
  ],
  [Tetromino.T]: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  [Tetromino.J]: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  [Tetromino.L]: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  [Tetromino.S]: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  [Tetromino.Z]: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
};

// Custom layout specifications for Next and Hold displays
export const PREVIEW_SHAPES: Record<Tetromino, number[][]> = {
  [Tetromino.I]: [
    [1, 1, 1, 1],
  ],
  [Tetromino.T]: [
    [1, 1, 1],
    [0, 1, 0],
  ],
  [Tetromino.L]: [
    [0, 0, 1],
    [1, 1, 1],
  ],
  [Tetromino.J]: [
    [1, 0, 0],
    [1, 1, 1],
  ],
  [Tetromino.S]: [
    [0, 1, 1],
    [1, 1, 0],
  ],
  [Tetromino.Z]: [
    [1, 1, 0],
    [0, 1, 1],
  ],
  [Tetromino.O]: [
    [1, 1],
    [1, 1],
  ],
};

// Nice theme colors for the game board
export const COLOR_MAP: Record<string, string> = {
  I: "bg-cyan-500 shadow-[inset_0_4px_6px_rgba(255,255,255,0.4)] border border-cyan-600",
  O: "bg-yellow-400 shadow-[inset_0_4px_6px_rgba(255,255,255,0.4)] border border-yellow-500",
  T: "bg-purple-500 shadow-[inset_0_4px_6px_rgba(255,255,255,0.4)] border border-purple-600",
  J: "bg-blue-600 shadow-[inset_0_4px_6px_rgba(255,255,255,0.4)] border border-blue-700",
  L: "bg-orange-500 shadow-[inset_0_4px_6px_rgba(255,255,255,0.4)] border border-orange-600",
  S: "bg-green-500 shadow-[inset_0_4px_6px_rgba(255,255,255,0.4)] border border-green-600",
  Z: "bg-red-500 shadow-[inset_0_4px_6px_rgba(255,255,255,0.4)] border border-red-600",
  empty: "bg-slate-900/40 border border-slate-800/50",
  ghost: "border-2 border-dashed border-slate-600 bg-slate-800/10",
};

// Default Heuristic weights representing optimized starter values
export const DEFAULT_WEIGHTS: HeuristicWeights = {
  heightPenalty: -0.51,
  holesPenalty: -0.85,
  bumpinessPenalty: -0.18,
  linesClearedReward: 0.76,
  wellDepthPenalty: -0.15,
  tSlotReward: 0.25,
  speedReward: 0.50,
  flatnessReward: 0.30,
  fourLineReward: 1.50,
  tSpinReward: 2.00,
  perfectClearReward: 4.00,
  avoidHoleCoveringPenalty: -0.50,
};

// SRS Kick offsets for 3x3 pieces (T, J, L, S, Z)
// Transitions: 0=Spawn, 1=Right/90, 2=208, 3=Left/270
// Format: offsets[rotationFrom][rotationTo][kickIndex] = [dx, dy]
// Remember: y-axis is inverted in standard rendering compared to Tetris guidelines,
// but let's define them in [dx, dy] where +dy is UP.
const SRS_KICKS_3X3: Record<string, number[][]> = {
  "0->1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "1->0": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "1->2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "2->1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "2->3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "3->2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "3->0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "0->3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};

// SRS Kick offsets for I piece (4x4)
const SRS_KICKS_I: Record<string, number[][]> = {
  "0->1": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "1->0": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "1->2": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  "2->1": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "2->3": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "3->2": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "3->0": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "0->3": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

// Create an empty board
export function createEmptyBoard(): string[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(""));
}

// Check for collision with placed blocks or board boundaries
export function checkCollision(
  matrix: number[][],
  x: number,
  y: number,
  board: string[][]
): boolean {
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c] !== 0) {
        const boardX = x + c;
        const boardY = y + r;

        // Wall collision
        if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
          return true;
        }

        // Existing block collision (ignore negative Y for spawning pieces)
        if (boardY >= 0 && board[boardY][boardX] !== "") {
          return true;
        }
      }
    }
  }
  return false;
}

// Deep clone a piece
export function clonePiece(piece: Piece): Piece {
  return {
    type: piece.type,
    matrix: piece.matrix.map((row) => [...row]),
    x: piece.x,
    y: piece.y,
    rotationIndex: piece.rotationIndex,
  };
}

// Generate standard rotated matrix
export function rotateMatrix(matrix: number[][], dir: number): number[][] {
  const n = matrix.length;
  const rotated = Array.from({ length: n }, () => Array(n).fill(0));

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (dir > 0) {
        // Clockwise
        rotated[c][n - 1 - r] = matrix[r][c];
      } else {
        // Counter-clockwise
        rotated[n - 1 - c][r] = matrix[r][c];
      }
    }
  }
  return rotated;
}

// Rotate piece with Super Rotation System rules (wall kicks)
export function rotatePieceSRS(piece: Piece, dir: number, board: string[][]): Piece | null {
  if (piece.type === Tetromino.O) return piece; // O doesn't rotate

  const nextRotationIndex = (piece.rotationIndex + (dir > 0 ? 1 : 3)) % 4;
  const rotatedMatrix = rotateMatrix(piece.matrix, dir);

  const transitionKey = `${piece.rotationIndex}->${nextRotationIndex}`;
  const kickTable = piece.type === Tetromino.I ? SRS_KICKS_I : SRS_KICKS_3X3;
  const kicks = kickTable[transitionKey] || [[0, 0]];

  for (const kick of kicks) {
    const dx = kick[0];
    const dy = -kick[1]; // Invert y offset since board coordinates increase downwards

    if (!checkCollision(rotatedMatrix, piece.x + dx, piece.y + dy, board)) {
      return {
        ...piece,
        matrix: rotatedMatrix,
        x: piece.x + dx,
        y: piece.y + dy,
        rotationIndex: nextRotationIndex,
      };
    }
  }

  return null; // Rotation failed
}

// Drop piece to get its ghost position
export function getGhostY(piece: Piece, board: string[][]): number {
  let ghostY = piece.y;
  while (!checkCollision(piece.matrix, piece.x, ghostY + 1, board)) {
    ghostY++;
  }
  return ghostY;
}

// Place piece on the board and return the number of cleared lines
export function placePieceOnBoard(piece: Piece, board: string[][]): {
  newBoard: string[][];
  linesCleared: number;
  isTSpin: boolean;
} {
  const newBoard = board.map((row) => [...row]);
  let isTSpin = false;

  // 1. Check for T-spin condition
  if (piece.type === Tetromino.T) {
    // 3 out of 4 corners occupied (either wall, floor or block)
    const corners = [
      { x: piece.x, y: piece.y }, // Top-left
      { x: piece.x + 2, y: piece.y }, // Top-right
      { x: piece.x, y: piece.y + 2 }, // Bottom-left
      { x: piece.x + 2, y: piece.y + 2 }, // Bottom-right
    ];
    let occupiedCount = 0;
    for (const corner of corners) {
      if (
        corner.x < 0 ||
        corner.x >= COLS ||
        corner.y >= ROWS ||
        (corner.y >= 0 && newBoard[corner.y][corner.x] !== "")
      ) {
        occupiedCount++;
      }
    }
    // Simple 3-corner T-spin logic
    if (occupiedCount >= 3) {
      isTSpin = true;
    }
  }

  // 2. Put blocks onto board
  for (let r = 0; r < piece.matrix.length; r++) {
    for (let c = 0; c < piece.matrix[r].length; c++) {
      if (piece.matrix[r][c] !== 0) {
        const boardY = piece.y + r;
        const boardX = piece.x + c;
        if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
          newBoard[boardY][boardX] = piece.type;
        }
      }
    }
  }

  // 3. Check and clear lines
  let linesCleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (newBoard[r].every((cell) => cell !== "")) {
      newBoard.splice(r, 1);
      newBoard.unshift(Array(COLS).fill(""));
      linesCleared++;
      r++; // re-check same row index since we shifted
    }
  }

  return { newBoard, linesCleared, isTSpin };
}

// Check for holes count, column heights, bumpiness, etc.
export function analyzeBoardMetrics(board: string[][]) {
  const columnHeights = Array(COLS).fill(0);
  let totalHoles = 0;
  let bumpiness = 0;
  let maxColHeight = 0;
  let blocksAboveHoles = 0;

  // Compute column heights
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (board[r][c] !== "") {
        columnHeights[c] = ROWS - r;
        break;
      }
    }
    if (columnHeights[c] > maxColHeight) {
      maxColHeight = columnHeights[c];
    }
  }

  // Compute holes (empty cells with solid blocks above them)
  for (let c = 0; c < COLS; c++) {
    let blockAbove = false;
    for (let r = 0; r < ROWS; r++) {
      if (board[r][c] !== "") {
        blockAbove = true;
      } else if (blockAbove && board[r][c] === "") {
        totalHoles++;
      }
    }

    // Count blocks that have at least one hole below them in the same column
    let firstBlockRow = -1;
    for (let r = 0; r < ROWS; r++) {
      if (board[r][c] !== "") {
        firstBlockRow = r;
        break;
      }
    }
    if (firstBlockRow !== -1) {
      for (let r = firstBlockRow; r < ROWS; r++) {
        if (board[r][c] !== "") {
          let hasHoleBelow = false;
          for (let r2 = r + 1; r2 < ROWS; r2++) {
            if (board[r2][c] === "") {
              hasHoleBelow = true;
              break;
            }
          }
          if (hasHoleBelow) {
            blocksAboveHoles++;
          }
        }
      }
    }
  }

  // Compute bumpiness
  for (let c = 0; c < COLS - 1; c++) {
    bumpiness += Math.abs(columnHeights[c] - columnHeights[c + 1]);
  }

  // Compute well depths
  let totalWellDepth = 0;
  let deepWellsCount = 0;
  for (let c = 0; c < COLS; c++) {
    const leftHeight = c > 0 ? columnHeights[c - 1] : ROWS;
    const rightHeight = c < COLS - 1 ? columnHeights[c + 1] : ROWS;
    const currentHeight = columnHeights[c];
    const surroundingMin = Math.min(leftHeight, rightHeight);
    if (surroundingMin > currentHeight) {
      const depth = surroundingMin - currentHeight;
      if (depth >= 3) {
        deepWellsCount++;
      }
      totalWellDepth += depth;
    }
  }

  // Compute T-slot shapes (where there's a T-piece size pocket)
  let tSlots = 0;
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      // Check for a pocket of T structure
      if (
        board[r][c] === "" &&
        board[r - 1][c] === "" &&
        board[r][c - 1] !== "" &&
        board[r][c + 1] !== "" &&
        board[r + 1][c] !== ""
      ) {
        tSlots++;
      }
    }
  }

  return {
    columnHeights,
    totalHoles,
    bumpiness,
    maxColHeight,
    totalWellDepth,
    deepWellsCount,
    tSlots,
    blocksAboveHoles,
  };
}

// Evaluate board rating score for AI simulation
export function rateBoard(
  board: string[][],
  weights: HeuristicWeights,
  linesCleared: number,
  isTSpin: boolean,
  objectives?: AIObjectives
): number {
  const { columnHeights, totalHoles, bumpiness, totalWellDepth, deepWellsCount, tSlots, blocksAboveHoles } = analyzeBoardMetrics(board);

  const sumHeights = columnHeights.reduce((sum, h) => sum + h, 0);

  let score = 0;
  score += sumHeights * weights.heightPenalty;
  score += totalHoles * weights.holesPenalty;
  score += bumpiness * weights.bumpinessPenalty;

  // "穴の深さペナルティは深さ3マス以上の穴が2つ以上ある場合のみ適用されるようにして"
  const wellDepthValue = deepWellsCount >= 2 ? totalWellDepth : 0;
  score += wellDepthValue * weights.wellDepthPenalty;

  score += tSlots * weights.tSlotReward;
  score += blocksAboveHoles * (weights.avoidHoleCoveringPenalty || 0);

  // ② 地形の平らさ (Flatness Reward)
  // 隣接する列の高さが完全に同じである箇所のカウント
  let flatness = 0;
  for (let c = 0; c < COLS - 1; c++) {
    if (Math.abs(columnHeights[c] - columnHeights[c + 1]) === 0) {
      flatness++;
    }
  }
  score += flatness * (weights.flatnessReward || 0);

  // ① 速度特性評価 (Speed-based placement)
  // 速度を高めるために、なるべく低い位置（落下・操作時間が短い）にピースを安定させる傾向を強める
  const avgHeight = sumHeights / COLS;
  score += (ROWS - avgHeight) * (weights.speedReward || 0) * 0.15;

  // ⑤ Perfect Clear (全消しボーナス)
  // すべての列の高さが0になった場合、非常に高い報酬を付与
  const pcEnabled = objectives ? objectives.pc : true;
  if (sumHeights === 0 && pcEnabled) {
    score += (weights.perfectClearReward || 0) * 60;
  }

  // Lines cleared scaling reward
  if (linesCleared > 0) {
    let multiplier = linesCleared;
    if (linesCleared === 4) {
      // ③ 4LINE消去 (Tetris) 特化報酬
      multiplier = 8 + (weights.fourLineReward || 0) * 12;
    } else if (isTSpin) {
      // ④ T-Spin 特化報酬
      multiplier = linesCleared * (12 + (weights.tSpinReward || 0) * 8);
    }
    score += multiplier * weights.linesClearedReward;

    // Apply active objective checks/penalties starting from Generation 3
    if (objectives) {
      if (linesCleared === 1 && !isTSpin && !objectives.clearLine1) {
        score -= 5000;
      }
      if (linesCleared === 2 && !isTSpin && !objectives.clearLine2) {
        score -= 5000;
      }
      if (linesCleared === 3 && !isTSpin && !objectives.clearLine3) {
        score -= 5000;
      }
      if (linesCleared === 4 && !objectives.clearLine4) {
        score -= 5000;
      }
      if (isTSpin && linesCleared === 1 && !objectives.tss) {
        score -= 5000;
      }
      if (isTSpin && linesCleared === 2 && !objectives.tsd) {
        score -= 5000;
      }
      if (isTSpin && linesCleared === 3 && !objectives.tst) {
        score -= 5000;
      }
    }
  }

  // 4-column REN objective
  if (objectives?.ren4Col) {
    // Keep rightmost 4 columns empty (columns 6, 7, 8, 9)
    let rightBlocks = 0;
    for (let c = 6; c < COLS; c++) {
      rightBlocks += columnHeights[c];
    }
    // Penalize blocks in rightmost columns heavily to build on the left
    score -= rightBlocks * 5.0;
  }

  return score;
}

// Interface for simulated move outcome
export interface AIMoveOption {
  x: number;
  rotationIndex: number;
  score: number;
  useHold: boolean;
  pieceType: Tetromino;
}

// AI Solver Engine: Simulates all possible drops for current or hold piece
export function findBestMove(
  currentPiece: Piece,
  holdPieceType: Tetromino | null,
  nextPieceType: Tetromino,
  board: string[][],
  weights: HeuristicWeights,
  objectives?: AIObjectives
): AIMoveOption {
  let bestMove: AIMoveOption = {
    x: 0,
    rotationIndex: 0,
    score: -Infinity,
    useHold: false,
    pieceType: currentPiece.type,
  };

  const piecesToEvaluate = [
    { type: currentPiece.type, useHold: false },
  ];

  // Also evaluate hold option if available or empty
  if (holdPieceType) {
    piecesToEvaluate.push({ type: holdPieceType, useHold: true });
  } else {
    // If hold is empty, we simulate holding current, meaning we evaluate nextPiece
    piecesToEvaluate.push({ type: nextPieceType, useHold: true });
  }

  for (const item of piecesToEvaluate) {
    // Create base simulated piece at top
    const basePiece: Piece = {
      type: item.type,
      matrix: SHAPES[item.type],
      x: Math.floor((COLS - SHAPES[item.type][0].length) / 2),
      y: 0,
      rotationIndex: 0,
    };

    // Try all rotations
    for (let rot = 0; rot < 4; rot++) {
      let simPiece = clonePiece(basePiece);
      let rotationSuccess = true;

      // Rotate to target orientation
      for (let r = 0; r < rot; r++) {
        const rotated = rotatePieceSRS(simPiece, 1, board);
        if (rotated) {
          simPiece = rotated;
        } else {
          rotationSuccess = false;
          break;
        }
      }

      if (!rotationSuccess) continue;

      // Determine left and right column boundaries
      const minX = -3;
      const maxX = COLS + 3;

      for (let targetX = minX; targetX <= maxX; targetX++) {
        // Position simulation piece
        const currentSimPiece = { ...simPiece, x: targetX };

        // Ensure placement is within bounds
        if (checkCollision(currentSimPiece.matrix, targetX, 0, board)) {
          continue; // Block overlap at top
        }

        // Simulate dropping the piece
        const dropY = getGhostY(currentSimPiece, board);
        const droppedPiece = { ...currentSimPiece, y: dropY };

        // Ensure final placement does not exceed boundaries
        if (checkCollision(droppedPiece.matrix, droppedPiece.x, droppedPiece.y, board)) {
          continue;
        }

        // Place and evaluate
        const { newBoard, linesCleared, isTSpin } = placePieceOnBoard(droppedPiece, board);
        const rating = rateBoard(newBoard, weights, linesCleared, isTSpin, objectives);

        if (rating > bestMove.score) {
          bestMove = {
            x: targetX,
            rotationIndex: rot,
            score: rating,
            useHold: item.useHold,
            pieceType: item.type,
          };
        }
      }
    }
  }

  return bestMove;
}

// Generate random Tetromino sequence using standard 7-bag randomizer
export function generateNewBag(): Tetromino[] {
  const bag = [
    Tetromino.I,
    Tetromino.O,
    Tetromino.T,
    Tetromino.J,
    Tetromino.L,
    Tetromino.S,
    Tetromino.Z,
  ];
  // Shuffle bag
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

// Helper to compute flatness
function getFlatnessScore(heights: number[]): number {
  let flat = 0;
  for (let i = 0; i < heights.length - 1; i++) {
    if (heights[i] === heights[i + 1]) flat++;
  }
  return flat;
}

export function trainWeightsFromMoves(
  currentWeights: HeuristicWeights,
  moves: UserMove[],
  learningRate: number = 0.05
): HeuristicWeights {
  if (moves.length === 0) return currentWeights;

  const weights = { ...currentWeights };

  for (const m of moves) {
    // 1. Compute board metrics for the player's choice
    const playerDroppedPiece = m.placedPiece;
    const { newBoard: playerBoard, linesCleared: playerLines, isTSpin: playerTSpin } = placePieceOnBoard(playerDroppedPiece, m.originalBoard);
    const playerMetrics = analyzeBoardMetrics(playerBoard);
    const playerFlatness = getFlatnessScore(playerMetrics.columnHeights);

    // 2. Compute what the AI would have selected from that board
    const aiBestMove = findBestMove(
      playerDroppedPiece, // Use original active piece (m.placedPiece starts as active before drop)
      m.holdPieceType,
      m.nextPieceType,
      m.originalBoard,
      weights
    );

    // Get the board state the AI would have produced
    let aiSimPiece: Piece;
    if (aiBestMove.useHold && m.holdPieceType) {
      aiSimPiece = {
        type: m.holdPieceType,
        matrix: SHAPES[m.holdPieceType],
        x: Math.floor((COLS - SHAPES[m.holdPieceType][0].length) / 2),
        y: 0,
        rotationIndex: 0,
      };
    } else {
      aiSimPiece = {
        type: playerDroppedPiece.type,
        matrix: SHAPES[playerDroppedPiece.type],
        x: Math.floor((COLS - SHAPES[playerDroppedPiece.type][0].length) / 2),
        y: 0,
        rotationIndex: 0,
      };
    }

    // Apply rotation
    for (let r = 0; r < aiBestMove.rotationIndex; r++) {
      const rotated = rotatePieceSRS(aiSimPiece, 1, m.originalBoard);
      if (rotated) aiSimPiece = rotated;
    }
    aiSimPiece.x = aiBestMove.x;
    aiSimPiece.y = getGhostY(aiSimPiece, m.originalBoard);

    const { newBoard: aiBoard, linesCleared: aiLines, isTSpin: aiTSpin } = placePieceOnBoard(aiSimPiece, m.originalBoard);
    const aiMetrics = analyzeBoardMetrics(aiBoard);
    const aiFlatness = getFlatnessScore(aiMetrics.columnHeights);

    // 3. Contrastive/Imitation Learning Step:
    // Update negative penalty weights: we want to penalize more if the player's choice has less of the issue than the AI's choice.
    // e.g. if playerHoles < aiHoles, playerHoles - aiHoles is negative. Adding it to holesPenalty (which is negative) makes holesPenalty MORE negative (higher penalty).

    // Height Penalty (target range: [-5.0, 0.0])
    const hPlayer = playerMetrics.columnHeights.reduce((s, x) => s + x, 0);
    const hAi = aiMetrics.columnHeights.reduce((s, x) => s + x, 0);
    weights.heightPenalty += learningRate * (hPlayer - hAi);
    weights.heightPenalty = Math.max(-5.0, Math.min(0.0, weights.heightPenalty));

    // Holes Penalty (target range: [-10.0, 0.0])
    weights.holesPenalty += learningRate * 2.0 * (playerMetrics.totalHoles - aiMetrics.totalHoles);
    weights.holesPenalty = Math.max(-10.0, Math.min(0.0, weights.holesPenalty));

    // Bumpiness Penalty (target range: [-5.0, 0.0])
    weights.bumpinessPenalty += learningRate * (playerMetrics.bumpiness - aiMetrics.bumpiness);
    weights.bumpinessPenalty = Math.max(-5.0, Math.min(0.0, weights.bumpinessPenalty));

    // Well Depth Penalty (target range: [-3.0, 0.0])
    weights.wellDepthPenalty += learningRate * 0.5 * (playerMetrics.totalWellDepth - aiMetrics.totalWellDepth);
    weights.wellDepthPenalty = Math.max(-3.0, Math.min(0.0, weights.wellDepthPenalty));

    // Avoid Hole Covering Penalty (target range: [-5.0, 0.0])
    weights.avoidHoleCoveringPenalty += learningRate * 1.5 * (playerMetrics.blocksAboveHoles - aiMetrics.blocksAboveHoles);
    weights.avoidHoleCoveringPenalty = Math.max(-5.0, Math.min(0.0, weights.avoidHoleCoveringPenalty));

    // For rewards: we want to increase them if the player succeeded in the event but the AI did not.
    // Flatness Reward (target range: [0.0, 5.0])
    weights.flatnessReward += learningRate * (playerFlatness - aiFlatness);
    weights.flatnessReward = Math.max(0.0, Math.min(5.0, weights.flatnessReward));

    // Lines Cleared Reward (target range: [0.0, 5.0])
    weights.linesClearedReward += learningRate * (playerLines - aiLines);
    weights.linesClearedReward = Math.max(0.0, Math.min(5.0, weights.linesClearedReward));

    // T-Slot Reward (target range: [0.0, 5.0])
    weights.tSlotReward += learningRate * (playerMetrics.tSlots - aiMetrics.tSlots);
    weights.tSlotReward = Math.max(0.0, Math.min(5.0, weights.tSlotReward));

    // 4LINE Clear Reward (target range: [0.0, 10.0])
    if (playerLines === 4 && aiLines < 4) {
      weights.fourLineReward += learningRate * 5.0;
    } else if (playerLines < 4 && aiLines === 4) {
      weights.fourLineReward -= learningRate * 2.5;
    }
    weights.fourLineReward = Math.max(0.0, Math.min(10.0, weights.fourLineReward));

    // T-Spin Reward (target range: [0.0, 10.0])
    if (playerTSpin && !aiTSpin) {
      weights.tSpinReward += learningRate * 5.0;
    } else if (!playerTSpin && aiTSpin) {
      weights.tSpinReward -= learningRate * 2.5;
    }
    weights.tSpinReward = Math.max(0.0, Math.min(10.0, weights.tSpinReward));

    // Perfect Clear Reward (target range: [0.0, 20.0])
    const isPlayerPC = playerBoard.every(row => row.every(cell => cell === ""));
    const isAiPC = aiBoard.every(row => row.every(cell => cell === ""));
    if (isPlayerPC && !isAiPC) {
      weights.perfectClearReward += learningRate * 10.0;
    } else if (!isPlayerPC && isAiPC) {
      weights.perfectClearReward -= learningRate * 5.0;
    }
    weights.perfectClearReward = Math.max(0.0, Math.min(20.0, weights.perfectClearReward));
  }

  return weights;
}
