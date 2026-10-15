# Atarashimeet - AI-Powered Call Client & Meeting Minutes Taker

Atarashimeet is a premium, high-fidelity AI-powered meeting minutes taker and real-time collaboration call client. It combines live audio visualizers, synthetic acoustics, real-time voice transcription, WebSocket multiplayer synchronization, and automated structured summary generation powered by AI models.

---

## Key Features

*   **Dual Meeting Modes**:
    *   **Live Microphone Mode**: Translates your real-time voice speech into text captions and transcripts using the browser's Web Speech API.
    *   **Simulated Team Demo Mode**: Playbacks a pre-recorded dialogue sequence between mock participants (Sarah Chen, Marcus, Emily) so you can test summary generation and AI features instantly without using mic/camera feeds.
*   **AI-Powered Meeting Summaries**:
    *   Generates comprehensive, structured minutes upon leaving a call: capturing **Topics Covered**, **Action Items** (assigned to individuals), **Key Decisions**, and a detailed **Discussion Narrative**.
    *   Uses Groq API LLMs (`llama-3.3-70b-versatile`) to analyze transcripts.
*   **Ask AI Meeting Assistant**:
    *   An interactive Q&A tab inside the AI Companion panel allows you to chat directly with an AI assistant about details of the call transcript.
*   **Multiplayer WebSocket State Sync**:
    *   Run multiple browser instances/tabs to join the same meeting room ID.
    *   Synchronizes participant lists, microphone mute/unmute statuses, camera feeds, emoji reactions, and hand-raising events live.
*   **In-Call Text Chat**:
    *   A right-side Chat Drawer permits textual communication.
    *   Features bubble alignments (sender on the right in blue, others on the left in dark grey).
    *   **Simulated AI Replies**: In Demo Mode, mock participants automatically reply to you contextually based on keywords (e.g. mention "design" and Alex responds with Figma mockup details).
*   **Interactive Emoji Reactions**:
    *   Click the Smiley button to choose reactions (`👍`, `❤️`, `😂`, `😮`, `😢`, `🎉`).
    *   Spawns floating emoji animations rising from the bottom of the screen.
    *   Broadcasts the reaction to show a temporary bouncing emoji overlay on your participant grid card.
*   **Raise Hand**:
    *   Toggles a raised-hand visual indicator (`✋`).
    *   Renders a wiggling hand badge on the participant card and within the list drawer.
*   **Participants / People Drawer**:
    *   Keeps track of all attendees, including their camera, microphone, and hand-raise statuses in real-time.
*   **Acoustic Audio Feedback**:
    *   Synthesizes organic digital audio chimes using the Web Audio API for interactive actions (join chime, leave chime, mute, unmute, button clicks).

---

## Tech Stack

### Frontend
*   **Framework**: React 19 (TypeScript)
*   **Bundler/Dev Server**: Vite 6
*   **Styling**: Tailwind CSS v4 & custom keyframe CSS animations
*   **Animations**: Motion (Framer Motion)
*   **Icons**: Lucide React

### Backend
*   **Server**: Node.js & Express
*   **WebSockets**: `ws` package for real-time multiplayer connection updates
*   **Runner**: `tsx` (TypeScript Execute)
*   **AI Integration**: Groq API integration (Whisper transcription & Llama completions) with mock offline fallbacks

---

## Getting Started

### Prerequisites
*   [Node.js](https://nodejs.org/) (version 18 or higher recommended)

### 1. Installation
Clone the repository and install the dependencies:
```bash
npm install
```

### 2. Environment Setup
Create a `.env` file in the root directory and add your API key (if you have one). If you don't configure a key, the application automatically uses mock offline fallbacks:
```env
GEMINI_API_KEY="your_groq_or_gemini_api_key"
APP_URL="http://localhost:3000"
PORT=3000
```
*(Note: Both Groq `gsk_` keys and Gemini keys are accepted).*

### 3. Run Locally
Start the development server (which compiles the frontend via Vite middleware and runs the Express/WebSocket server):
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:3000`.

### 4. Build and Compile
To build both the React frontend assets and package the TypeScript server for production:
```bash
npm run build
```

To run the built production bundle:
```bash
npm run start
```

---

## Production Deployment

### Recommended: Render / Railway / Fly.io
Since the app requires a persistent WebSocket server and local JSON file writes (`meetings.json` to store recent activities), you should deploy it to a platform that supports persistent servers.

#### Setup for Render/Railway:
1. Push your code to a GitHub repository.
2. Link the repository to your Web Service provider.
3. Configure the build and start commands:
   * **Build Command**: `npm install && npm run build`
   * **Start Command**: `npm run start`
4. Add the `GEMINI_API_KEY` to the service's environment variables.
