import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { DEFAULT_MEETINGS } from "./src/data/mockMeetings.js";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Active rooms in memory registry for websocket state sync
const activeRooms = new Map<string, Map<string, any>>();

// Path to data file
const MEETINGS_FILE = path.join(process.cwd(), "meetings.json");

// Helper to read meetings from JSON file
function readMeetings() {
  try {
    if (!fs.existsSync(MEETINGS_FILE)) {
      fs.writeFileSync(MEETINGS_FILE, JSON.stringify(DEFAULT_MEETINGS, null, 2));
      return DEFAULT_MEETINGS;
    }
    const data = fs.readFileSync(MEETINGS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading meetings.json:", error);
    return DEFAULT_MEETINGS;
  }
}

// Helper to write meetings to JSON file
function writeMeetings(meetings: any[]) {
  try {
    fs.writeFileSync(MEETINGS_FILE, JSON.stringify(meetings, null, 2));
  } catch (error) {
    console.error("Error writing meetings.json:", error);
  }
}

// Ensure meetings file is initialized
readMeetings();

// Parse JSON bodies (increased limit for base64 audio chunks)
app.use(express.json({ limit: "50mb" }));

// Initialize Groq Client
const apiKey = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.AI_API_KEY;
const isApiKeyPlaceholder = !apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("placeholder");
const hasApiKey = !!(apiKey && !isApiKeyPlaceholder && apiKey.startsWith("gsk_"));

if (hasApiKey) {
  console.log("Groq API Client initialized successfully.");
} else {
  console.warn("Groq API key is not configured or is a placeholder. Using mock AI fallbacks.");
}

// Groq API Helper Functions
async function transcribeWithGroq(audioData: string, mimeType: string): Promise<string> {
  const buffer = Buffer.from(audioData, "base64");
  const blob = new Blob([buffer], { type: mimeType || "audio/webm" });
  const formData = new FormData();
  formData.append("file", blob, "audio.webm");
  formData.append("model", "whisper-large-v3-turbo");

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`
    },
    body: formData
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq transcription error: ${response.statusText} - ${errText}`);
  }

  const result = await response.json() as { text: string };
  return result.text;
}

async function summarizeWithGroq(transcript: string, title: string): Promise<any> {
  const prompt = `Here is the raw transcript of a meeting titled "${title || 'Meeting Sync'}":\n\n${transcript}\n\n` +
    `Analyze the transcript and generate structured meeting minutes.\n` +
    `You MUST return a JSON object with the following fields and structure:\n` +
    `{\n` +
    `  "summary": "A detailed summary of what was discussed, around 2-3 sentences.",\n` +
    `  "topicsCovered": ["topic1", "topic2", ...],\n` +
    `  "participants": 3,\n` +
    `  "duration": "15m",\n` +
    `  "actionItems": [\n` +
    `    { "assignee": "Name", "task": "Description" }\n` +
    `  ],\n` +
    `  "decisions": ["decision1", "decision2", ...],\n` +
    `  "peoplePresent": ["Person A", "Person B", ...],\n` +
    `  "discussion": "A detailed paragraph capturing the actual discussions, detailing what different participants contributed."\n` +
    `}\n\n` +
    `Make sure to extract the list of people present and details accurately from the transcript speaker tags. Return ONLY the JSON object. Do not include markdown formatting or wrapper other than the JSON block.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are an expert assistant that generates structured meeting summaries as JSON objects. You must only return a valid JSON object matching the requested schema."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq summarization error: ${response.statusText} - ${errText}`);
  }

  const result = await response.json() as any;
  const resultText = result.choices[0].message.content || "{}";
  let cleanText = resultText.trim();
  if (cleanText.startsWith("```")) {
    cleanText = cleanText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  }
  return JSON.parse(cleanText);
}

async function chatWithGroq(transcript: string, messages: any[], question: string): Promise<string> {
  const historyString = messages
    .filter((m: any) => m.text)
    .map((m: any) => `${m.sender === "user" ? "User" : "AI Assistant"}: ${m.text}`)
    .join("\n");

  const systemInstruction = 
    "You are a helpful, expert AI Meeting Assistant. You are here to answer the user's questions about " +
    "a meeting based on the provided meeting transcript. Analyze the transcript carefully. Answer the question " +
    "accurately, matching the tone and details in the meeting. If the answer cannot be found in the transcript, " +
    "politely state that the transcript does not contain this information, but do not make up details.";

  const userPrompt = 
    `Here is the raw transcript of the meeting:\n` +
    `---------------------------------------\n` +
    `${transcript}\n` +
    `---------------------------------------\n\n` +
    `Here is the conversation history:\n` +
    `${historyString}\n\n` +
    `User Question: ${question}\n\n` +
    `Please provide a clear and concise answer based only on the transcript above:`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: systemInstruction
        },
        {
          role: "user",
          content: userPrompt
        }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq chat error: ${response.statusText} - ${errText}`);
  }

  const result = await response.json() as any;
  return result.choices[0].message.content;
}

// API Routes

// 1. Get API Key configuration status
app.get("/api/config", (req, res) => {
  res.json({
    hasApiKey: hasApiKey,
    message: hasApiKey
      ? "AI API (Groq) is active."
      : "AI API is inactive. Set GEMINI_API_KEY in your environment to enable live AI transcription & summarizing."
  });
});

// 2. Get all meetings
app.get("/api/meetings", (req, res) => {
  const meetings = readMeetings();
  res.json(meetings);
});

// 3. Create a new meeting
app.post("/api/meetings", (req, res) => {
  const newMeeting = req.body;
  if (!newMeeting.title) {
    return res.status(400).json({ error: "Meeting title is required" });
  }

  const meetings = readMeetings();
  meetings.unshift(newMeeting); // Insert at beginning
  writeMeetings(meetings);
  res.status(201).json(newMeeting);
});

// 4. Delete a meeting
app.delete("/api/meetings/:id", (req, res) => {
  const { id } = req.params;
  const meetings = readMeetings();
  const filtered = meetings.filter((m: any) => m.id !== id);
  writeMeetings(filtered);
  res.json({ success: true, message: `Meeting ${id} deleted` });
});

// 5. Update a meeting's action item completion status
app.patch("/api/meetings/:id/actions", (req, res) => {
  const { id } = req.params;
  const { task, completed } = req.body;
  const meetings = readMeetings();
  const meetingIndex = meetings.findIndex((m: any) => m.id === id);
  if (meetingIndex > -1) {
    meetings[meetingIndex].actionItems = meetings[meetingIndex].actionItems.map((action: any) => {
      if (action.task === task) {
        return { ...action, completed };
      }
      return action;
    });
    writeMeetings(meetings);
    return res.json(meetings[meetingIndex]);
  }
  res.status(404).json({ error: "Meeting not found" });
});

// Check if a meeting exists (in saved history or active live rooms)
app.get("/api/meetings/exists/:id", (req, res) => {
  const { id } = req.params;
  const meetings = readMeetings();
  const existsInHistory = meetings.some((m: any) => m.id === id);
  const existsInActiveRooms = activeRooms.has(id);
  res.json({ exists: existsInHistory || existsInActiveRooms });
});

// 6. Transcribe recorded audio with AI
app.post("/api/gemini/transcribe", async (req, res) => {
  const { audioData, mimeType } = req.body;
  if (!audioData) {
    return res.status(400).json({ error: "Missing audioData base64 string" });
  }

  if (!hasApiKey) {
    // Return mock transcription based on typical speech if no API key is provided
    return res.json({
      transcript: "This is a simulated transcription of your spoken meeting audio. " +
        "We discussed building highly interactive user interfaces, integrating the Groq API " +
        "server-side, and providing smooth, modern styling with Tailwind CSS. " +
        "Please add a real Groq API key in your environment to try actual voice transcription!"
    });
  }

  try {
    const transcript = await transcribeWithGroq(audioData, mimeType);
    res.json({ transcript });
  } catch (error: any) {
    console.error("Transcription API Error:", error);
    res.status(500).json({ error: error.message || "Failed to transcribe audio using AI." });
  }
});

// 7. Summarize a transcript into structured minutes
app.post("/api/gemini/summarize", async (req, res) => {
  const { transcript, title } = req.body;
  if (!transcript) {
    return res.status(400).json({ error: "Missing transcript" });
  }

  if (!hasApiKey) {
    // If it's a simulated demo, keep the mock team sync data so the demo remains rich
    if (transcript.includes("Sarah Chen") || transcript.includes("Marcus") || transcript.includes("Emily")) {
      return res.json({
        summary: `The team conducted the meeting "${title || 'New Sync'}" to discuss the primary features, workflows, and technical details of the project. Key milestones were reviewed.`,
        topicsCovered: ["Core Features", "Technical Implementation", "UI Polishing"],
        participants: 5,
        duration: "5m",
        actionItems: [
          { assignee: "Developer", task: "Configure the Groq API key inside your .env file." },
          { assignee: "Designer", task: "Review visual fidelity of the meeting summary panel." },
          { assignee: "Team", task: "Deploy the applet for production use." }
        ],
        decisions: [
          "Use local storage and mock fallbacks gracefully when API keys are not supplied.",
          "Ensure the design matches the original screenshots exactly with premium styling."
        ],
        peoplePresent: ["Sarah Chen", "Marcus", "Emily", "Tom", "Alex"],
        discussion: "The team entered into a detailed discussion regarding the integration of the server-side Groq API endpoints and the transition of speech recognition services. Emily presented the new layout structures, and Marcus outlined the requirements for the document export feature. We concluded the core agenda items and closed the session."
      });
    }

    // For a real meeting, parse the actual transcript and summarize locally
    const lines = transcript.split("\n").filter((l: string) => l.trim().length > 0);
    const speakers = new Set<string>();
    const sentences: string[] = [];

    lines.forEach((line: string) => {
      const match = line.match(/^([^:]+):(.+)$/);
      if (match) {
        let speakerName = match[1].trim();
        // Clean You (mike) -> Mike
        const cleanMatch = speakerName.match(/^You \((.+)\)$/i);
        if (cleanMatch) {
          speakerName = cleanMatch[1].trim();
        }
        if (speakerName.toLowerCase() !== "me" && speakerName.toLowerCase() !== "you (me)") {
          speakerName = speakerName.charAt(0).toUpperCase() + speakerName.slice(1);
          speakers.add(speakerName);
        }
        sentences.push(match[2].trim());
      } else {
        sentences.push(line.trim());
      }
    });

    const speakersList = Array.from(speakers);
    const hasContent = sentences.length > 0;

    // Simple local keyword extraction for topics
    const topics: string[] = [];
    if (hasContent) {
      const words = transcript
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 4 && !/^(about|there|their|would|could|should|these|those|where|which|since|while|during|hello|everyone|think|going|gonna|topic|meeting|first|second|right|agreed|agree|discussions|sync|call|today)$/i.test(w));
      
      const wordCounts: { [key: string]: number } = {};
      words.forEach((w) => {
        const cap = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        wordCounts[cap] = (wordCounts[cap] || 0) + 1;
      });

      const sorted = Object.entries(wordCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([word]) => word);

      topics.push(...sorted.slice(0, 4));
    }
    if (topics.length === 0) {
      topics.push("General Discussion");
    }

    return res.json({
      summary: hasContent
        ? `A real meeting sync titled "${title || 'Meeting'}" where participants discussed: ${sentences.slice(0, 3).join(" ")}`
        : `Meeting "${title || 'Meeting'}" was conducted with no audio transcription recorded.`,
      topicsCovered: topics,
      participants: speakersList.length || 1,
      duration: "5m",
      actionItems: [],
      decisions: [],
      peoplePresent: speakersList.length > 0 ? speakersList : ["You (Me)"],
      discussion: hasContent
        ? `The meeting transcript details conversations from ${speakersList.join(", ") || 'participants'}. Key discussion points: ${sentences.join(". ")}`
        : "No discussion content was recorded during the call."
    });
  }

  try {
    const structuredData = await summarizeWithGroq(transcript, title);
    
    // Clean peoplePresent names from AI
    if (structuredData && Array.isArray(structuredData.peoplePresent)) {
      structuredData.peoplePresent = structuredData.peoplePresent.map((name: string) => {
        let cleanName = name.replace(/^You \((.+)\)$/i, "$1").trim();
        if (cleanName.toLowerCase() === "me") {
          return "You (Me)";
        }
        return cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
      });
    }

    res.json(structuredData);
  } catch (error: any) {
    console.error("Summarization API Error:", error);
    res.status(500).json({ error: error.message || "Failed to summarize meeting with AI." });
  }
});

// 8. Q&A Chat with the meeting content
app.post("/api/gemini/chat", async (req, res) => {
  const { transcript, messages, question } = req.body;
  if (!transcript) {
    return res.status(400).json({ error: "Missing transcript" });
  }
  if (!question) {
    return res.status(400).json({ error: "Missing question" });
  }

  if (!hasApiKey) {
    // Return mock answer
    return res.json({
      answer: "I am running in local offline demo mode since no AI key is configured. " +
        "Once you configure a real key in your .env file, I'll be able to answer any questions about the meeting " +
        "with deep, context-aware analysis! Based on the local transcript, the main focus was setting up " +
        "this full-stack application."
    });
  }

  try {
    const answer = await chatWithGroq(transcript, messages, question);
    res.json({ answer });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    res.status(500).json({ error: error.message || "Failed to process chat with AI." });
  }
});

// Vite Middleware & Routing
async function startServer() {
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

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    const host = request.headers.host || "localhost";
    const urlObj = new URL(request.url || "", `http://${host}`);
    if (urlObj.pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", (ws: WebSocket) => {
    let currentRoomId: string | null = null;
    let currentParticipantId: string | null = null;

    ws.on("message", (message: string) => {
      try {
        const data = JSON.parse(message);
        switch (data.type) {
          case "join-room": {
            const { roomId, participant } = data;
            currentRoomId = roomId;
            currentParticipantId = participant.id || Math.random().toString(36).substring(2, 9);
            
            if (!activeRooms.has(roomId)) {
              activeRooms.set(roomId, new Map());
            }
            
            const roomParticipants = activeRooms.get(roomId)!;
            roomParticipants.set(currentParticipantId, {
              id: currentParticipantId,
              name: participant.name,
              phone: participant.phone,
              isMuted: participant.isMuted || false,
              isCameraOn: participant.isCameraOn !== false,
              isHandRaised: participant.isHandRaised || false,
              ws
            });

            broadcastParticipants(roomId);
            break;
          }

          case "update-state": {
            if (currentRoomId && currentParticipantId) {
              const roomParticipants = activeRooms.get(currentRoomId);
              if (roomParticipants && roomParticipants.has(currentParticipantId)) {
                const p = roomParticipants.get(currentParticipantId);
                p.isMuted = data.isMuted;
                p.isCameraOn = data.isCameraOn;
                broadcastParticipants(currentRoomId);
              }
            }
            break;
          }

          case "raise-hand": {
            if (currentRoomId && currentParticipantId) {
              const roomParticipants = activeRooms.get(currentRoomId);
              if (roomParticipants && roomParticipants.has(currentParticipantId)) {
                const p = roomParticipants.get(currentParticipantId);
                p.isHandRaised = data.isHandRaised;
                broadcastParticipants(currentRoomId);
              }
            }
            break;
          }

          case "reaction": {
            if (currentRoomId && currentParticipantId) {
              const roomParticipants = activeRooms.get(currentRoomId);
              if (roomParticipants) {
                const payload = JSON.stringify({
                  type: "receive-reaction",
                  participantId: currentParticipantId,
                  senderName: data.senderName,
                  reaction: data.reaction
                });
                for (const p of roomParticipants.values()) {
                  if (p.ws.readyState === WebSocket.OPEN) {
                    p.ws.send(payload);
                  }
                }
              }
            }
            break;
          }

          case "chat-message": {
            if (currentRoomId && currentParticipantId) {
              const roomParticipants = activeRooms.get(currentRoomId);
              if (roomParticipants) {
                const payload = JSON.stringify({
                  type: "receive-chat-message",
                  message: {
                    id: data.message.id,
                    senderId: currentParticipantId,
                    senderName: data.message.senderName,
                    text: data.message.text,
                    timestamp: data.message.timestamp
                  }
                });
                for (const p of roomParticipants.values()) {
                  if (p.ws.readyState === WebSocket.OPEN) {
                    p.ws.send(payload);
                  }
                }
              }
            }
            break;
          }

          case "transcript-line": {
            if (currentRoomId && currentParticipantId) {
              const roomParticipants = activeRooms.get(currentRoomId);
              if (roomParticipants) {
                const payload = JSON.stringify({
                  type: "receive-transcript-line",
                  line: data.line
                });
                for (const [id, p] of roomParticipants.entries()) {
                  if (id !== currentParticipantId && p.ws.readyState === WebSocket.OPEN) {
                    p.ws.send(payload);
                  }
                }
              }
            }
            break;
          }
        }
      } catch (err) {
        console.error("Error processing websocket message:", err);
      }
    });

    ws.on("close", () => {
      if (currentRoomId && currentParticipantId) {
        const roomParticipants = activeRooms.get(currentRoomId);
        if (roomParticipants) {
          roomParticipants.delete(currentParticipantId);
          if (roomParticipants.size === 0) {
            activeRooms.delete(currentRoomId);
          } else {
            broadcastParticipants(currentRoomId);
          }
        }
      }
    });
  });

  function broadcastParticipants(roomId: string) {
    const roomParticipants = activeRooms.get(roomId);
    if (!roomParticipants) return;

    const participantsList = Array.from(roomParticipants.values()).map(p => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      isMuted: p.isMuted,
      isCameraOn: p.isCameraOn,
      isHandRaised: p.isHandRaised || false
    }));

    const payload = JSON.stringify({
      type: "room-participants",
      participants: participantsList
    });

    for (const p of roomParticipants.values()) {
      if (p.ws.readyState === WebSocket.OPEN) {
        p.ws.send(payload);
      }
    }
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
