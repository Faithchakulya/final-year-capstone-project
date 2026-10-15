# Atarashi Meet

A browser-based meeting room that transcribes what people say and turns the transcript into meeting minutes. Participants join a room by code or link, speech is transcribed in the browser, and when the call ends the transcript is summarised into a summary, decisions and action items using Google Gemini.

## Features

- **Meeting rooms** – create a room and share its link (`/?join=<code>`), or join with a code.
- **Live transcription** – each participant's speech is transcribed with the Web Speech API and shared with everyone in the room over WebSockets.
- **Audio and video calls** – participants hear and see each other over peer-to-peer WebRTC connections, set up through the room WebSocket.
- **Room presence** – participant list with mute, camera and raised-hand state, plus emoji reactions and text chat.
- **Meeting minutes** – on leaving, the transcript is sent to Google Gemini (`gemini-flash-lite-latest` by default, falling back to `gemini-flash-latest` when busy; set `GEMINI_MODEL` to change it), which returns a summary, topics, decisions and action items. Meetings can also be saved without a summary.
- **Ask AI** – ask questions about a meeting, answered from its transcript.
- **History** – past meetings are stored in `meetings.json`, with tickable action items and Word (`.doc`) export.

## Testing on other laptops and phones

Browsers only allow the camera and microphone on `https` pages (or `localhost`), so devices on your network need HTTPS. Build once, then run the production server over HTTPS:

```bash
npm run build
npm run start:https
```

It prints the network address, e.g. `https://192.168.1.20:3000`. Use the production server for devices rather than `npm run dev:https`: the dev server's hot reload refreshes every page whenever its connection drops, which happens often on phones.

The certificate is signed by a small certificate authority created for this machine in `.cert/`. Install it once on each device so the browser trusts the server (iPhones need this, or calls won't connect):

- **iPhone/iPad**: in Safari open `http://<address>:3000/ca.crt` and allow the download. Then Settings → General → VPN & Device Management → install the profile, and Settings → General → About → Certificate Trust Settings → turn on full trust for "Atarashi Meet local CA".
- **Android**: open `http://<address>:3000/ca.crt`, then Settings → Security → Encryption & credentials → Install a certificate → CA certificate, and pick the downloaded file.
- **Laptops**: open the HTTPS address and choose *Advanced → Proceed*, or install `ca.crt` as a trusted root.

On the host machine, allow Node.js through the firewall when asked. Remove the CA from devices when you're done testing.

Live captions start **off** on phones. Phone browsers give the microphone to speech recognition while it runs, so the call goes silent; turn captions on with the CC button only when needed.

## Getting started

Requires Node.js 18 or newer.

```bash
npm install
cp .env.example .env   # then set GEMINI_API_KEY
npm run dev
```

Open http://localhost:3000. Without `GEMINI_API_KEY` everything except summaries and Ask AI still works, and the AI endpoints return `503`.

### Production build

```bash
npm run build
npm start
```

`npm run build` builds the frontend into `dist/` and bundles the server into `dist/server.cjs`.

## Project structure

```
server.ts                Express API, Gemini calls, WebSocket rooms
devCert.ts               Local CA and HTTPS certificate for testing on other devices
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
    usePeerConnections.ts    WebRTC audio/video between participants
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

WebSocket messages go through `/ws` (`join-room`, `update-state`, `raise-hand`, `reaction`, `chat-message`, `transcript-line`, and `signal` for WebRTC offers, answers and ICE candidates).

## Limitations

- Calls are a mesh (everyone connects to everyone), which suits small meetings of up to about five people.
- Only a public STUN server is configured, with no TURN server. Calls work on the same network and on most home networks, but can fail across strict corporate or mobile networks.
- `npm run dev:https` is for local testing only. In production, put the app behind a proper HTTPS host or reverse proxy.
- The Web Speech API works in Chrome and Edge. Other browsers can join a room but won't transcribe.
- Meetings are stored in a JSON file, which suits a single server instance only.
