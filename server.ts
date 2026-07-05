import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Path to users.json persistence file
const USERS_FILE = path.join(process.cwd(), "users.json");

// Safe load users.json database
const loadUsersDB = (): Record<string, { passwordHash: string; trainedAIs: any[] }> => {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, JSON.stringify({}), "utf8");
      return {};
    }
    const data = fs.readFileSync(USERS_FILE, "utf8");
    return JSON.parse(data || "{}");
  } catch (err) {
    console.error("Error reading users.json database", err);
    return {};
  }
};

// Safe save to users.json
const saveUsersDB = (db: any) => {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(db, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing users.json database", err);
  }
};

// Path to serials.json database file
const SERIALS_FILE = path.join(process.cwd(), "serials.json");

// Safe load serials database
const loadSerialsDB = (): Record<string, any> => {
  try {
    if (!fs.existsSync(SERIALS_FILE)) {
      fs.writeFileSync(SERIALS_FILE, JSON.stringify({}), "utf8");
      return {};
    }
    const data = fs.readFileSync(SERIALS_FILE, "utf8");
    return JSON.parse(data || "{}");
  } catch (err) {
    console.error("Error reading serials.json database", err);
    return {};
  }
};

// Safe save serials database
const saveSerialsDB = (db: any) => {
  try {
    fs.writeFileSync(SERIALS_FILE, JSON.stringify(db, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing serials.json database", err);
  }
};

// Helper: Simple base64 "encryption/encoding" for password
const encodePassword = (pwd: string): string => {
  return Buffer.from(pwd).toString("base64");
};

// Auth API: Register
app.post("/api/auth/register", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "ユーザー名とパスワードは必須です。" });
  }

  const db = loadUsersDB();
  const lowerUsername = username.toLowerCase().trim();

  if (db[lowerUsername]) {
    return res.status(400).json({ error: "このユーザー名は既に存在します。" });
  }

  db[lowerUsername] = {
    passwordHash: encodePassword(password),
    trainedAIs: [],
  };
  saveUsersDB(db);

  res.json({ message: "新規登録に成功しました！", username: lowerUsername });
});

// Auth API: Login
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "ユーザー名とパスワードを入力してください。" });
  }

  const db = loadUsersDB();
  const lowerUsername = username.toLowerCase().trim();

  const user = db[lowerUsername];
  if (!user || user.passwordHash !== encodePassword(password)) {
    return res.status(401).json({ error: "ユーザー名またはパスワードが正しくありません。" });
  }

  res.json({
    message: "ログインに成功しました！",
    username: lowerUsername,
    trainedAIs: user.trainedAIs || [],
  });
});

// AI API: Save trained AI model to user account
app.post("/api/ai/save", (req, res) => {
  const { username, aiModel } = req.body;
  if (!username || !aiModel || !aiModel.name) {
    return res.status(400).json({ error: "無効なリクエストデータです。" });
  }

  const db = loadUsersDB();
  const lowerUsername = username.toLowerCase().trim();

  if (!db[lowerUsername]) {
    return res.status(404).json({ error: "ユーザーが見つかりません。" });
  }

  // Ensure unique ID or update existing
  const trainedAIs = db[lowerUsername].trainedAIs || [];
  const existingIdx = trainedAIs.findIndex((ai: any) => ai.id === aiModel.id || ai.name === aiModel.name);

  // Generate or retrieve 5-digit serial code
  const serialsDb = loadSerialsDB();
  let code = aiModel.serialCode;
  
  if (!code) {
    let attempts = 0;
    while (attempts < 100) {
      code = Math.floor(10000 + Math.random() * 90000).toString();
      if (!serialsDb[code]) {
        break;
      }
      attempts++;
    }
  }

  // Save/Update in serials.json database
  serialsDb[code] = {
    code,
    name: aiModel.name,
    generation: aiModel.generation || 1,
    weights: aiModel.weights,
    aiObjectives: aiModel.aiObjectives || {
      clearLine1: true,
      clearLine2: true,
      clearLine3: true,
      clearLine4: true,
      tss: true,
      tsd: true,
      tst: true,
      pc: true,
      ren4Col: false,
    },
    maxScore: aiModel.maxScore || 0,
    createdAt: new Date().toISOString(),
  };
  saveSerialsDB(serialsDb);

  const modelWithTimestamp = {
    ...aiModel,
    id: aiModel.id || Date.now().toString(),
    serialCode: code,
    aiObjectives: aiModel.aiObjectives,
    createdAt: aiModel.createdAt || new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    trainedAIs[existingIdx] = modelWithTimestamp;
  } else {
    trainedAIs.push(modelWithTimestamp);
  }

  db[lowerUsername].trainedAIs = trainedAIs;
  saveUsersDB(db);

  res.json({ message: "AIの育成状態（遺伝子コードと5桁シリアルコード）を保存しました！", trainedAIs });
});

// AI API: Get all saved models
app.get("/api/ai/list", (req, res) => {
  const username = req.query.username as string;
  if (!username) {
    return res.status(400).json({ error: "ユーザー名が必要です。" });
  }

  const db = loadUsersDB();
  const lowerUsername = username.toLowerCase().trim();

  if (!db[lowerUsername]) {
    return res.status(404).json({ error: "ユーザーが見つかりません。" });
  }

  res.json({ trainedAIs: db[lowerUsername].trainedAIs || [] });
});

// AI API: Create 5-digit serial code for an arbitrary AI config (anonymous/shareable)
app.post("/api/ai/serial/create", (req, res) => {
  const { name, generation, weights, aiObjectives, maxScore } = req.body;
  if (!weights) {
    return res.status(400).json({ error: "重みパラメータは必須です。" });
  }

  const db = loadSerialsDB();
  
  let code = "";
  let attempts = 0;
  while (attempts < 100) {
    code = Math.floor(10000 + Math.random() * 90000).toString();
    if (!db[code]) {
      break;
    }
    attempts++;
  }

  db[code] = {
    code,
    name: name || "カスタムAI",
    generation: generation || 1,
    weights,
    aiObjectives: aiObjectives || {
      clearLine1: true,
      clearLine2: true,
      clearLine3: true,
      clearLine4: true,
      tss: true,
      tsd: true,
      tst: true,
      pc: true,
      ren4Col: false,
    },
    maxScore: maxScore || 0,
    createdAt: new Date().toISOString(),
  };

  saveSerialsDB(db);

  res.json({ success: true, code, ai: db[code] });
});

// AI API: Get AI config by 5-digit serial code
app.get("/api/ai/serial/get/:code", (req, res) => {
  const { code } = req.params;
  const db = loadSerialsDB();
  const ai = db[code];
  if (!ai) {
    return res.status(404).json({ error: "該当するシリアルコード(5桁)が見つかりません。" });
  }
  res.json({ success: true, ai });
});

// Initialize Gemini SDK with telemetry header as instructed
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY environment variable is not defined.");
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

const SRS_KNOWLEDGE_BASE = `
### SRS (Super Rotation System) & 特殊回転入れ (Special Spin) Specifications (Default Preloaded):
You are fully programmed with the rules of standard SRS rotation and Tetris special spins. Always use these specifications when advising players or tuning heuristic weights:

1. **SRS Kick Tables & Wall Kicks**:
   - Standard SRS has 4 states: 0 (Spawn), 1 (90° CW), 2 (180°), 3 (270° CCW / 90° CCW).
   - For 3x3 Tetrominoes (T, J, L, S, Z), the rotation kick sequence offset tests [dx, dy] are:
     * 0 -> 1: [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]]
     * 1 -> 0: [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]
     * 1 -> 2: [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]
     * 2 -> 1: [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]]
     * 2 -> 3: [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
     * 3 -> 2: [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]]
     * 3 -> 0: [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]]
     * 0 -> 3: [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
     (Note: In actual rendering coordinate systems, dy is typically inverted as -dy).
   - For 4x4 Tetromino (I), the kick offsets are different:
     * 0 -> 1: [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]]
     * 1 -> 0: [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]]
     * 1 -> 2: [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]
     * 2 -> 1: [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]]
     * 2 -> 3: [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]]
     * 3 -> 2: [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]]
     * 3 -> 0: [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]]
     * 0 -> 3: [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]

2. **T-Spin Decision Rules (3-Corner Rule)**:
   - To trigger a T-Spin:
     * The piece must be a T-tetromino and the last successful action must be a rotation (SRS kick).
     * At least 3 out of 4 corners around the T-piece's center (3x3 bounding box) must be filled with static blocks or wall boundaries.
     * If the 2 front corners (the facing direction of the T-wing) are filled, it is considered a regular T-Spin. If only 1 front corner is filled, but both back corners are filled, it may be designated as a T-Spin Mini.

3. **Heuristic Parameter Optimization for T-Spins & Special Spins**:
   - To prioritize and execute T-Spins:
     * Increase **T-Slot Reward (tSlotReward)** (recommend values between +1.5 and +3.0) to prompt the AI to actively shape and build T-slot receptacles (3-corner configurations).
     * Increase **T-Spin Reward (tSpinReward)** (recommend values between +2.5 and +5.0) so the AI scores maximum points for successful T-Spin clears.
     * Keep **Hole Penalty (holesPenalty)** moderately strict (e.g. -0.6 to -1.2) but slightly lower than usual to allow temporary overhangs needed to form T-spin roofs.
     * Reduce **Avoid Hole Covering Penalty (avoidHoleCoveringPenalty)** slightly (e.g. to -0.2 or -0.3) to allow the overhang blocks that create T-Spin nests.
`;

// API: Analyze Board & Optimize Heuristic Weights (free-tier gemini-3.5-flash)
app.post("/api/gemini/analyze", async (req, res) => {
  try {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(500).json({
        error: "Gemini API key is not configured. Please add GEMINI_API_KEY to your secrets.",
      });
    }

    const { board, activePiece, holdPiece, nextPieces, metrics, currentWeights, tptType, tptPrompt } = req.body;

    // Build the prompt for Gemini to understand the Tetris state
    const boardString = board
      .map((row: number[]) => row.map((cell) => (cell ? "█" : ".")).join(""))
      .join("\n");

    let templateContext = "";
    if (tptType || tptPrompt) {
      templateContext = `
### Loaded Template Context (User Custom Goal / Strategy):
- Template Type: ${tptType || "None"}
- Template Strategy Prompt (Instructions for moves/attacks/line clears):
${tptPrompt || "None"}

Please align your heuristic recommendations and strategic advice with this loaded template. If the template strategy prompt describes specific setups, focus, or attack directions (e.g., clearing T-spins, maintaining mid-board setups, or donating blocks), optimize the weights and provide tactical suggestions to support that dynamic setup.
`;
    }

    const prompt = `
You are the AI Brain Optimizer for SRS-X Tetris. Your goal is to analyze the current Tetris board layout and gameplay metrics, and optimize the AI player's heuristic weights to help it survive longer, clear more lines, and score higher.

### Current Board State (10 columns, 20 rows, █ = block, . = empty):
${boardString}

### Game Context:
- Active Piece: ${activePiece || "None"}
- Hold Piece: ${holdPiece || "None"}
- Next Pieces: ${(nextPieces || []).join(", ")}
- Current Performance Metrics:
  * Total Lines Cleared: ${metrics?.linesCleared || 0}
  * Current Level: ${metrics?.level || 1}
  * Number of Holes (blocks trapped underneath): ${metrics?.holesCount || 0}
  * Maximum Height: ${metrics?.maxHeight || 0}
${templateContext}

### Current Heuristic Weights:
- Height Penalty: ${currentWeights?.heightPenalty ?? -0.51}
- Holes Penalty: ${currentWeights?.holesPenalty ?? -0.36}
- Bumpiness Penalty: ${currentWeights?.bumpinessPenalty ?? -0.18}
- Lines Cleared Reward: ${currentWeights?.linesClearedReward ?? 0.76}
- Well Depth Penalty: ${currentWeights?.wellDepthPenalty ?? -0.15}
- T-Slot Reward: ${currentWeights?.tSlotReward ?? 0.25}

### Task:
1. Provide a concise, highly strategic tactical advisory text (2-3 sentences max) in Japanese, suggesting what the user or the AI player should prioritize right now based on this exact board shape.
2. Based on the current board state (e.g., if there are many holes, holesPenalty should be high; if it's very bumpy, bumpinessPenalty should be high; if the height is close to top, heightPenalty should be extremely high), optimize the heuristic weights. Make sure the weights are numbers between -5.0 and 5.0 (penalties are typically negative, rewards are positive). Recommend slight or moderate adjustments to keep the learning gradual.

Return the response in the specified JSON structure.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert Tetris grandmaster and computer science AI researcher specializing in Super Rotation System (SRS) heuristics.\n\n" + SRS_KNOWLEDGE_BASE,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["advice", "weights"],
          properties: {
            advice: {
              type: Type.STRING,
              description: "A short, highly strategic tactical advisory message in Japanese explaining what the board shape requires.",
            },
            weights: {
              type: Type.OBJECT,
              required: [
                "heightPenalty",
                "holesPenalty",
                "bumpinessPenalty",
                "linesClearedReward",
                "wellDepthPenalty",
                "tSlotReward",
              ],
              properties: {
                heightPenalty: {
                  type: Type.NUMBER,
                  description: "Negative coefficient for the height of columns (must be negative, e.g., -0.6).",
                },
                holesPenalty: {
                  type: Type.NUMBER,
                  description: "Negative coefficient for holes trapped under blocks (must be negative, e.g., -0.85).",
                },
                bumpinessPenalty: {
                  type: Type.NUMBER,
                  description: "Negative coefficient for the absolute height differences between adjacent columns.",
                },
                linesClearedReward: {
                  type: Type.NUMBER,
                  description: "Positive coefficient for clearing lines.",
                },
                wellDepthPenalty: {
                  type: Type.NUMBER,
                  description: "Negative coefficient for deep wells (single-column empty shafts).",
                },
                tSlotReward: {
                  type: Type.NUMBER,
                  description: "Positive coefficient for creating T-spin slot shapes.",
                },
              },
            },
          },
        },
      },
    });

    const data = JSON.parse(response.text?.trim() || "{}");
    res.json(data);
  } catch (error: any) {
    console.error("Error in board analysis:", error);
    res.status(500).json({ error: error.message || "Failed to analyze board state." });
  }
});

// API: General Chat / Advisory on SRS-X and Tetris theory
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(500).json({
        error: "Gemini API key is not configured. Please add GEMINI_API_KEY to your secrets.",
      });
    }

    const { messages, tptType, tptPrompt } = req.body;
    const history = messages.slice(0, -1).map((msg: any) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));
    const currentMessage = messages[messages.length - 1]?.content || "";

    let systemInstruction = "You are the SRS-X Tetris Strategist Coach. Explain SRS (Super Rotation System) kicks, T-spins, heuristic weights, and survival strategies clearly in Japanese. Keep answers clean, readable, and highly informative.\n\n" + SRS_KNOWLEDGE_BASE;
    if (tptType || tptPrompt) {
      systemInstruction += `\n\n[Active Template Strategy Guide]\nCurrently, the user has loaded a Tetris template of type "${tptType || "custom"}".\nThe strategy guidelines/custom instructions for this template are:\n"""\n${tptPrompt || ""}\n"""\nUse these instructions to coach the user on how to manage block placement, execute moves/attacks, or achieve the goals mentioned in this guide.`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        ...history.flatMap((h: any) => [
          { role: h.role, parts: h.parts }
        ]),
        { role: "user", parts: [{ text: currentMessage }] },
      ],
      config: {
        systemInstruction,
      },
    });

    res.json({ reply: response.text });
  } catch (error: any) {
    console.error("Error in chat api:", error);
    res.status(500).json({ error: error.message || "Failed to generate chat reply." });
  }
});

// Vite Dev Server Integration & Static Asset Routing
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SRS-X Tetris server running on http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
});
