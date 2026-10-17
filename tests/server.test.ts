/**
 * Starts the real server on a spare port with a temporary meetings file and no
 * AI key, then exercises the REST API and the WebSocket rooms.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import WebSocket from "ws";

const PORT = 4100 + Math.floor(Math.random() * 800);
const BASE = `http://localhost:${PORT}`;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "atarashi-test-"));
const meetingsFile = path.join(tmpDir, "meetings.json");
let server: ChildProcess;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function meeting(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-1",
    title: "Weekly check-in",
    date: "Oct 17, 2026",
    createdAt: new Date().toISOString(),
    participantsCount: 2,
    duration: "05:00",
    summary: "",
    topicsCovered: [],
    decisions: [],
    transcript: [{ id: "1", speaker: "Faith", text: "Hello", timestamp: "10:00" }],
    actionItems: [{ assignee: "Faith", task: "Write the report" }],
    ...overrides,
  };
}

const post = (url: string, body: unknown, method = "POST") =>
  fetch(BASE + url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

before(async () => {
  // Without this the child would think it is part of the test run.
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  server = spawn(process.execPath, ["--import", "tsx", "server.ts", "--production"], {
    env: { ...env, PORT: String(PORT), GEMINI_API_KEY: "", MEETINGS_FILE: meetingsFile },
    stdio: "pipe",
  });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${BASE}/api/config`)).ok) return;
    } catch {
      // Not listening yet.
    }
    await sleep(100);
  }
  throw new Error("server did not start");
});

after(() => {
  server.kill();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("REST API", () => {
  test("reports that AI is not configured", async () => {
    assert.deepEqual(await (await fetch(`${BASE}/api/config`)).json(), { hasApiKey: false });
  });

  test("saves, lists, updates and deletes a meeting", async () => {
    assert.equal((await post("/api/meetings", meeting())).status, 201);
    const list = await (await fetch(`${BASE}/api/meetings`)).json();
    assert.equal(list.length, 1);

    const patched = await post("/api/meetings/test-1/actions", { task: "Write the report", completed: true }, "PATCH");
    assert.equal(patched.status, 200);
    assert.equal((await patched.json()).actionItems[0].completed, true);

    assert.equal((await fetch(`${BASE}/api/meetings/test-1`, { method: "DELETE" })).status, 200);
    assert.equal((await (await fetch(`${BASE}/api/meetings`)).json()).length, 0);
  });

  test("saving the same meeting twice does not duplicate it", async () => {
    await post("/api/meetings", meeting({ id: "dup" }));
    await post("/api/meetings", meeting({ id: "dup", title: "Retried" }));
    const list = await (await fetch(`${BASE}/api/meetings`)).json();
    assert.equal(list.filter((m: { id: string }) => m.id === "dup").length, 1);
    assert.equal(list[0].title, "Retried");
  });

  test("rejects invalid meetings", async () => {
    for (const body of [{}, { title: 123 }, meeting({ title: "   " }), meeting({ actionItems: [{ task: 1 }] })]) {
      assert.equal((await post("/api/meetings", body)).status, 400, JSON.stringify(body));
    }
  });

  test("validates action-item updates", async () => {
    assert.equal((await post("/api/meetings/nope/actions", { task: "x", completed: true }, "PATCH")).status, 404);
    assert.equal((await post("/api/meetings/nope/actions", { task: 1 }, "PATCH")).status, 400);
  });

  test("returns JSON errors for bad bodies and unknown routes", async () => {
    const bad = await fetch(`${BASE}/api/meetings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad",
    });
    assert.equal(bad.status, 400);
    assert.deepEqual(await bad.json(), { error: "Invalid request" });

    const big = await post("/api/meetings", { title: "x".repeat(6 * 1024 * 1024) });
    assert.equal(big.status, 413);

    const unknown = await fetch(`${BASE}/api/nope`);
    assert.equal(unknown.status, 404);
    assert.match(unknown.headers.get("content-type") ?? "", /json/);
  });

  test("AI routes validate input and return 503 without a key", async () => {
    assert.equal((await post("/api/ai/summarize", {})).status, 400);
    assert.equal((await post("/api/ai/chat", { transcript: "x", question: "  " })).status, 400);
    assert.equal((await post("/api/ai/summarize", { transcript: "Faith: hi" })).status, 503);
    assert.equal((await post("/api/ai/chat", { transcript: "Faith: hi", question: "q" })).status, 503);
  });

  test("keeps a corrupt meetings file instead of overwriting it", async () => {
    fs.writeFileSync(meetingsFile, "{not json");
    assert.deepEqual(await (await fetch(`${BASE}/api/meetings`)).json(), []);
    const backups = fs.readdirSync(tmpDir).filter((f) => f.includes(".corrupt-"));
    assert.equal(backups.length, 1);
    assert.equal(fs.readFileSync(path.join(tmpDir, backups[0]), "utf-8"), "{not json");
  });
});

/** A WebSocket client that records what it receives. */
async function client(roomId?: string, participant?: Record<string, unknown>) {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
  const inbox: any[] = [];
  ws.on("message", (m) => inbox.push(JSON.parse(m.toString())));
  ws.on("error", () => {});
  await new Promise((r) => ws.once("open", r));
  if (roomId) ws.send(JSON.stringify({ type: "join-room", roomId, participant }));
  await sleep(150);
  const send = (msg: unknown) => ws.send(typeof msg === "string" ? msg : JSON.stringify(msg));
  const participants = () => [...inbox].reverse().find((m) => m.type === "room-participants")?.participants ?? [];
  const received = (type: string) => inbox.filter((m) => m.type === type);
  return { ws, inbox, send, participants, received };
}

const roomExists = async (id: string) => (await (await fetch(`${BASE}/api/meetings/exists/${id}`)).json()).exists;

describe("WebSocket rooms", () => {
  test("participants see each other and the room exists while occupied", async () => {
    const a = await client("room-a", { id: "a", name: "Faith" });
    const b = await client("room-a", { id: "b", name: "Godwin" });
    await sleep(100);
    assert.deepEqual(a.participants().map((p: any) => p.name).sort(), ["Faith", "Godwin"]);
    assert.ok(!JSON.stringify(a.participants()).includes("_socket"), "socket objects must not leak");
    assert.equal(await roomExists("room-a"), true);

    a.ws.close();
    b.ws.close();
    await sleep(200);
    assert.equal(await roomExists("room-a"), false);
  });

  test("chat, reactions and transcript lines reach others once and use the server-side name", async () => {
    const a = await client("room-b", { id: "a", name: "Faith" });
    const b = await client("room-b", { id: "b", name: "Godwin" });
    a.send({ type: "chat-message", message: { id: "m1", senderId: "b", senderName: "Spoofed", text: "hi" } });
    a.send({ type: "reaction", senderName: "Spoofed", reaction: "👍" });
    a.send({ type: "transcript-line", line: { id: "t1", speaker: "Spoofed", text: "hello", timestamp: "10:00" } });
    await sleep(200);

    const chat = b.received("receive-chat-message");
    assert.equal(chat.length, 1);
    assert.equal(chat[0].message.senderId, "a");
    assert.equal(chat[0].message.senderName, "Faith");
    assert.equal(b.received("receive-reaction")[0].senderName, "Faith");
    assert.equal(b.received("receive-transcript-line")[0].line.speaker, "Faith");
    assert.equal(a.received("receive-chat-message").length, 0, "sender must not get an echo");
    a.ws.close();
    b.ws.close();
  });

  test("mute, camera and raised-hand state are shared", async () => {
    const a = await client("room-c", { id: "a", name: "Faith" });
    const b = await client("room-c", { id: "b", name: "Godwin" });
    a.send({ type: "update-state", isMuted: true, isCameraOn: false });
    a.send({ type: "raise-hand", isHandRaised: true });
    await sleep(200);
    const faith = b.participants().find((p: any) => p.id === "a");
    assert.deepEqual([faith.isMuted, faith.isCameraOn, faith.isHandRaised], [true, false, true]);
    a.ws.close();
    b.ws.close();
  });

  test("WebRTC signals are relayed only to the named peer", async () => {
    const a = await client("room-d", { id: "a", name: "Faith" });
    const b = await client("room-d", { id: "b", name: "Godwin" });
    const c = await client("room-d", { id: "c", name: "Guest" });
    a.send({ type: "signal", to: "b", data: { description: { type: "offer", sdp: "v=0" } } });
    await sleep(150);
    assert.equal(b.received("signal")[0].from, "a");
    assert.equal(c.received("signal").length, 0);
    for (const x of [a, b, c]) x.ws.close();
  });

  test("malformed messages are ignored and the server keeps running", async () => {
    const bad = await client();
    bad.send("not json");
    bad.send({ type: "chat-message", message: { text: "before joining" } });
    bad.send({ type: "join-room", roomId: "room-e" });
    bad.send({ type: "join-room", participant: { id: "x" } });
    await sleep(200);
    assert.equal((await fetch(`${BASE}/api/config`)).status, 200);
    const guest = bad.participants().find((p: any) => p.name === "Guest");
    assert.ok(guest, "a participant without a name is called Guest");
    bad.ws.close();
  });

  test("rejoining with the same id replaces the old connection", async () => {
    const watcher = await client("room-f", { id: "w", name: "Watcher" });
    const first = await client("room-f", { id: "dup", name: "First" });
    const second = await client("room-f", { id: "dup", name: "Second" });
    await sleep(150);
    assert.notEqual(first.ws.readyState, WebSocket.OPEN, "old connection is closed");
    assert.equal(watcher.participants().find((p: any) => p.id === "dup").name, "Second");
    second.ws.close();
    await sleep(150);
    assert.ok(!watcher.participants().some((p: any) => p.id === "dup"), "no ghost participant is left");
    watcher.ws.close();
  });

  test("moving to another room removes you from the first", async () => {
    const watcher = await client("room-g", { id: "w", name: "Watcher" });
    const mover = await client("room-g", { id: "m", name: "Mover" });
    mover.send({ type: "join-room", roomId: "room-h", participant: { id: "m", name: "Mover" } });
    await sleep(150);
    assert.ok(!watcher.participants().some((p: any) => p.id === "m"));
    assert.equal(await roomExists("room-h"), true);
    watcher.ws.close();
    mover.ws.close();
  });
});
