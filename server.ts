import express from "express";
import path from "path";
import fs from "fs";
import http from "http";
import https from "https";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import type { Meeting, RoomParticipant } from "./src/types.js";
import { getDevCertificate, lanAddresses } from "./devCert.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const MEETINGS_FILE = path.join(process.cwd(), "meetings.json");
const GROQ_API_KEY = process.env.GROQ_API_KEY?.trim() || "";
const GROQ_URL = "https://api.groq.com/openai/v1";
const CHAT_MODEL = "llama-3.3-70b-versatile";
const AI_NOT_CONFIGURED = "AI is not configured (set GROQ_API_KEY).";

type Connection = RoomParticipant & { ws: WebSocket };

const activeRooms = new Map<string, Map<string, Connection>>();

function readMeetings(): Meeting[] {
  if (!fs.existsSync(MEETINGS_FILE)) {
    fs.writeFileSync(MEETINGS_FILE, "[]");
    return [];
  }
  try {
    const data = JSON.parse(fs.readFileSync(MEETINGS_FILE, "utf-8"));
    if (Array.isArray(data)) return data;
    throw new Error("meetings.json does not contain an array");
  } catch (error) {
    // Keep the unreadable file instead of overwriting it on the next save.
    const backup = MEETINGS_FILE.replace(/\.json$/, `.corrupt-${Date.now()}.json`);
    fs.renameSync(MEETINGS_FILE, backup);
    fs.writeFileSync(MEETINGS_FILE, "[]");
    console.error(`Could not read meetings.json, moved it to ${path.basename(backup)}:`, error);
    return [];
  }
}

const isString = (value: unknown): value is string => typeof value === "string";
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);

function isMeeting(value: any): value is Meeting {
  return (
    value !== null &&
    typeof value === "object" &&
    isString(value.id) &&
    value.id.length > 0 &&
    isString(value.title) &&
    value.title.trim().length > 0 &&
    isString(value.date) &&
    isString(value.createdAt) &&
    typeof value.participantsCount === "number" &&
    isString(value.duration) &&
    isString(value.summary) &&
    isStringArray(value.topicsCovered) &&
    isStringArray(value.decisions) &&
    Array.isArray(value.transcript) &&
    value.transcript.every((l: any) => l && isString(l.speaker) && isString(l.text)) &&
    Array.isArray(value.actionItems) &&
    value.actionItems.every((a: any) => a && isString(a.task) && isString(a.assignee))
  );
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

// Saved meetings include the full transcript.
app.use(express.json({ limit: "5mb" }));

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
  const meeting = req.body;
  if (!isMeeting(meeting)) {
    return res.status(400).json({ error: "Invalid meeting" });
  }
  const meetings = readMeetings().filter((m) => m.id !== meeting.id);
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
  if (!isString(task) || typeof completed !== "boolean") {
    return res.status(400).json({ error: "Expected { task: string, completed: boolean }" });
  }
  const meetings = readMeetings();
  const meeting = meetings.find((m) => m.id === req.params.id);
  if (!meeting) {
    return res.status(404).json({ error: "Meeting not found" });
  }
  meeting.actionItems = (meeting.actionItems ?? []).map((action) =>
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

app.post("/api/ai/summarize", async (req, res) => {
  const { transcript, title } = req.body;
  if (!isString(transcript) || !transcript.trim()) {
    return res.status(400).json({ error: "Missing transcript" });
  }
  if (!requireAi(res)) return;

  try {
    res.json(await summarize(transcript, isString(title) ? title : ""));
  } catch (error: any) {
    console.error("Summarization failed:", error);
    res.status(502).json({ error: "The AI service failed to summarise the meeting. Try again." });
  }
});

app.post("/api/ai/chat", async (req, res) => {
  const { transcript, messages, question } = req.body;
  if (!isString(transcript) || !transcript.trim() || !isString(question) || !question.trim()) {
    return res.status(400).json({ error: "Missing transcript or question" });
  }
  if (!requireAi(res)) return;

  try {
    res.json({ answer: await answerQuestion(transcript, Array.isArray(messages) ? messages : [], question) });
  } catch (error: any) {
    console.error("Chat failed:", error);
    res.status(502).json({ error: "The AI service failed to answer. Try again." });
  }
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Body-parser errors (bad JSON, body too large) as JSON instead of an HTML stack trace.
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status === 413 ? "Request too large" : status < 500 ? "Invalid request" : "Server error" });
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

const clip = (value: unknown, max: number) => (isString(value) ? value.trim().slice(0, max) : "");

function handleConnection(ws: WebSocket) {
  let roomId: string | null = null;
  let participantId: string | null = null;

  const leaveRoom = () => {
    if (!roomId || !participantId) return;
    const room = activeRooms.get(roomId);
    // Only remove the entry if it still belongs to this socket.
    if (room && room.get(participantId)?.ws === ws) {
      room.delete(participantId);
      if (room.size === 0) {
        activeRooms.delete(roomId);
      } else {
        broadcastParticipants(roomId);
      }
    }
    roomId = null;
    participantId = null;
  };

  const handleMessage = (data: any) => {
    if (!data || typeof data !== "object") return;

    if (data.type === "join-room") {
      const participant = data.participant && typeof data.participant === "object" ? data.participant : {};
      const nextRoom = clip(data.roomId, 64);
      if (!nextRoom) return;

      leaveRoom();
      roomId = nextRoom;
      participantId = clip(participant.id, 64) || Math.random().toString(36).slice(2, 9);
      if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, new Map());
      }
      // The same participant id joining again (e.g. a reconnect) replaces the old connection.
      const previous = activeRooms.get(roomId)!.get(participantId);
      if (previous && previous.ws !== ws) {
        previous.ws.close(4000, "Joined from another connection");
      }
      activeRooms.get(roomId)!.set(participantId, {
        id: participantId,
        name: clip(participant.name, 40) || "Guest",
        phone: clip(participant.phone, 25),
        isMuted: Boolean(participant.isMuted),
        isCameraOn: participant.isCameraOn !== false,
        isHandRaised: false,
        ws,
      });
      broadcastParticipants(roomId);
      return;
    }

    const me = roomId && participantId ? activeRooms.get(roomId)?.get(participantId) : undefined;
    if (!me || !roomId || me.ws !== ws) return;

    switch (data.type) {
      case "update-state":
        me.isMuted = Boolean(data.isMuted);
        me.isCameraOn = Boolean(data.isCameraOn);
        broadcastParticipants(roomId);
        break;
      case "raise-hand":
        me.isHandRaised = Boolean(data.isHandRaised);
        broadcastParticipants(roomId);
        break;
      case "reaction":
        if (!isString(data.reaction)) return;
        broadcast(roomId, { type: "receive-reaction", participantId: me.id, senderName: me.name, reaction: clip(data.reaction, 8) }, me.id);
        break;
      case "chat-message": {
        const text = clip(data.message?.text, 2000);
        if (!text) return;
        broadcast(roomId, {
          type: "receive-chat-message",
          message: {
            id: clip(data.message.id, 64) || Math.random().toString(36).slice(2, 9),
            senderId: me.id,
            senderName: me.name,
            text,
            timestamp: clip(data.message.timestamp, 20),
          },
        }, me.id);
        break;
      }
      case "transcript-line": {
        const text = clip(data.line?.text, 2000);
        if (!text) return;
        broadcast(roomId, {
          type: "receive-transcript-line",
          line: {
            id: clip(data.line.id, 64) || Math.random().toString(36).slice(2, 9),
            speaker: me.name,
            text,
            timestamp: clip(data.line.timestamp, 20),
          },
        }, me.id);
        break;
      }
      case "signal": {
        // WebRTC offers, answers and ICE candidates, passed to one peer in the same room.
        const target = activeRooms.get(roomId)?.get(clip(data.to, 64));
        if (!target || target === me || !data.data || typeof data.data !== "object") return;
        if (target.ws.readyState === WebSocket.OPEN) {
          target.ws.send(JSON.stringify({ type: "signal", from: me.id, data: data.data }));
        }
        break;
      }
    }
  };

  ws.on("message", (raw) => {
    try {
      handleMessage(JSON.parse(raw.toString()));
    } catch (err) {
      // A bad message from one client must never take the server down.
      console.warn("Ignored WebSocket message:", (err as Error).message);
    }
  });

  ws.on("close", leaveRoom);
}

async function startServer() {
  const isProduction = process.env.NODE_ENV === "production";
  // `npm run dev:https` serves over HTTPS so other devices on the network can use their camera and microphone.
  const useHttps = process.argv.includes("--https") || process.env.HTTPS === "true";
  const server = useHttps ? https.createServer(getDevCertificate(), app) : http.createServer(app);

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server } },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
  wss.on("connection", handleConnection);

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "", "http://localhost");
    if (url.pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
    } else if (isProduction) {
      socket.destroy();
    }
    // In development, Vite's hot-reload socket handles other upgrade requests.
  });

  server.listen(PORT, "0.0.0.0", () => {
    const protocol = useHttps ? "https" : "http";
    console.log(`Server running on ${protocol}://localhost:${PORT}`);
    for (const address of lanAddresses()) {
      console.log(`  On your network: ${protocol}://${address}:${PORT}`);
    }
  });
}

startServer();
