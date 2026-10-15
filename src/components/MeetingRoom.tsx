import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Video as VideoIcon, VideoOff, Monitor, MessageSquare, Users, FileText, Sparkles, PhoneOff, Smile, Hand, Info, Loader2, X, Copy, Check, Search, Eye, EyeOff, Volume2, XCircle, RefreshCw } from "lucide-react";
import { Meeting, TranscriptLine, ActionItem } from "../types";
import AIAssistant from "./AIAssistant";

interface MeetingRoomProps {
  meetingId: string;
  meetingTitle: string;
  isDemo: boolean;
  onLeave: (finalMeeting: Meeting) => void;
  onCancel: () => void;
  userName?: string;
  userPhone?: string;
}

// Simulated Dialogue Sequence
const SIMULATED_DIALOGUE = [
  { speaker: "Sarah Chen", text: "Welcome everyone to our Q3 Sync call. Today we want to align on our roadmap priorities and discuss design options for the new dashboard.", topics: ["Q3 Roadmap"] },
  { speaker: "Marcus", text: "Awesome. I've compiled the latest backend performance metrics. Improving the API endpoints should definitely be high on our list.", topics: ["Q3 Roadmap", "API Improvements"] },
  { speaker: "Emily", text: "That makes sense Marcus, but we must also look at our user research. Around 68% of our traffic originates from mobile devices.", topics: ["User Research", "Mobile App"] },
  { speaker: "Sarah Chen", text: "...and I think the new design approach will really help us move faster on product iterations.", topics: ["Design System", "Mobile App"] },
  { speaker: "Tom", text: "Right, if we can build a lightweight mobile interface first, it would mitigate any immediate churn risks while we refactor the slower database queries.", topics: ["Mobile App", "API Improvements"] },
  { speaker: "Marcus", text: "I agree with Tom. We can dedicate one developer to optimize latency on our heavy SQL routes, while the rest focus on the mobile interface.", topics: ["API Improvements", "Mobile App"] },
  { speaker: "Emily", text: "Excellent! I'll share the full mobile report right after this call so we can map out which endpoints are critical.", topics: ["User Research", "Mobile App"] },
  { speaker: "Alex", text: "Perfect! Once we have that, I can draft the high-fidelity prototypes in Figma using our modern dark teal theme.", topics: ["Design System"] },
  { speaker: "Sarah Chen", text: "Okay, that's decided then. We'll split the team: Mobile visual development first, with targeted backend performance fixes.", topics: ["Q3 Roadmap"] },
  { speaker: "Tom", text: "I'll do a technical review on the SVG layouts to make sure the load times are optimal on mobile Safari.", topics: ["Mobile App", "Design System"] },
  { speaker: "Sarah Chen", text: "Awesome work team. Let's get these tasks documented and start drafting the timeline.", topics: ["Q3 Roadmap"] },
  { speaker: "Marcus", text: "On it. I'll create the ticket specifications right away.", topics: ["Q3 Roadmap"] }
];

export default function MeetingRoom({
  meetingId,
  meetingTitle,
  isDemo,
  onLeave,
  onCancel,
  userName,
  userPhone
}: MeetingRoomProps) {
  const selfName = userName ? `You (${userName})` : "You (Me)";

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [activeSpeaker, setActiveSpeaker] = useState(selfName);
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const [subtitleText, setSubtitleText] = useState("Waiting for speakers to join...");
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [aiGenerationError, setAiGenerationError] = useState<string | null>(null);

  // Activated Interactive Features states
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeReactions, setActiveReactions] = useState<{ id: string; emoji: string; x: number; speakerName: string }[]>([]);
  const [participantReactions, setParticipantReactions] = useState<Record<string, string>>({});
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isPeopleOpen, setIsPeopleOpen] = useState(false);
  const [roomChatMessages, setRoomChatMessages] = useState<any[]>([]);
  const [chatInputText, setChatInputText] = useState("");
  const [demoParticipants, setDemoParticipants] = useState([
    { id: "demo-sarah", name: "Sarah Chen", initials: "SC", color: "bg-emerald-600", isMuted: false, isCameraOn: true, isHandRaised: false },
    { id: "demo-marcus", name: "Marcus", initials: "MR", color: "bg-amber-600", isMuted: true, isCameraOn: true, isHandRaised: false },
    { id: "demo-emily", name: "Emily", initials: "EW", color: "bg-pink-600", isMuted: false, isCameraOn: false, isHandRaised: false },
  ]);

  const openSidebar = (panel: "ai" | "transcript" | "chat" | "people" | null) => {
    setIsAiOpen(panel === "ai");
    setIsTranscriptOpen(panel === "transcript");
    setIsChatOpen(panel === "chat");
    setIsPeopleOpen(panel === "people");
  };

  const triggerFloatingEmoji = (emoji: string, speakerName: string) => {
    const randomX = Math.floor(Math.random() * 80) - 40; // -40px to +40px
    const id = Math.random().toString(36).substring(2, 9);
    setActiveReactions((prev) => [...prev, { id, emoji, x: randomX, speakerName }]);

    // Set a temp reaction indicator for participant cards
    setParticipantReactions((prev) => ({ ...prev, [speakerName]: emoji }));
    setTimeout(() => {
      setParticipantReactions((prev) => {
        const next = { ...prev };
        delete next[speakerName];
        return next;
      });
    }, 3000);

    // Cleanup floating reaction
    setTimeout(() => {
      setActiveReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2000);
  };

  const sendReaction = (emoji: string) => {
    const sender = userName || "You";
    triggerFloatingEmoji(emoji, sender);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "reaction",
        senderName: sender,
        reaction: emoji
      }));
    }
    setShowEmojiPicker(false);
  };

  const sendChatMessage = (text: string) => {
    if (!text.trim()) return;
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const senderName = userName || "Anonymous Guest";
    const newMessage = {
      id: Math.random().toString(36).substring(2, 9),
      senderId: clientIdRef.current,
      senderName,
      text: text.trim(),
      timestamp
    };

    setRoomChatMessages((prev) => [...prev, newMessage]);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "chat-message",
        message: newMessage
      }));
    }

    if (isDemo) {
      simulateDemoReply(text.trim());
    }
  };

  const simulateDemoReply = (text: string) => {
    const lowercase = text.toLowerCase();
    let replyText = "";
    let speaker = "Sarah Chen";

    if (lowercase.includes("roadmap") || lowercase.includes("schedule") || lowercase.includes("when")) {
      speaker = "Sarah Chen";
      replyText = "We should try to finalize the Q3 roadmap timeline by Friday. Let's keep moving forward on the mobile spec.";
    } else if (lowercase.includes("prototype") || lowercase.includes("design") || lowercase.includes("figma")) {
      speaker = "Alex";
      replyText = "I'm already drafting the mobile templates. I'll make sure the dark teal theme aligns with our goals.";
    } else if (lowercase.includes("backend") || lowercase.includes("api") || lowercase.includes("db") || lowercase.includes("query")) {
      speaker = "Marcus";
      replyText = "I'll do the SQL refactoring this afternoon. We should see response times drop below 200ms.";
    } else if (lowercase.includes("research") || lowercase.includes("mobile") || lowercase.includes("user")) {
      speaker = "Emily";
      replyText = "The analytics show mobile is indeed the key. I can share the raw feedback document if that helps!";
    } else {
      const replies = [
        "Interesting point. Let's make sure we document this in our sync details.",
        "I agree. We should stay focused on our key delivery metrics.",
        "That sounds good to me. Let's coordinate on Slack afterwards.",
        "Should we schedule a follow-up for that topic next week?",
      ];
      const speakers = ["Sarah Chen", "Marcus", "Emily"];
      speaker = speakers[Math.floor(Math.random() * speakers.length)];
      replyText = replies[Math.floor(Math.random() * replies.length)];
    }

    setTimeout(() => {
      const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setRoomChatMessages((prev) => [...prev, {
        id: Math.random().toString(36).substring(2, 9),
        senderId: "demo-speaker",
        senderName: speaker,
        text: replyText,
        timestamp
      }]);
    }, 1500 + Math.random() * 1500);
  };

  const toggleRaiseHand = () => {
    const nextVal = !isHandRaised;
    setIsHandRaised(nextVal);
    playFeedbackSound("click");

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "raise-hand",
        isHandRaised: nextVal
      }));
    }
  };

  // Multiplayer room presence synchronization states
  const clientIdRef = useRef(Math.random().toString(36).substring(2, 9));
  const socketRef = useRef<WebSocket | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<any[]>([]);
  const [participantsCount, setParticipantsCount] = useState(1);

  // Subtitle visibility & Audio Feedback states
  const [isSubtitleVisible, setIsSubtitleVisible] = useState(true);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);

  // Web Audio synthetic Sound Effects generator
  const playFeedbackSound = (type: "join" | "leave" | "mute" | "unmute" | "click") => {
    if (!isSoundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === "join") {
        // Ascending high quality chime synthesizer
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now); // A4
        osc.frequency.setValueAtTime(554.37, now + 0.08); // C#5
        osc.frequency.setValueAtTime(659.25, now + 0.16); // E5
        osc.frequency.setValueAtTime(880, now + 0.24); // A5
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      } else if (type === "leave") {
        // Descending high quality chime synthesizer
        osc.type = "sine";
        osc.frequency.setValueAtTime(783.99, now); // G5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        osc.frequency.setValueAtTime(523.25, now + 0.16); // C5
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === "mute") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.setValueAtTime(240, now + 0.06);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === "unmute") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.setValueAtTime(360, now + 0.06);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === "click") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      }
    } catch (err) {
      console.warn("Audio feedback error or policy block:", err);
    }
  };

  // Play meeting join chime on component load
  useEffect(() => {
    // Small delay to ensure browser user gesture is registered or context can warm up
    const timer = setTimeout(() => {
      playFeedbackSound("join");
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Lists of transcript lines
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);

  // Progressive summary metrics (for demo)
  const [summary, setSummary] = useState("Meeting in progress...");
  const [topicsCovered, setTopicsCovered] = useState<string[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [decisions, setDecisions] = useState<string[]>([]);

  // Web Speech API references
  const recognitionRef = useRef<any>(null);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);

  // Audio Visualizer Reference (simulation)
  const [audioLevel, setAudioLevel] = useState<number[]>([10, 20, 15, 30, 25, 12, 18]);

  // Keep track of index in demo dialogue
  const demoIndexRef = useRef(0);

  // References and states for real media streams (Camera & Microphone)
  const localVideoStageRef = useRef<HTMLVideoElement | null>(null);
  const localVideoGridRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [hasRealAudio, setHasRealAudio] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationIdRef = useRef<number | null>(null);

  // Unified camera and microphone initialization (Safe for iOS Safari)
  useEffect(() => {
    if (isDemo) return;

    let active = true;

    async function initMedia() {
      try {
        // Request both audio and video tracks in a single call to prevent concurrent stream request block on iOS Safari
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: 640, height: 480, facingMode: "user" }
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = stream;

        // Populate video elements
        if (localVideoStageRef.current) {
          localVideoStageRef.current.srcObject = stream;
        }
        if (localVideoGridRef.current) {
          localVideoGridRef.current.srcObject = stream;
        }

        // Initialize Web Audio analyzer
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();
          audioCtxRef.current = audioCtx;

          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 32;
          analyserRef.current = analyser;

          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          setHasRealAudio(true);

          const updateLevel = () => {
            if (!active || !analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            const newLevels = Array.from({ length: 7 }, (_, i) => {
              const index = Math.floor((i / 7) * bufferLength);
              const val = dataArray[index] || 0;
              return Math.floor((val / 255) * 35) + 5;
            });
            setAudioLevel(newLevels);
            animationIdRef.current = requestAnimationFrame(updateLevel);
          };
          updateLevel();
        }

        // Apply initial mute / camera enabled states
        stream.getAudioTracks().forEach((t) => (t.enabled = !isMuted));
        stream.getVideoTracks().forEach((t) => (t.enabled = isCameraOn));

      } catch (error) {
        console.warn("Unified media stream request failed, attempting audio-only fallback:", error);
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (!active) {
            audioStream.getTracks().forEach((track) => track.stop());
            return;
          }
          localStreamRef.current = audioStream;
          audioStream.getAudioTracks().forEach((t) => (t.enabled = !isMuted));
          setHasRealAudio(true);
        } catch (audioErr) {
          console.warn("Microphone access failed:", audioErr);
        }
      }
    }

    initMedia();

    return () => {
      active = false;
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => { });
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isDemo]);

  // Handle dynamic camera state changes (without restarting stream on iOS)
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = isCameraOn;
      });
    }
  }, [isCameraOn]);

  // Handle dynamic mute state changes (without restarting stream on iOS)
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
    }

    // iOS Safari requires explicit resume of suspended AudioContext on interaction/state change
    if (audioCtxRef.current && audioCtxRef.current.state === "suspended" && !isMuted) {
      audioCtxRef.current.resume().catch((err) => console.warn("Could not resume AudioContext:", err));
    }
  }, [isMuted]);

  // Ensure refs are correctly populated with stream when re-rendered
  useEffect(() => {
    if (isCameraOn && localStreamRef.current) {
      if (localVideoStageRef.current && localVideoStageRef.current.srcObject !== localStreamRef.current) {
        localVideoStageRef.current.srcObject = localStreamRef.current;
      }
      if (localVideoGridRef.current && localVideoGridRef.current.srcObject !== localStreamRef.current) {
        localVideoGridRef.current.srcObject = localStreamRef.current;
      }
    }
  });

  // 1. Durational timer (format seconds as hh:mm:ss or mm:ss)
  useEffect(() => {
    const timer = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // WebSocket synchronization for multi-player rooms (non-demo)
  useEffect(() => {
    if (isDemo) {
      setParticipantsCount(5);
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected to room:", meetingId);
      // Join the room
      ws.send(
        JSON.stringify({
          type: "join-room",
          roomId: meetingId,
          participant: {
            id: clientIdRef.current,
            name: userName || "Anonymous Guest",
            phone: userPhone || "",
            isMuted,
            isCameraOn,
          },
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case "room-participants": {
            // Exclude ourselves from remote participants
            const others = message.participants.filter(
              (p: any) => p.id !== clientIdRef.current
            );
            setRemoteParticipants(others);
            setParticipantsCount(message.participants.length);
            break;
          }
          case "receive-transcript-line": {
            setTranscriptLines((prev) => [...prev, message.line]);
            setActiveSpeaker(message.line.speaker);
            setSubtitleText(message.line.text);
            break;
          }
          case "receive-reaction": {
            triggerFloatingEmoji(message.reaction, message.senderName);
            break;
          }
          case "receive-chat-message": {
            setRoomChatMessages((prev) => [...prev, message.message]);
            break;
          }
        }
      } catch (err) {
        console.error("Error handling websocket message:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      socketRef.current = null;
    };
  }, [isDemo, meetingId]);

  // Sync local mute/camera states to remote peers
  useEffect(() => {
    if (isDemo || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    socketRef.current.send(
      JSON.stringify({
        type: "update-state",
        isMuted,
        isCameraOn,
      })
    );
  }, [isMuted, isCameraOn, isDemo]);

  // Demo mode periodic emoji reactions and hand-raising simulation
  useEffect(() => {
    if (!isDemo) return;

    const reactionInterval = setInterval(() => {
      const emojis = ["👍", "❤️", "😂", "😮", "🎉"];
      const demoNames = ["Sarah Chen", "Marcus", "Emily"];
      const randomName = demoNames[Math.floor(Math.random() * demoNames.length)];
      const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

      triggerFloatingEmoji(randomEmoji, randomName);
    }, 8000);

    const handInterval = setInterval(() => {
      const demoNames = ["Sarah Chen", "Marcus", "Emily"];
      const randomName = demoNames[Math.floor(Math.random() * demoNames.length)];

      setDemoParticipants((prev) =>
        prev.map((p) => {
          if (p.name === randomName) {
            const nextHand = !p.isHandRaised;
            return { ...p, isHandRaised: nextHand };
          }
          return p;
        })
      );
    }, 18000);

    return () => {
      clearInterval(reactionInterval);
      clearInterval(handInterval);
    };
  }, [isDemo]);

  // 2. Simulated Dialogue playback loop
  useEffect(() => {
    if (!isDemo) return;

    const playNextDialogue = () => {
      const idx = demoIndexRef.current;
      if (idx >= SIMULATED_DIALOGUE.length) {
        // End of simulated dialog
        return;
      }

      const item = SIMULATED_DIALOGUE[idx];
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const newLine: TranscriptLine = {
        id: String(idx + 1),
        speaker: item.speaker,
        text: item.text,
        timestamp: timestamp
      };

      setTranscriptLines((prev) => [...prev, newLine]);
      setActiveSpeaker(item.speaker);
      setSubtitleText(item.text);

      // Progressively build AI Assistant metrics
      setTopicsCovered((prev) => {
        const merged = [...prev, ...item.topics];
        return Array.from(new Set(merged));
      });

      // Update progressive Summary
      if (idx <= 2) {
        setSummary("The team assembled to begin their weekly team sync. Sarah Chen introduced the main priorities: coordinating the upcoming Q3 product roadmap and addressing design resources.");
      } else if (idx <= 6) {
        setSummary("A debate arose regarding mobile client resources versus database latency optimizations. Emily pointed out that 68% of users are on mobile, while Marcus argued backend lag causes direct customer complaints.");
      } else {
        setSummary("The team reached a compromise: prioritize high-impact mobile client screens first, while delegating one backend engineer to target slow SQL routes. Emily is preparing the mobile data report, and Alex will begin high-fidelity design prototypes.");
      }

      // Add progressive action items
      if (idx === 1) {
        setActionItems((prev) => [...prev, { assignee: "Marcus", task: "Compile backend API performance metrics.", completed: false }]);
      } else if (idx === 6) {
        setActionItems((prev) => [...prev, { assignee: "Emily", task: "Share full mobile user research report with Marcus.", completed: false }]);
      } else if (idx === 7) {
        setActionItems((prev) => [...prev, { assignee: "Alex", task: "Create dark minimalist teal Figma mockups.", completed: false }]);
      } else if (idx === 9) {
        setActionItems((prev) => [...prev, { assignee: "Tom", task: "Review SVG layout load times on mobile devices.", completed: false }]);
      }

      // Add progressive decisions
      if (idx === 5) {
        setDecisions((prev) => [...prev, "Adopt a hybrid engineering resource split between mobile and backend."]);
      } else if (idx === 8) {
        setDecisions((prev) => [...prev, "Use modern dark minimalist layout with deep teal accents for landing page."]);
      }

      demoIndexRef.current = idx + 1;
    };

    // Delay first line to let the user start as the default active speaker
    const timeout = setTimeout(playNextDialogue, 4000);

    // Loop through dialogs every 10 seconds to give breathing room for live user inputs
    const interval = setInterval(playNextDialogue, 10000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [isDemo]);

  // 3. Live Microphone Speech Recognition
  useEffect(() => {
    if (isMuted || isSaving) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) { }
      }
      return;
    }

    // Check speech recognition support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setRecognitionError("Speech recognition not supported in this browser. Try Chrome or Safari.");
      setSubtitleText("Speech recognition not supported. Speak anyway! Click 'Leave' to synthesize summaries.");
      return;
    }

    let hasFatalError = false;

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onstart = () => {
        console.log("Speech recognition active");
        setSubtitleText("Listening to your voice... Start speaking!");
      };

      rec.onresult = (e: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal) {
            finalTranscript += e.results[i][0].transcript;
          } else {
            interimTranscript += e.results[i][0].transcript;
          }
        }

        const currentText = finalTranscript || interimTranscript;
        if (currentText.trim()) {
          setSubtitleText(currentText);
          setActiveSpeaker(selfName);

          // If we have a finalized sentence, append it to the transcript log
          if (finalTranscript.trim()) {
            const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const newLine: TranscriptLine = {
              id: String(Date.now()),
              speaker: selfName,
              text: finalTranscript.trim(),
              timestamp
            };
            setTranscriptLines((prev) => [...prev, newLine]);

            // Broadcast newly transcribed sentence to other participants
            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
              socketRef.current.send(JSON.stringify({
                type: "transcript-line",
                line: {
                  ...newLine,
                  speaker: userName || "Anonymous Guest"
                }
              }));
            }
          }
        }
      };

      rec.onerror = (e: any) => {
        // Use console.warn instead of console.error to avoid flagging transient Web Speech events as fatal app crashes
        console.warn("Speech Recognition info event:", e.error);
        if (e.error === "not-allowed") {
          hasFatalError = true;
          setRecognitionError("Microphone permission restricted. Please open this app in a New Tab to grant microphone permissions, or enjoy the pre-recorded Demo participants!");
        } else if (e.error === "service-not-allowed") {
          hasFatalError = true;
          setRecognitionError("Speech recognition service is not allowed or restricted by your browser policies.");
        }
      };

      rec.onend = () => {
        // Auto restart if not muted, not saving, and didn't hit a fatal error (to prevent infinite loops)
        if (!isMuted && !isSaving && !hasFatalError) {
          try {
            rec.start();
          } catch (err) {
            console.warn("Failed to restart speech recognition:", err);
          }
        }
      };

      recognitionRef.current = rec;

      try {
        rec.start();
      } catch (startErr) {
        console.warn("Could not start Speech Recognition immediately:", startErr);
      }

      return () => {
        if (recognitionRef.current) {
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        }
      };
    } catch (err) {
      console.warn("Web Speech API setup error:", err);
    }
  }, [isMuted, isSaving]);

  // Handle Mute toggle (stops speech recognition if alive)
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    playFeedbackSound(nextMuted ? "mute" : "unmute");

    if (recognitionRef.current) {
      if (nextMuted) {
        recognitionRef.current.stop();
        setSubtitleText("Microphone muted. Speech recognition paused.");
      } else {
        try {
          recognitionRef.current.start();
          setSubtitleText("Microphone active. Listening...");
        } catch (err) { }
      }
    }
  };

  // Simulate audio level spikes (bouncing waves)
  useEffect(() => {
    if (hasRealAudio) return;

    const audioInterval = setInterval(() => {
      if (isMuted) {
        setAudioLevel([2, 2, 2, 2, 2, 2, 2]);
        return;
      }
      setAudioLevel(
        Array.from({ length: 7 }, () => Math.floor(Math.random() * 35) + 5)
      );
    }, 150);
    return () => clearInterval(audioInterval);
  }, [isMuted, hasRealAudio]);

  // 4. Leave meeting and compile structured minutes via Express API
  const handleLeaveCall = async () => {
    setIsSaving(true);
    setAiGenerationError(null);
    playFeedbackSound("leave");

    // Stop recording
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
    }

    // Compile entire transcript text block
    let fullTranscriptText = transcriptLines
      .map((line) => `${line.speaker}: ${line.text}`)
      .join("\n");

    // Fallback if transcript was empty
    if (!fullTranscriptText.trim()) {
      if (isDemo) {
        fullTranscriptText = SIMULATED_DIALOGUE
          .map((line) => `${line.speaker}: ${line.text}`)
          .join("\n");
      } else {
        fullTranscriptText = `${selfName}: We discussed replicating the beautiful minutes taker web app, configuring server-side Gemini endpoints, and finalizing visual high-fidelity components.`;
      }
    }

    try {
      // Call Express summarization endpoint
      const response = await fetch("/api/gemini/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: fullTranscriptText,
          title: meetingTitle
        })
      });

      if (!response.ok) {
        throw new Error("No response from AI / Failed to connect to server");
      }

      const structuredMinutes = await response.json();

      if (!structuredMinutes || structuredMinutes.error) {
        throw new Error(structuredMinutes?.error || "No response from AI");
      }

      // Save complete Meeting object to meetings.json
      const formattedDate = "Today, " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const allPeoplePresent = isDemo
        ? ["Sarah Chen", "Marcus", "Emily", selfName]
        : [userName || "Anonymous Guest", ...remoteParticipants.map((p) => p.name)];

      const mergedPeople = [
        ...allPeoplePresent,
        ...(structuredMinutes.peoplePresent || [])
      ];

      const cleanPeoplePresent: string[] = Array.from(new Set(
        mergedPeople.map((name: string) => {
          let cleanName = name.replace(/^You \((.+)\)$/i, "$1").trim();
          if (cleanName.toLowerCase() === "me" || cleanName.toLowerCase() === "you (me)") {
            cleanName = userName || "Anonymous Guest";
          }
          return cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
        })
      ));

      const finalMeeting: Meeting = {
        id: meetingId,
        title: meetingTitle,
        date: formattedDate,
        createdAt: new Date().toISOString(),
        participantsCount: isDemo ? 5 : Math.max(participantsCount, cleanPeoplePresent.length),
        duration: formatDuration(duration),
        transcript: transcriptLines.length > 0 ? transcriptLines : (isDemo ? SIMULATED_DIALOGUE.map((d, i) => ({ id: String(i), speaker: d.speaker, text: d.text, timestamp: "Today" })) : []),
        summary: structuredMinutes.summary,
        topicsCovered: structuredMinutes.topicsCovered && structuredMinutes.topicsCovered.length > 0 ? structuredMinutes.topicsCovered : ["General Discussion"],
        actionItems: structuredMinutes.actionItems,
        decisions: structuredMinutes.decisions,
        peoplePresent: cleanPeoplePresent,
        discussion: structuredMinutes.discussion || ""
      };

      // POST to /api/meetings to persist
      await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalMeeting)
      });

      onLeave(finalMeeting);
    } catch (error: any) {
      console.error("Error creating structured minutes:", error);
      setAiGenerationError(error?.message || "No response from AI");
      setIsSaving(false);
    }
  };

  const handleSaveLocalFallback = async () => {
    setIsSaving(true);
    try {
      const allPeoplePresent = isDemo
        ? ["Sarah Chen", "Marcus", "Emily", selfName]
        : [userName || "Anonymous Guest", ...remoteParticipants.map((p) => p.name)];

      const cleanPeoplePresent: string[] = Array.from(new Set(
        (allPeoplePresent as string[]).map((name: string) => {
          let cleanName = name.replace(/^You \((.+)\)$/i, "$1").trim();
          if (cleanName.toLowerCase() === "me" || cleanName.toLowerCase() === "you (me)") {
            cleanName = userName || "Anonymous Guest";
          }
          return cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
        })
      ));

      const localTopics: string[] = [...topicsCovered];
      if (localTopics.length === 0 && transcriptLines.length > 0) {
        const text = transcriptLines.map(l => l.text).join(" ");
        const words = text
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

        localTopics.push(...sorted.slice(0, 4));
      }
      if (localTopics.length === 0) {
        localTopics.push("General Discussion");
      }

      const fallbackMeeting: Meeting = {
        id: meetingId,
        title: meetingTitle,
        date: "Today, " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString(),
        participantsCount: isDemo ? 5 : participantsCount,
        duration: formatDuration(duration),
        transcript: transcriptLines.length > 0 ? transcriptLines : (isDemo ? SIMULATED_DIALOGUE.map((d, i) => ({ id: String(i), speaker: d.speaker, text: d.text, timestamp: "Today" })) : []),
        summary: summary || "Meeting conducted offline with standard transcripts compiled.",
        topicsCovered: localTopics,
        actionItems: actionItems,
        decisions: decisions,
        peoplePresent: cleanPeoplePresent,
        discussion: "Meeting completed. Standard offline local minutes saved because there was no response from AI."
      };

      // POST to /api/meetings to persist
      await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fallbackMeeting)
      });

      onLeave(fallbackMeeting);
    } catch (err) {
      console.error("Local fallback save failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActionItem = (task: string, completed: boolean) => {
    setActionItems((prev) =>
      prev.map((item) => (item.task === task ? { ...item, completed } : item))
    );
  };

  // Speaker Avatars
  const getSpeakerColor = (speakerName: string) => {
    switch (speakerName) {
      case "Sarah Chen": return "bg-emerald-600 text-white";
      case "Marcus": return "bg-amber-600 text-white";
      case "Emily": return "bg-pink-600 text-white";
      case "Tom": return "bg-red-500 text-white";
      case "Alex": return "bg-indigo-600 text-white";
      default: return "bg-blue-600 text-white";
    }
  };

  const getSpeakerInitials = (speakerName: string) => {
    if (speakerName === "You (Me)" || speakerName === selfName) {
      if (userName) {
        const parts = userName.split(" ");
        return parts.map((p) => p[0]).join("").substring(0, 2).toUpperCase();
      }
      return "ME";
    }
    const parts = speakerName.split(" ");
    return parts.map((p) => p[0]).join("").substring(0, 2).toUpperCase();
  };

  const isSidePanelOpen = isAiOpen || isTranscriptOpen;

  const filteredLines = transcriptLines.filter((line) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return line.speaker.toLowerCase().includes(q) || line.text.toLowerCase().includes(q);
  });

  const handleCopyTranscript = () => {
    const text = transcriptLines.map(line => `[${line.timestamp}] ${line.speaker}: ${line.text}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (isTranscriptOpen && transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcriptLines, isTranscriptOpen]);

  return (
    <div
      id="meeting-room"
      className={`flex h-full w-full bg-[#090a0f] text-slate-200 p-2.5 sm:p-4 font-sans select-none relative md:overflow-hidden md:pb-5 ${isSidePanelOpen ? "flex-col md:flex-row md:gap-4 pb-28" : "flex-col overflow-y-auto scrollbar-none pb-28"
        }`}
    >
      <div className={`flex flex-col flex-grow ${isSidePanelOpen ? "w-full md:w-0 md:flex-grow md:overflow-y-auto md:scrollbar-none" : "h-full w-full md:h-0 md:min-h-0"
        }`}>
        {/* 1. Header Bar */}
        <div className="flex items-center justify-between mt-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0-1-.45-1-1v-3.5l4 4v-11l-4 4z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide truncate max-w-[150px]">
                {meetingTitle}
              </h2>
              <p className="text-[10px] text-slate-500 font-mono tracking-wider">{meetingId}</p>
            </div>
          </div>

          {/* Live Timer badge */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#1b1c27] border border-slate-800 rounded-full px-3.5 py-1 text-xs text-slate-300 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              <span>{formatDuration(duration)}</span>
            </div>
            <button
              onClick={() => {
                setShowInfoPopup(true);
                playFeedbackSound("click");
              }}
              className="p-2 text-slate-500 hover:text-white rounded-lg transition cursor-pointer"
              title="Meeting details & Profile"
            >
              <Info className="w-5 h-5" />
            </button>
          </div>

          {/* Detailed Host & Meeting Info Overlay */}
          {showInfoPopup && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
              <div className="bg-[#1c1d29] border border-slate-800 rounded-3xl p-5 w-full max-w-sm shadow-2xl relative animate-scale-in">
                <button
                  onClick={() => {
                    setShowInfoPopup(false);
                    playFeedbackSound("click");
                  }}
                  className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>

                <div className="flex flex-col items-center text-center mt-2 mb-4">
                  <div className="w-11 h-11 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-400 mb-2.5">
                    <Info className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Meeting Specifications</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">
                    Your active call identification & registered profile details.
                  </p>
                </div>

                {/* Call Details block */}
                <div className="bg-[#12131d] border border-slate-900 rounded-2xl p-3.5 space-y-3 mb-4">
                  <div>
                    <span className="block text-[8px] uppercase tracking-wider font-extrabold text-slate-500">Call Title</span>
                    <span className="text-xs font-semibold text-slate-200">{meetingTitle}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] uppercase tracking-wider font-extrabold text-slate-500">Joining Code</span>
                    <span className="text-xs font-semibold text-blue-400 select-all font-mono">meet.now/{meetingId}</span>
                  </div>
                </div>

                {/* Host profile details block */}
                <div className="bg-blue-600/5 border border-blue-500/10 rounded-2xl p-3.5 space-y-3 mb-5">
                  <span className="block text-[8px] uppercase tracking-wider font-extrabold text-blue-400">Caller Identity (Self)</span>

                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#1c2e54] flex items-center justify-center text-blue-400 text-xs font-bold font-sans">
                      {userName ? getSpeakerInitials(userName) : "ME"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white leading-tight truncate">{userName || "Anonymous Guest"}</p>
                      <p className="text-[9px] text-slate-400 leading-normal mt-0.5 font-mono">{userPhone || "No phone provided"}</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowInfoPopup(false);
                    playFeedbackSound("click");
                  }}
                  className="w-full bg-[#181924] hover:bg-slate-800 text-slate-300 font-semibold py-2.5 px-4 rounded-xl transition cursor-pointer text-xs uppercase tracking-wider border border-slate-800"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Split layout for desktop */}
        <div className="flex-grow flex flex-col md:grid md:grid-cols-12 md:gap-4 md:min-h-0 md:overflow-hidden">

          {/* Left column: Active Speaker (occupies 8 columns on desktop) */}
          <div className="flex flex-col flex-grow md:col-span-8 md:h-full md:min-h-0">
            {/* 2. Main Active Speaker Panel */}
            <div id="active-speaker-stage" className="flex-grow flex flex-col items-center justify-center relative mb-4 md:mb-0 bg-[#11121b] border border-slate-900 rounded-2xl overflow-hidden min-h-[220px]">
              {isScreenSharing ? (
                <div className="absolute inset-0 w-full h-full bg-[#0a0a14] z-10 flex flex-col items-center justify-center p-6 border-2 border-dashed border-blue-500/30 rounded-2xl">
                  {/* Glowing Background Grid representing screen sharing */}
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none"></div>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1)_0%,transparent_85%)] pointer-events-none animate-pulse"></div>

                  <div className="w-14 h-14 rounded-2xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3 animate-bounce">
                    <Monitor className="w-7 h-7" />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">You are sharing your screen</h3>
                  <p className="text-[10px] text-slate-400 max-w-[240px] text-center leading-normal">
                    Other participants can see everything on your screen. Minutes and transcripts are still being recorded live.
                  </p>
                  <button
                    onClick={() => setIsScreenSharing(false)}
                    className="mt-4 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-full shadow-md hover:shadow-blue-500/30 transition cursor-pointer active:scale-95 z-20"
                  >
                    Stop Sharing
                  </button>
                </div>
              ) : activeSpeaker === selfName && isCameraOn ? (
                <div className="absolute inset-0 w-full h-full bg-black z-0">
                  <video
                    ref={localVideoStageRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  {/* Visual overlay badge indicating it is You */}
                  <div className="absolute top-4 left-4 bg-slate-950/75 backdrop-blur-md border border-slate-800/80 rounded-full px-3 py-1 text-[10px] font-semibold text-white tracking-wide z-10 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                    Camera Feed Active
                  </div>
                </div>
              ) : (
                <>
                  {/* Glowing Background Radial */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.08)_0%,transparent_70%)] pointer-events-none"></div>

                  {/* Big speaker circle avatar */}
                  <div className="relative mb-6 z-10">
                    <div className={`w-32 h-32 rounded-full ${getSpeakerColor(activeSpeaker)} flex items-center justify-center text-4xl font-bold border-4 border-slate-900 shadow-2xl relative transition-all duration-300 ${activeSpeaker === selfName ? (!isMuted ? "scale-105" : "") : "scale-105"
                      }`}>
                      {getSpeakerInitials(activeSpeaker)}

                      {/* Bouncing Audio Visualizer Ring (if active and speaking) */}
                      {((activeSpeaker === selfName ? !isMuted : true)) && (
                        <div className="absolute -inset-2 rounded-full border-2 border-blue-500/20 animate-ping"></div>
                      )}
                    </div>

                    {/* Active Speaking Indicator Pill */}
                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-[#1c1e2d] border border-slate-800 rounded-full px-3 py-0.5 text-[9px] font-semibold text-emerald-400 flex items-center gap-1.5 shadow-md">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>{activeSpeaker}</span>
                    </div>
                  </div>
                </>
              )}

              {/* Live Subtitle Overlay Box */}
              {isSubtitleVisible ? (
                <div className="absolute bottom-4 inset-x-4 bg-slate-950/85 backdrop-blur-md rounded-xl p-3 border border-slate-800/80 z-20 shadow-lg min-h-[60px] flex flex-col justify-center group">
                  {/* Small, clean hide button */}
                  <button
                    onClick={() => {
                      setIsSubtitleVisible(false);
                      playFeedbackSound("click");
                    }}
                    className="absolute top-2.5 right-2.5 p-1 text-slate-400 hover:text-white rounded-md hover:bg-white/10 transition cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Hide captions"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                  </button>
                  <p className="text-[10px] text-emerald-400 font-extrabold tracking-wider mb-1 uppercase pr-6">
                    {activeSpeaker}:
                  </p>
                  <p className="text-xs text-white leading-relaxed font-normal pr-6">
                    {subtitleText}
                  </p>
                </div>
              ) : (
                /* Minimalist Floating Trigger */
                <button
                  onClick={() => {
                    setIsSubtitleVisible(true);
                    playFeedbackSound("click");
                  }}
                  className="absolute bottom-4 right-4 bg-slate-950/85 hover:bg-slate-900/90 backdrop-blur-md border border-slate-800/80 rounded-full px-3 py-1.5 text-[10px] font-semibold text-slate-300 hover:text-white tracking-wide z-20 flex items-center gap-1.5 shadow-lg cursor-pointer transition active:scale-95"
                  title="Show captions"
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Show Captions</span>
                </button>
              )}
            </div>
          </div>

          {/* Right column: Participants, Speech errors, and controls */}
          <div className="flex flex-col gap-3.5 md:col-span-4 md:h-full md:overflow-y-auto md:scrollbar-none shrink-0 pb-6 md:pb-2">

            {/* Speech Recognition Error Alert */}
            {recognitionError && (
              <div className="bg-red-950/30 border border-red-900/40 text-red-300 rounded-xl p-2.5 text-[10px] leading-relaxed">
                {recognitionError}
              </div>
            )}

            {/* Label for Participants list on desktop */}
            <div className="hidden md:flex items-center justify-between px-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Other Participants</span>
              <span className="text-[10px] font-mono text-slate-500">
                {isDemo ? "4 Online" : `${remoteParticipants.length} Online`}
              </span>
            </div>

            {/* 3. Grid of other participant cards (modified responsive grid) */}
            <div id="participants-grid" className="grid grid-cols-3 md:grid-cols-2 gap-2.5">
              {/* Card 0: You (Me) */}
              <div className={`bg-[#11121b] border rounded-2xl p-3 flex flex-col items-center justify-center text-center relative overflow-hidden transition-all duration-200 min-h-[90px] ${activeSpeaker === selfName ? "border-blue-500 bg-[#161d2b]/40" : "border-slate-900"
                }`}>
                <div className="relative mb-1">
                  <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold z-10">
                    {userName ? getSpeakerInitials(userName) : "ME"}
                  </div>
                  {isCameraOn && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#11121b] rounded-full z-20" title="Camera active"></span>
                  )}
                </div>

                <span className="text-[10px] font-semibold text-slate-300 z-10 bg-slate-950/70 px-1.5 py-0.5 rounded-md mt-auto font-sans text-center">
                  {selfName}
                </span>

                {isMuted && (
                  <MicOff className="w-3 h-3 text-red-400 absolute top-2 right-2 z-10 bg-slate-950/80 p-0.5 rounded-full" />
                )}

                {isHandRaised && (
                  <span className="absolute top-2 left-2 text-xs z-20 animate-hand-wiggle" title="Hand Raised">✋</span>
                )}

                {/* Emoji Reaction Bubble overlay */}
                {participantReactions[userName || "You"] && (
                  <div className="absolute inset-0 bg-slate-950/75 flex items-center justify-center z-30 animate-scale-in">
                    <span className="text-2xl animate-bounce">{participantReactions[userName || "You"]}</span>
                  </div>
                )}

                {/* Micro-Visualizer for You */}
                {activeSpeaker === selfName && !isMuted && (
                  <div className="flex items-end gap-0.5 h-4 absolute bottom-2 left-2 z-10 bg-slate-950/60 p-1 rounded-md">
                    {audioLevel.slice(0, 3).map((h, i) => (
                      <span key={i} className="w-0.5 bg-blue-400 rounded-full transition-all duration-150" style={{ height: `${h}%` }}></span>
                    ))}
                  </div>
                )}
              </div>

              {isDemo ? (
                demoParticipants.map((p) => {
                  const isDemoSpeaking = activeSpeaker === p.name;
                  return (
                    <div
                      key={p.id}
                      className={`bg-[#11121b] border rounded-2xl p-3 flex flex-col items-center justify-center text-center relative overflow-hidden transition-all duration-200 min-h-[90px] ${isDemoSpeaking ? "border-emerald-500/60 bg-[#161e24]/40" : "border-slate-900"}`}
                    >
                      <div className="relative mb-1">
                        <div className={`w-11 h-11 rounded-full ${p.color} flex items-center justify-center text-white text-sm font-bold z-10`}>
                          {p.initials}
                        </div>
                        {p.isCameraOn && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#11121b] rounded-full z-20" title="Camera active"></span>
                        )}
                      </div>

                      <span className="text-[10px] font-semibold text-slate-300 z-10 bg-slate-950/70 px-1.5 py-0.5 rounded-md mt-auto font-sans text-center truncate max-w-[90px]" title={p.name}>
                        {p.name}
                      </span>

                      {p.isMuted && (
                        <MicOff className="w-3 h-3 text-red-400 absolute top-2 right-2 z-10 bg-slate-950/80 p-0.5 rounded-full" />
                      )}

                      {p.isHandRaised && (
                        <span className="absolute top-2 left-2 text-xs z-20 animate-hand-wiggle" title="Hand Raised">✋</span>
                      )}

                      {/* Emoji Reaction Bubble overlay */}
                      {participantReactions[p.name] && (
                        <div className="absolute inset-0 bg-slate-950/75 flex items-center justify-center z-30 animate-scale-in">
                          <span className="text-2xl animate-bounce">{participantReactions[p.name]}</span>
                        </div>
                      )}

                      {/* Micro-Visualizer for Demo Participant */}
                      {isDemoSpeaking && !p.isMuted && (
                        <div className="flex items-end gap-0.5 h-4 absolute bottom-2 left-2 z-10 bg-slate-950/60 p-1 rounded-md">
                          {audioLevel.slice(0, 3).map((h, i) => (
                            <span key={i} className="w-0.5 bg-emerald-400 rounded-full transition-all duration-150" style={{ height: `${h}%` }}></span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                remoteParticipants.map((p) => {
                  const isRemoteSpeaking = activeSpeaker === p.name;
                  return (
                    <div
                      key={p.id}
                      className={`bg-[#11121b] border rounded-2xl p-3 flex flex-col items-center justify-center text-center relative overflow-hidden transition-all duration-200 min-h-[90px] ${isRemoteSpeaking ? "border-emerald-500/60 bg-[#161e24]/40" : "border-slate-900"
                        }`}
                    >
                      <div className="relative mb-1">
                        <div className={`w-11 h-11 rounded-full ${getSpeakerColor(p.name)} flex items-center justify-center text-white text-sm font-bold z-10`}>
                          {getSpeakerInitials(p.name)}
                        </div>
                        {p.isCameraOn && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#11121b] rounded-full z-20" title="Camera active"></span>
                        )}
                      </div>

                      <span className="text-[10px] font-semibold text-slate-300 z-10 bg-slate-950/70 px-1.5 py-0.5 rounded-md mt-auto truncate max-w-[90px]" title={p.name}>
                        {p.name}
                      </span>

                      {p.isMuted && (
                        <MicOff className="w-3 h-3 text-red-400 absolute top-2 right-2 z-10 bg-slate-950/80 p-0.5 rounded-full" />
                      )}

                      {p.isHandRaised && (
                        <span className="absolute top-2 left-2 text-xs z-20 animate-hand-wiggle" title="Hand Raised">✋</span>
                      )}

                      {/* Emoji Reaction Bubble overlay */}
                      {participantReactions[p.name] && (
                        <div className="absolute inset-0 bg-slate-950/75 flex items-center justify-center z-30 animate-scale-in">
                          <span className="text-2xl animate-bounce">{participantReactions[p.name]}</span>
                        </div>
                      )}

                      {/* Micro-Visualizer for Remote Participant */}
                      {isRemoteSpeaking && !p.isMuted && (
                        <div className="flex items-end gap-0.5 h-4 absolute bottom-2 left-2 z-10 bg-slate-950/60 p-1 rounded-md">
                          {audioLevel.slice(0, 3).map((h, i) => (
                            <span key={i} className="w-0.5 bg-emerald-400 rounded-full transition-all duration-150" style={{ height: `${h}%` }}></span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Mobile/Tablet Controls Stack */}
            <div className="md:hidden flex flex-col gap-3 mt-2 shrink-0">
              {/* 4. Controls Row (Upper Row) */}
              <div id="controls-toolbar" className="flex items-center justify-around bg-[#13141f] border border-slate-900 rounded-2xl py-3 px-4">
                <button
                  onClick={() => {
                    openSidebar(isChatOpen ? null : "chat");
                    playFeedbackSound("click");
                  }}
                  className={`flex flex-col items-center gap-1 transition group cursor-pointer shrink-0 ${isChatOpen ? "text-blue-400 font-bold" : "text-slate-400 hover:text-white"}`}
                >
                  <MessageSquare className="w-5 h-5 group-hover:scale-110 transition shrink-0" style={{ color: isChatOpen ? "#3b82f6" : undefined }} />
                  <span className="text-[9px] font-medium uppercase tracking-wider">Chat</span>
                </button>

                <button
                  onClick={() => {
                    openSidebar(isPeopleOpen ? null : "people");
                    playFeedbackSound("click");
                  }}
                  className={`flex flex-col items-center gap-1 transition group relative cursor-pointer shrink-0 ${isPeopleOpen ? "text-blue-400 font-bold" : "text-slate-400 hover:text-white"}`}
                >
                  <Users className="w-5 h-5 group-hover:scale-110 transition shrink-0" style={{ color: isPeopleOpen ? "#3b82f6" : undefined }} />
                  <span className="text-[9px] font-medium uppercase tracking-wider">People</span>
                  <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[8px] font-extrabold w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-[#13141f] shrink-0">
                    {isDemo ? 4 : participantsCount}
                  </span>
                </button>

                <button
                  onClick={() => {
                    openSidebar(isTranscriptOpen ? null : "transcript");
                    playFeedbackSound("click");
                  }}
                  className={`flex flex-col items-center gap-1 transition group cursor-pointer shrink-0 ${isTranscriptOpen ? "text-blue-400 font-bold" : "text-slate-400 hover:text-white"}`}
                >
                  <FileText className="w-5 h-5 group-hover:scale-110 transition shrink-0" style={{ color: isTranscriptOpen ? "#3b82f6" : undefined }} />
                  <span className="text-[9px] font-medium uppercase tracking-wider">Transcript</span>
                </button>

                {/* AI Companion Launcher Button */}
                <button
                  onClick={() => {
                    openSidebar(isAiOpen ? null : "ai");
                    playFeedbackSound("click");
                  }}
                  className={`flex flex-col items-center gap-1 transition group cursor-pointer shrink-0 ${isAiOpen ? "text-blue-400 font-bold" : "text-slate-400 hover:text-white"}`}
                >
                  <Sparkles className="w-5 h-5 animate-pulse group-hover:scale-110 transition shrink-0" style={{ color: isAiOpen ? "#3b82f6" : undefined }} />
                  <span className="text-[9px] font-bold uppercase tracking-wider">AI</span>
                </button>
              </div>

              {/* 5. Main Action Call Circular Buttons Row (Absolute Bottom) */}
              <div id="circular-actions" className="flex items-center justify-center gap-4 py-2 bg-[#11121b]/30">
                {/* Toggle Mute */}
                <button
                  onClick={handleToggleMute}
                  className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all active:scale-95 cursor-pointer shrink-0 ${isMuted
                    ? "bg-red-600/10 border-red-500/30 text-red-500 hover:bg-red-600/25"
                    : "bg-[#181924] border-slate-800 text-slate-200 hover:bg-slate-800"
                    }`}
                  title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                >
                  {isMuted ? <MicOff className="w-5 h-5 shrink-0" /> : <Mic className="w-5 h-5 shrink-0" />}
                </button>

                {/* Toggle Camera */}
                <button
                  onClick={() => {
                    setIsCameraOn(!isCameraOn);
                    playFeedbackSound("click");
                  }}
                  className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all active:scale-95 cursor-pointer shrink-0 ${!isCameraOn
                    ? "bg-red-600/10 border-red-500/30 text-red-500 hover:bg-red-600/25"
                    : "bg-[#181924] border-slate-800 text-slate-200 hover:bg-slate-800"
                    }`}
                  title={isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
                >
                  {isCameraOn ? <VideoIcon className="w-5 h-5 shrink-0" /> : <VideoOff className="w-5 h-5 shrink-0" />}
                </button>

                {/* Reactions Smiley */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowEmojiPicker(!showEmojiPicker);
                      playFeedbackSound("click");
                    }}
                    className={`w-11 h-11 rounded-full bg-[#181924] border border-slate-800 text-slate-200 hover:bg-slate-800 flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0 ${showEmojiPicker ? "border-blue-500 text-blue-400 bg-blue-600/5" : ""}`}
                    title="Send Reaction"
                  >
                    <Smile className="w-5 h-5 shrink-0" />
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute bottom-14 left-1/2 transform -translate-x-1/2 bg-[#141520] border border-slate-800 rounded-full px-3 py-1.5 flex items-center gap-2.5 shadow-2xl z-50 animate-scale-in">
                      {["👍", "❤️", "😂", "😮", "😢", "🎉"].map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => sendReaction(emoji)}
                          className="text-xl hover:scale-130 active:scale-95 transition cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Raise Hand */}
                <button
                  onClick={toggleRaiseHand}
                  className={`w-11 h-11 rounded-full border transition active:scale-95 cursor-pointer shrink-0 flex items-center justify-center ${isHandRaised
                    ? "bg-amber-600/20 border-amber-500/40 text-amber-400 hover:bg-amber-600/30"
                    : "bg-[#181924] border-slate-800 text-slate-200 hover:bg-slate-800"
                    }`}
                  title={isHandRaised ? "Lower Hand" : "Raise Hand"}
                >
                  <Hand className="w-5 h-5 shrink-0" style={{ fill: isHandRaised ? "currentColor" : "none" }} />
                </button>

                {/* End Call / Leave Red Button */}
                <button
                  onClick={handleLeaveCall}
                  className="w-11 h-11 rounded-full bg-[#ea4335] hover:bg-red-600 text-white flex items-center justify-center shadow-lg hover:shadow-red-500/30 transition duration-200 active:scale-95 shrink-0 cursor-pointer"
                  disabled={isSaving}
                  title="Leave Meeting & Generate AI Summary"
                >
                  {isSaving ? (
                    <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                  ) : (
                    <PhoneOff className="w-5 h-5 shrink-0" />
                  )}
                </button>
              </div>
            </div>

          </div>

        </div>

        {/* Desktop Unified Bottom Controls Bar */}
        <div className="hidden md:flex items-center justify-between bg-[#11121b] border border-slate-800/85 rounded-2xl px-6 py-3.5 mt-4 shadow-xl shrink-0">
          {/* Left: Meeting metadata */}
          <div className="flex items-center gap-3.5 w-1/3 min-w-0">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-200 truncate pr-2">{meetingTitle}</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                <span className="text-[10px] font-mono text-emerald-400 font-semibold uppercase tracking-wider shrink-0">Live</span>
                <span className="text-slate-600 text-[10px] shrink-0">•</span>
                <span className="text-[10px] font-mono text-slate-400 shrink-0">{formatDuration(duration)}</span>
              </div>
            </div>
          </div>

          {/* Center: Main call actions */}
          <div className="flex items-center justify-center gap-4 w-1/3 shrink-0">
            {/* Toggle Mute */}
            <button
              onClick={handleToggleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all active:scale-95 cursor-pointer shrink-0 ${isMuted
                ? "bg-red-600/15 border-red-500/40 text-red-500 hover:bg-red-600/30"
                : "bg-[#181924] border-slate-800 text-slate-200 hover:bg-slate-800"
                }`}
              title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
              {isMuted ? <MicOff className="w-5 h-5 shrink-0" /> : <Mic className="w-5 h-5 shrink-0" />}
            </button>

            {/* Toggle Camera */}
            <button
              onClick={() => {
                setIsCameraOn(!isCameraOn);
                playFeedbackSound("click");
              }}
              className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all active:scale-95 cursor-pointer shrink-0 ${!isCameraOn
                ? "bg-red-600/15 border-red-500/40 text-red-500 hover:bg-red-600/30"
                : "bg-[#181924] border-slate-800 text-slate-200 hover:bg-slate-800"
                }`}
              title={isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
            >
              {isCameraOn ? <VideoIcon className="w-5 h-5 shrink-0" /> : <VideoOff className="w-5 h-5 shrink-0" />}
            </button>

            {/* Reactions Smiley */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowEmojiPicker(!showEmojiPicker);
                  playFeedbackSound("click");
                }}
                className={`w-12 h-12 rounded-full bg-[#181924] border border-slate-800 text-slate-200 hover:bg-slate-800 flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0 ${showEmojiPicker ? "border-blue-500 text-blue-400 bg-blue-600/5" : ""}`}
                title="Send Reaction"
              >
                <Smile className="w-5 h-5 shrink-0" />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-[#141520] border border-slate-800 rounded-full px-3 py-1.5 flex items-center gap-2.5 shadow-2xl z-50 animate-scale-in">
                  {["👍", "❤️", "😂", "😮", "😢", "🎉"].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => sendReaction(emoji)}
                      className="text-xl hover:scale-130 active:scale-95 transition cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Raise Hand */}
            <button
              onClick={toggleRaiseHand}
              className={`w-12 h-12 rounded-full border transition active:scale-95 cursor-pointer shrink-0 flex items-center justify-center ${isHandRaised
                ? "bg-amber-600/25 border-amber-500/40 text-amber-400 hover:bg-amber-600/35"
                : "bg-[#181924] border-slate-800 text-slate-200 hover:bg-slate-800"
                }`}
              title={isHandRaised ? "Lower Hand" : "Raise Hand"}
            >
              <Hand className="w-5 h-5 shrink-0" style={{ fill: isHandRaised ? "currentColor" : "none" }} />
            </button>

            {/* End Call / Leave Red Button */}
            <button
              onClick={handleLeaveCall}
              className="w-12 h-12 rounded-full bg-[#ea4335] hover:bg-red-600 text-white flex items-center justify-center shadow-lg hover:shadow-red-500/30 transition duration-200 active:scale-95 shrink-0 cursor-pointer"
              disabled={isSaving}
              title="Leave Meeting & Generate AI Summary"
            >
              {isSaving ? (
                <Loader2 className="w-5 h-5 animate-spin shrink-0" />
              ) : (
                <PhoneOff className="w-5 h-5 shrink-0" />
              )}
            </button>
          </div>

          {/* Right: Quick utility controls */}
          <div className="flex items-center justify-end gap-5 w-1/3 shrink-0">
            {/* Sound Toggle Utility */}
            <button
              onClick={() => {
                const nextVal = !isSoundEnabled;
                setIsSoundEnabled(nextVal);
                if (nextVal) {
                  setTimeout(() => {
                    try {
                      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                      const osc = ctx.createOscillator();
                      const gain = ctx.createGain();
                      osc.connect(gain);
                      gain.connect(ctx.destination);
                      osc.frequency.setValueAtTime(600, ctx.currentTime);
                      gain.gain.setValueAtTime(0.04, ctx.currentTime);
                      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
                      osc.start();
                      osc.stop(ctx.currentTime + 0.05);
                    } catch (e) { }
                  }, 50);
                }
              }}
              className={`flex flex-col items-center gap-1 transition group cursor-pointer shrink-0 ${isSoundEnabled ? "text-emerald-400 font-semibold" : "text-slate-500 hover:text-white"}`}
              title={isSoundEnabled ? "Mute audio sound effects" : "Unmute audio sound effects"}
            >
              <Volume2 className="w-5 h-5 group-hover:scale-110 transition shrink-0" style={{ color: isSoundEnabled ? "#34d399" : undefined }} />
              <span className="text-[9px] font-medium uppercase tracking-wider">{isSoundEnabled ? "Sound On" : "Sound Off"}</span>
            </button>

            <button
              onClick={() => {
                openSidebar(isChatOpen ? null : "chat");
                playFeedbackSound("click");
              }}
              className={`flex flex-col items-center gap-1 transition group cursor-pointer shrink-0 ${isChatOpen ? "text-blue-400 font-bold" : "text-slate-400 hover:text-white"}`}
            >
              <MessageSquare className="w-5 h-5 group-hover:scale-110 transition shrink-0" style={{ color: isChatOpen ? "#3b82f6" : undefined }} />
              <span className="text-[9px] font-medium uppercase tracking-wider">Chat</span>
            </button>

            <button
              onClick={() => {
                openSidebar(isPeopleOpen ? null : "people");
                playFeedbackSound("click");
              }}
              className={`flex flex-col items-center gap-1 transition group relative cursor-pointer shrink-0 ${isPeopleOpen ? "text-blue-400 font-bold" : "text-slate-400 hover:text-white"}`}
            >
              <Users className="w-5 h-5 group-hover:scale-110 transition shrink-0" style={{ color: isPeopleOpen ? "#3b82f6" : undefined }} />
              <span className="text-[9px] font-medium uppercase tracking-wider">People</span>
              <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[8px] font-extrabold w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-[#13141f] shrink-0">
                {isDemo ? 4 : participantsCount}
              </span>
            </button>

            <button
              onClick={() => {
                openSidebar(isTranscriptOpen ? null : "transcript");
                playFeedbackSound("click");
              }}
              className={`flex flex-col items-center gap-1 transition group cursor-pointer shrink-0 ${isTranscriptOpen ? "text-blue-400 font-bold" : "text-slate-400 hover:text-white"}`}
            >
              <FileText className="w-5 h-5 group-hover:scale-110 transition shrink-0" style={{ color: isTranscriptOpen ? "#3b82f6" : undefined }} />
              <span className="text-[9px] font-medium uppercase tracking-wider">Transcript</span>
            </button>

            {/* AI Companion Launcher Button */}
            <button
              onClick={() => {
                openSidebar(isAiOpen ? null : "ai");
                playFeedbackSound("click");
              }}
              className={`flex flex-col items-center gap-1 transition group cursor-pointer shrink-0 ${isAiOpen ? "text-blue-400 font-bold" : "text-slate-400 hover:text-white"}`}
            >
              <Sparkles className="w-5 h-5 animate-pulse group-hover:scale-110 transition shrink-0" style={{ color: isAiOpen ? "#3b82f6" : undefined }} />
              <span className="text-[9px] font-bold uppercase tracking-wider font-sans">AI Companion</span>
            </button>
          </div>
        </div>

      </div>

      {/* AIAssistant Drawer overlay */}
      <AIAssistant
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        meetingTitle={meetingTitle}
        transcript={transcriptLines.map((line) => `${line.speaker}: ${line.text}`).join("\n")}
        summary={summary}
        topicsCovered={topicsCovered}
        participantsCount={isDemo ? 5 : participantsCount}
        duration={formatDuration(duration)}
        actionItems={actionItems}
        decisions={decisions}
        onToggleActionItem={handleToggleActionItem}
        isGenerating={isSaving}
      />

      {/* Live Transcript Drawer */}
      {isTranscriptOpen && (
        <div id="live-transcript-drawer" className="absolute inset-x-0 bottom-0 md:relative md:inset-auto md:h-full md:w-[380px] md:rounded-2xl md:border md:border-slate-800/80 md:shadow-none md:animate-none z-40 bg-[#14151f] rounded-t-3xl border-t border-slate-800 shadow-[0_-8px_40px_rgba(0,0,0,0.5)] flex flex-col h-[75%] w-full animate-slide-up select-none">
          {/* Top Grab Bar / Handle */}
          <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto my-3 md:hidden"></div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 pb-2 border-b border-slate-800/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400">
                <FileText className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-base">Meeting Transcript</h3>
                <p className="text-[10px] text-slate-400 font-medium truncate max-w-[180px]">{meetingTitle}</p>
              </div>
              <span className="bg-emerald-950/30 text-emerald-400 border border-emerald-900/30 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase flex items-center gap-1 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                LIVE
              </span>
            </div>
            <button id="close-transcript" onClick={() => setIsTranscriptOpen(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search, Action, Stats Bar */}
          <div className="px-5 py-3 border-b border-slate-800/40 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-medium text-slate-500">{filteredLines.length} spoken segment{filteredLines.length !== 1 && 's'}</span>
              <button
                onClick={handleCopyTranscript}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-[11px] font-semibold border border-slate-700/50 transition active:scale-95 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy All</span>
                  </>
                )}
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                placeholder="Search speech or speaker..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1c1d29] border border-slate-800 rounded-full pl-9 pr-8 py-1.5 text-base text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Transcript Content Container */}
          <div className="flex-grow overflow-y-auto p-5 space-y-4">
            {filteredLines.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-10 gap-2 text-slate-500 text-center">
                <FileText className="w-10 h-10 text-slate-600 mb-1" />
                <p className="text-xs font-semibold">
                  {searchQuery ? "No matches found." : "No transcript lines yet."}
                </p>
                <p className="text-[10px] text-slate-600 max-w-[200px]">
                  {searchQuery ? "Try searching for a different word or speaker." : "Transcripts will appear here in real-time as participants start speaking."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                {filteredLines.map((line) => (
                  <div key={line.id} className="flex gap-2.5 bg-[#12131b] border border-slate-800/40 rounded-2xl p-3.5 transition hover:border-slate-800">
                    {/* Circle Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${getSpeakerColor(line.speaker)}`}>
                      {getSpeakerInitials(line.speaker)}
                    </div>
                    {/* Body */}
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-extrabold text-white truncate max-w-[150px]">{line.speaker}</span>
                        <span className="text-[9px] text-slate-500 font-mono tracking-wider shrink-0">{line.timestamp}</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed font-normal whitespace-pre-wrap break-words">{line.text}</p>
                    </div>
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Live Chat Drawer */}
      {isChatOpen && (
        <div id="live-chat-drawer" className="absolute inset-x-0 bottom-0 md:relative md:inset-auto md:h-full md:w-[380px] md:rounded-2xl md:border md:border-slate-800/80 md:shadow-none md:animate-none z-40 bg-[#14151f] rounded-t-3xl border-t border-slate-800 shadow-[0_-8px_40px_rgba(0,0,0,0.5)] flex flex-col h-[75%] w-full animate-slide-up select-none">
          {/* Top Grab Bar / Handle */}
          <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto my-3 md:hidden"></div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 pb-2 border-b border-slate-800/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400">
                <MessageSquare className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-base">In-Call Chat</h3>
                <p className="text-[10px] text-slate-400 font-medium truncate max-w-[180px]">{meetingTitle}</p>
              </div>
            </div>
            <button id="close-chat" onClick={() => setIsChatOpen(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-grow overflow-y-auto p-5 space-y-4">
            {roomChatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-10 gap-2 text-slate-500 text-center">
                <MessageSquare className="w-10 h-10 text-slate-600 mb-1" />
                <p className="text-xs font-semibold">No messages yet.</p>
                <p className="text-[10px] text-slate-600 max-w-[200px]">
                  Send a message to everyone in the call.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                {roomChatMessages.map((msg) => {
                  const isMe = msg.senderId === clientIdRef.current || msg.senderName === (userName || "Anonymous Guest") || msg.senderName === "You";
                  return (
                    <div key={msg.id} className={`flex flex-col max-w-[85%] ${isMe ? "self-end items-end" : "self-start items-start"}`}>
                      <div className="flex items-center gap-1.5 mb-1 text-[10px]">
                        <span className="font-bold text-slate-300">{msg.senderName}</span>
                        <span className="text-slate-500 font-mono">{msg.timestamp}</span>
                      </div>
                      <div className={`rounded-2xl px-4 py-2 text-xs leading-relaxed break-words text-left ${isMe ? "bg-blue-600 text-white rounded-tr-none" : "bg-[#1c1d29] text-slate-200 border border-slate-800/80 rounded-tl-none"}`}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chat Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (chatInputText.trim()) {
                sendChatMessage(chatInputText);
                setChatInputText("");
              }
            }}
            className="p-4 border-t border-slate-800/50 flex gap-2"
          >
            <input
              type="text"
              value={chatInputText}
              onChange={(e) => setChatInputText(e.target.value)}
              placeholder="Send a message..."
              className="flex-grow bg-[#1c1d29] border border-slate-800 rounded-full px-4 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 transition"
            />
            <button
              type="submit"
              disabled={!chatInputText.trim()}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-full shadow-md transition cursor-pointer"
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* Live People Drawer */}
      {isPeopleOpen && (
        <div id="live-people-drawer" className="absolute inset-x-0 bottom-0 md:relative md:inset-auto md:h-full md:w-[380px] md:rounded-2xl md:border md:border-slate-800/80 md:shadow-none md:animate-none z-40 bg-[#14151f] rounded-t-3xl border-t border-slate-800 shadow-[0_-8px_40px_rgba(0,0,0,0.5)] flex flex-col h-[75%] w-full animate-slide-up select-none">
          {/* Top Grab Bar / Handle */}
          <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto my-3 md:hidden"></div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 pb-2 border-b border-slate-800/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400">
                <Users className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-base">Participants</h3>
                <p className="text-[10px] text-slate-400 font-medium truncate max-w-[180px]">{meetingTitle}</p>
              </div>
            </div>
            <button id="close-people" onClick={() => setIsPeopleOpen(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Participants list */}
          <div className="flex-grow overflow-y-auto p-5 space-y-3">
            {/* Self */}
            <div className="flex items-center justify-between bg-[#12131b] border border-slate-800/40 rounded-2xl p-3.5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                  {userName ? getSpeakerInitials(userName) : "ME"}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-extrabold text-white truncate">{userName || "Anonymous Guest"} (You)</span>
                  <span className="text-[9px] text-slate-500 font-mono truncate">{userPhone || "Host"}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isHandRaised && <span className="text-xs animate-hand-wiggle">✋</span>}
                {isMuted ? <MicOff className="w-4 h-4 text-red-500 bg-red-500/10 p-0.5 rounded" /> : <Mic className="w-4 h-4 text-emerald-400 bg-emerald-400/10 p-0.5 rounded" />}
                {isCameraOn ? <VideoIcon className="w-4 h-4 text-emerald-400 bg-emerald-400/10 p-0.5 rounded" /> : <VideoOff className="w-4 h-4 text-red-500 bg-red-500/10 p-0.5 rounded" />}
              </div>
            </div>

            {/* Demo or Remote Participants */}
            {isDemo ? (
              demoParticipants.map((p) => (
                <div key={p.id} className="flex items-center justify-between bg-[#12131b] border border-slate-800/40 rounded-2xl p-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${p.color} flex items-center justify-center text-white text-xs font-bold`}>
                      {p.initials}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-extrabold text-white truncate">{p.name}</span>
                      <span className="text-[9px] text-slate-500 font-mono">Participant</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.isHandRaised && <span className="text-xs animate-hand-wiggle">✋</span>}
                    {p.isMuted ? <MicOff className="w-4 h-4 text-red-500 bg-red-500/10 p-0.5 rounded" /> : <Mic className="w-4 h-4 text-emerald-400 bg-emerald-400/10 p-0.5 rounded" />}
                    {p.isCameraOn ? <VideoIcon className="w-4 h-4 text-emerald-400 bg-emerald-400/10 p-0.5 rounded" /> : <VideoOff className="w-4 h-4 text-red-500 bg-red-500/10 p-0.5 rounded" />}
                  </div>
                </div>
              ))
            ) : (
              remoteParticipants.map((p) => (
                <div key={p.id} className="flex items-center justify-between bg-[#12131b] border border-slate-800/40 rounded-2xl p-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${getSpeakerColor(p.name)} flex items-center justify-center text-white text-xs font-bold`}>
                      {getSpeakerInitials(p.name)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-extrabold text-white truncate">{p.name}</span>
                      <span className="text-[9px] text-slate-500 font-mono truncate">{p.phone || "Participant"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.isHandRaised && <span className="text-xs animate-hand-wiggle">✋</span>}
                    {p.isMuted ? <MicOff className="w-4 h-4 text-red-500 bg-red-500/10 p-0.5 rounded" /> : <Mic className="w-4 h-4 text-emerald-400 bg-emerald-400/10 p-0.5 rounded" />}
                    {p.isCameraOn ? <VideoIcon className="w-4 h-4 text-emerald-400 bg-emerald-400/10 p-0.5 rounded" /> : <VideoOff className="w-4 h-4 text-red-500 bg-red-500/10 p-0.5 rounded" />}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Floating Emoji Reactions Overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
        {activeReactions.map((r) => (
          <div
            key={r.id}
            className="absolute bottom-20 left-1/2 transform -translate-x-1/2 text-4xl animate-float-up"
            style={{ "--float-x": `${r.x}px` } as React.CSSProperties}
          >
            {r.emoji}
          </div>
        ))}
      </div>
      {/* Saving / Compiling / AI Generating Overlay */}
      {isSaving && (
        <div id="ai-generating-overlay" className="absolute inset-0 z-50 bg-[#07080c]/90 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 animate-fade-in">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl animate-pulse"></div>
            <div className="w-16 h-16 rounded-full border-4 border-blue-600/30 border-t-blue-500 animate-spin flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-blue-400 animate-pulse" />
            </div>
          </div>
          <h3 className="text-lg font-extrabold text-white mb-2">Compiling Structured Minutes</h3>
          <p className="text-xs text-slate-400 max-w-[280px] leading-relaxed">
            AI is analyzing the transcript to identify key discussion points...
          </p>
          <div className="flex items-center gap-1.5 mt-4 text-[10px] text-slate-500 font-mono tracking-wider uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></span>
            Processing raw speech transcript
          </div>
        </div>
      )}

      {/* AI Generation Error Dialog */}
      {aiGenerationError && (
        <div id="ai-error-overlay" className="absolute inset-0 z-50 bg-[#07080c]/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#141522] border border-red-950 rounded-2xl p-6 max-w-md w-full shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#ea4335]"></div>

            <div className="flex gap-4 mb-5">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                <XCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-white">AI Summarization Error</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The AI API key might be missing, or there was a connection timeout.
                </p>
                <div className="bg-red-950/15 border border-red-900/20 rounded-lg p-2.5 mt-2">
                  <p className="text-[11px] font-mono text-red-300 break-all text-left">
                    Error Detail: {aiGenerationError}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <button
                onClick={() => {
                  setAiGenerationError(null);
                  playFeedbackSound("click");
                }}
                className="px-4 py-2 text-xs font-semibold rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              >
                Go Back
              </button>

              <button
                onClick={handleSaveLocalFallback}
                className="px-4 py-2 text-xs font-semibold rounded-full bg-amber-600/15 border border-amber-500/30 text-amber-400 hover:bg-amber-600/25 transition cursor-pointer"
              >
                Skip AI & Save Offline
              </button>

              <button
                onClick={handleLeaveCall}
                className="px-4 py-2 text-xs font-semibold rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/10 transition cursor-pointer flex items-center justify-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin-once" />
                Retry AI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
