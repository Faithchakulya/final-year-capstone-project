import express from "express";
import path from "path";
import fs from "fs";
import http from "http";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import type { Meeting } from "./src/types.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const MEETINGS_FILE = path.join(process.cwd(), "meetings.json");
const GROQ_API_KEY = process.env.GROQ_API_KEY?.trim() || "";
const GROQ_URL = "https://api.groq.com/openai/v1";
const CHAT_MODEL = "llama-3.3-70b-versatile";
const AI_NOT_CONFIGURED = "AI is not configured (set GROQ_API_KEY).";

interface RoomParticipant {
  id: string;
  name: string;
  phone: string;
  isMuted: boolean;
  isCameraOn: boolean;
  isHandRaised: boolean;
  ws: WebSocket;
}

const activeRooms = new Map<string, Map<string, RoomParticipant>>();

function readMeetings(): Meeting[] {
  try {
    if (!fs.existsSync(MEETINGS_FILE)) {
      fs.writeFileSync(MEETINGS_FILE, "[]");
      return [];
    }
    return JSON.parse(fs.readFileSync(MEETINGS_FILE, "utf-8"));
  } catch (error) {
    console.error("Error reading meetings.json:", error);
    return [];
  }
}

function writeMeetings(meetings: Meeting[]) {
  try {
    fs.writeFileSync(MEETINGS_FILE, JSON.stringify(meetings, null, 2));
  } catch (error) {
    console.error("Error writing meetings.json:", error);
  }
}

if (!GROQ_API_KEY) {
  console.warn(`${AI_NOT_CONFIGURED} AI routes will return 503.`);
}

// Base64 audio uploads can be large.
app.use(express.json({ limit: "50mb" }));

async function groqChat(
  messages: { role: "system" | "user"; content: string }[],
  options: { json?: boolean } = {}
): Promise<string> {
  const response = await fetch(`${GROQ_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      ...(options.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq request failed: ${response.status} ${await response.text()}`);
  }
  const result = (await response.json()) as { choices: { message: { content: string } }[] };
  return result.choices[0]?.message.content ?? "";
}

async function transcribe(audioData: string, mimeType: string): Promise<string> {
  const blob = new Blob([Buffer.from(audioData, "base64")], { type: mimeType || "audio/webm" });
  const formData = new FormData();
  formData.append("file", blob, "audio.webm");
  formData.append("model", "whisper-large-v3-turbo");

  const response = await fetch(`${GROQ_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Groq transcription failed: ${response.status} ${await response.text()}`);
  }
  const result = (await response.json()) as { text: string };
  return result.text;
}

async function summarize(transcript: string, title: string) {
  const prompt =
    `Transcript of the meeting "${title || "Meeting"}":\n\n${transcript}\n\n` +
    `Return a JSON object with these fields:\n` +
    `{\n` +
    `  "summary": "2-3 sentence summary",\n` +
    `  "topicsCovered": ["topic"],\n` +
    `  "actionItems": [{ "assignee": "Name", "task": "Description" }],\n` +
    `  "decisions": ["decision"],\n` +
    `  "peoplePresent": ["Name"],\n` +
    `  "discussion": "One paragraph describing what each participant contributed"\n` +
    `}\n` +
    `Take names from the speaker labels. Leave a list empty if the transcript has nothing for it.`;

  const content = await groqChat(
    [
      { role: "system", content: "You write meeting minutes as JSON. Only use information from the transcript." },
      { role: "user", content: prompt },
    ],
    { json: true }
  );
  return JSON.parse(content || "{}");
}

async function answerQuestion(
  transcript: string,
  history: { sender: string; text: string }[],
  question: string
): Promise<string> {
  const historyText = history
    .filter((m) => m.text)
    .map((m) => `${m.sender === "user" ? "User" : "Assistant"}: ${m.text}`)
    .join("\n");

  return groqChat([
    {
      role: "system",
      content:
        "Answer questions about a meeting using only its transcript. " +
        "If the transcript does not contain the answer, say so.",
    },
    {
      role: "user",
      content: `Transcript:\n${transcript}\n\nConversation so far:\n${historyText}\n\nQuestion: ${question}`,
    },
  ]);
}

function requireAi(res: express.Response): boolean {
  if (GROQ_API_KEY) return true;
  res.status(503).json({ error: AI_NOT_CONFIGURED });
  return false;
}

app.get("/api/config", (_req, res) => {
  res.json({ hasApiKey: Boolean(GROQ_API_KEY) });
});

app.get("/api/meetings", (_req, res) => {
  res.json(readMeetings());
});

app.post("/api/meetings", (req, res) => {
  const meeting = req.body as Meeting;
  if (!meeting.title) {
    return res.status(400).json({ error: "Meeting title is required" });
  }
  const meetings = readMeetings();
  meetings.unshift(meeting);
  writeMeetings(meetings);
  res.status(201).json(meeting);
});

app.delete("/api/meetings/:id", (req, res) => {
  writeMeetings(readMeetings().filter((m) => m.id !== req.params.id));
  res.json({ success: true });
});

app.patch("/api/meetings/:id/actions", (req, res) => {
  const { task, completed } = req.body;
  const meetings = readMeetings();
  const meeting = meetings.find((m) => m.id === req.params.id);
  if (!meeting) {
    return res.status(404).json({ error: "Meeting not found" });
  }
  meeting.actionItems = meeting.actionItems.map((action) =>
    action.task === task ? { ...action, completed } : action
  );
  writeMeetings(meetings);
  res.json(meeting);
});

app.get("/api/meetings/exists/:id", (req, res) => {
  const { id } = req.params;
  const exists = activeRooms.has(id) || readMeetings().some((m) => m.id === id);
  res.json({ exists });
});

app.post("/api/ai/transcribe", async (req, res) => {
  const { audioData, mimeType } = req.body;
  if (!audioData) {
    return res.status(400).json({ error: "Missing audioData" });
  }
  if (!requireAi(res)) return;

  try {
    res.json({ transcript: await transcribe(audioData, mimeType) });
  } catch (error: any) {
    console.error("Transcription failed:", error);
    res.status(500).json({ error: error.message || "Transcription failed" });
  }
});

app.post("/api/ai/summarize", async (req, res) => {
  const { transcript, title } = req.body;
  if (!transcript) {
    return res.status(400).json({ error: "Missing transcript" });
  }
  if (!requireAi(res)) return;

  try {
    res.json(await summarize(transcript, title));
  } catch (error: any) {
    console.error("Summarization failed:", error);
    res.status(500).json({ error: error.message || "Summarization failed" });
  }
});

app.post("/api/ai/chat", async (req, res) => {
  const { transcript, messages, question } = req.body;
  if (!transcript || !question) {
    return res.status(400).json({ error: "Missing transcript or question" });
  }
  if (!requireAi(res)) return;

  try {
    res.json({ answer: await answerQuestion(transcript, messages || [], question) });
  } catch (error: any) {
    console.error("Chat failed:", error);
    res.status(500).json({ error: error.message || "Chat failed" });
  }
});

function broadcast(roomId: string, payload: object, exceptId?: string) {
  const room = activeRooms.get(roomId);
  if (!room) return;
  const data = JSON.stringify(payload);
  for (const p of room.values()) {
    if (p.id !== exceptId && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(data);
    }
  }
}

function broadcastParticipants(roomId: string) {
  const room = activeRooms.get(roomId);
  if (!room) return;
  const participants = Array.from(room.values()).map(({ ws, ...p }) => p);
  broadcast(roomId, { type: "room-participants", participants });
}

function handleConnection(ws: WebSocket) {
  let roomId: string | null = null;
  let participantId: string | null = null;

  const self = () => (roomId && participantId ? activeRooms.get(roomId)?.get(participantId) : undefined);

  ws.on("message", (raw) => {
    let data: any;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (data.type === "join-room") {
      const { participant } = data;
      roomId = data.roomId as string;
      participantId = participant.id || Math.random().toString(36).slice(2, 9);
      if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, new Map());
      }
      activeRooms.get(roomId)!.set(participantId!, {
        id: participantId!,
        name: participant.name,
        phone: participant.phone,
        isMuted: Boolean(participant.isMuted),
        isCameraOn: participant.isCameraOn !== false,
        isHandRaised: false,
        ws,
      });
      broadcastParticipants(roomId);
      return;
    }

    const me = self();
    if (!me || !roomId) return;

    switch (data.type) {
      case "update-state":
        me.isMuted = data.isMuted;
        me.isCameraOn = data.isCameraOn;
        broadcastParticipants(roomId);
        break;
      case "raise-hand":
        me.isHandRaised = data.isHandRaised;
        broadcastParticipants(roomId);
        break;
      case "reaction":
        broadcast(roomId, {
          type: "receive-reaction",
          participantId: me.id,
          senderName: data.senderName,
          reaction: data.reaction,
        }, me.id);
        break;
      case "chat-message":
        broadcast(roomId, {
          type: "receive-chat-message",
          message: { ...data.message, senderId: me.id },
        }, me.id);
        break;
      case "transcript-line":
        broadcast(roomId, { type: "receive-transcript-line", line: data.line }, me.id);
        break;
    }
  });

  ws.on("close", () => {
    if (!roomId || !participantId) return;
    const room = activeRooms.get(roomId);
    if (!room) return;
    room.delete(participantId);
    if (room.size === 0) {
      activeRooms.delete(roomId);
    } else {
      broadcastParticipants(roomId);
    }
  });
}

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });
  wss.on("connection", handleConnection);

  httpServer.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
    if (url.pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
    }
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
