# Atarashi Meet

A browser-based meeting room that transcribes what people say and turns the transcript into meeting minutes. Participants join a room by code or link, speech is transcribed in the browser, and when the call ends the transcript is summarised into a summary, decisions and action items using the Groq API.

## Features

- **Meeting rooms** – create a room and share its link (`/?join=<code>`), or join with a code.
- **Live transcription** – each participant's speech is transcribed with the Web Speech API and shared with everyone in the room over WebSockets.
- **Room presence** – participant list with mute, camera and raised-hand state, plus emoji reactions and text chat.
- **Meeting minutes** – on leaving, the transcript is sent to Groq (`llama-3.3-70b-versatile`), which returns a summary, topics, decisions and action items. Meetings can also be saved without a summary.
- **Ask AI** – ask questions about a meeting, answered from its transcript.
- **History** – past meetings are stored in `meetings.json`, with tickable action items and Word (`.doc`) export.

## Getting started

Requires Node.js 18 or newer.

```bash
npm install
cp .env.example .env   # then set GROQ_API_KEY
npm run dev
```

Open http://localhost:3000. Without `GROQ_API_KEY` everything except summaries and Ask AI still works, and the AI endpoints return `503`.

### Production build

```bash
npm run build
npm start
```

`npm run build` builds the frontend into `dist/` and bundles the server into `dist/server.cjs`.

## Project structure

```
server.ts                Express API, Groq calls, WebSocket rooms
src/
  App.tsx                View routing and top-level state
  types.ts               Shared types (also used by the server)
  components/
    Home.tsx             Clock, join form, meeting history
    RegisterUser.tsx     Name / phone form
    StartCall.tsx        Start now or get an invite link
    JoinModal.tsx        Invite link sharing
    MeetingRoom.tsx      The call screen
    MeetingDetail.tsx    Saved meeting: summary, transcript, Ask AI
    AskAI.tsx            Q&A chat about a transcript
    Drawer.tsx           Side panel / bottom sheet
  hooks/
    useLocalMedia.ts         Camera, microphone and mic levels
    useSpeechRecognition.ts  Web Speech API wrapper
    useRoomSocket.ts         Room WebSocket connection
  lib/
    meeting.ts           Meeting codes, links and formatting helpers
    sounds.ts            UI sound effects (Web Audio)
    exportWord.ts        Word export
```

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/config` | Whether an AI key is configured |
| GET | `/api/meetings` | List saved meetings |
| POST | `/api/meetings` | Save a meeting |
| DELETE | `/api/meetings/:id` | Delete a meeting |
| PATCH | `/api/meetings/:id/actions` | Mark an action item done or not done |
| GET | `/api/meetings/exists/:id` | Check whether a room or meeting exists |
| POST | `/api/ai/summarize` | Summarise a transcript into minutes |
| POST | `/api/ai/chat` | Answer a question about a transcript |

WebSocket messages go through `/ws` (`join-room`, `update-state`, `raise-hand`, `reaction`, `chat-message`, `transcript-line`).

## Limitations

- Audio and video are not sent between participants. Rooms share presence, chat, reactions and transcript lines, but there is no WebRTC media connection, so you only see your own camera.
- The Web Speech API works in Chrome and Edge. Other browsers can join a room but won't transcribe.
- Meetings are stored in a JSON file, which suits a single server instance only.
