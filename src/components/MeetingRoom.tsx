import React, { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Hand,
  Info,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  Search,
  Smile,
  Sparkles,
  Users,
  Video as VideoIcon,
  VideoOff,
  Volume2,
  X,
  XCircle,
} from "lucide-react";
import { ActionItem, Meeting, RoomChatMessage, TranscriptLine } from "../types";
import { avatarColor, clockTime, formatDuration, initials, meetingLink, randomId } from "../lib/meeting";
import { playSound, SoundType } from "../lib/sounds";
import { useLocalMedia } from "../hooks/useLocalMedia";
import { useRoomSocket } from "../hooks/useRoomSocket";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { SignalMessage, usePeerConnections } from "../hooks/usePeerConnections";
import AskAI from "./AskAI";
import Drawer from "./Drawer";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

type Panel = "ai" | "transcript" | "chat" | "people" | null;

interface Minutes {
  summary: string;
  topicsCovered: string[];
  actionItems: ActionItem[];
  decisions: string[];
  peoplePresent: string[];
  discussion: string;
}

interface MeetingRoomProps {
  meetingId: string;
  meetingTitle: string;
  userName: string;
  userPhone: string;
  onLeave: (meeting: Meeting) => void;
  onCancel: () => void;
}

function VideoView({ stream, mirrored = false }: { stream: MediaStream; mirrored?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  // Always muted: sound is played by RemoteAudio so it keeps going when the video is hidden.
  return <video ref={ref} autoPlay playsInline muted className={`w-full h-full object-cover ${mirrored ? "scale-x-[-1]" : ""}`} />;
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay />;
}

const hasLiveVideo = (stream?: MediaStream) =>
  Boolean(stream?.getVideoTracks().some((t) => t.readyState === "live" && !t.muted));

interface TileProps {
  name: string;
  label: string;
  isMuted: boolean;
  isCameraOn: boolean;
  isHandRaised: boolean;
  isSpeaking: boolean;
  reaction?: string;
  levels?: number[] | null;
  video?: MediaStream | null;
}

function ParticipantTile({ name, label, isMuted, isCameraOn, isHandRaised, isSpeaking, reaction, levels, video }: TileProps) {
  return (
    <div
      className={`bg-[#11121b] border rounded-2xl p-3 flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[90px] ${
        isSpeaking ? "border-emerald-500/60" : "border-slate-900"
      }`}
    >
      {video && isCameraOn && (
        <div className="absolute inset-0 bg-black">
          <VideoView stream={video} />
        </div>
      )}
      <div className={`relative mb-1 ${video && isCameraOn ? "invisible" : ""}`}>
        <div className={`w-11 h-11 rounded-full ${avatarColor(name)} flex items-center justify-center text-white text-sm font-bold`}>
          {initials(name)}
        </div>
        {isCameraOn && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#11121b] rounded-full" title="Camera on" />
        )}
      </div>
      <span className="relative text-[10px] font-semibold text-slate-300 bg-slate-950/70 px-1.5 py-0.5 rounded-md mt-auto truncate max-w-[90px]" title={label}>
        {label}
      </span>
      {isMuted && <MicOff className="w-3 h-3 text-red-400 absolute top-2 right-2 bg-slate-950/80 p-0.5 rounded-full" />}
      {isHandRaised && <span className="absolute top-2 left-2 text-xs animate-hand-wiggle" title="Hand raised">✋</span>}
      {reaction && (
        <div className="absolute inset-0 bg-slate-950/75 flex items-center justify-center animate-scale-in">
          <span className="text-2xl animate-bounce">{reaction}</span>
        </div>
      )}
      {isSpeaking && !isMuted && levels && (
        <div className="flex items-end gap-0.5 h-4 absolute bottom-2 left-2 bg-slate-950/60 p-1 rounded-md">
          {levels.slice(0, 3).map((h, i) => (
            <span key={i} className="w-0.5 bg-blue-400 rounded-full transition-all duration-150" style={{ height: `${h}%` }} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatusIcons({ isMuted, isCameraOn, isHandRaised }: { isMuted: boolean; isCameraOn: boolean; isHandRaised: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {isHandRaised && <span className="text-xs">✋</span>}
      {isMuted ? <MicOff className="w-4 h-4 text-red-500" /> : <Mic className="w-4 h-4 text-emerald-400" />}
      {isCameraOn ? <VideoIcon className="w-4 h-4 text-emerald-400" /> : <VideoOff className="w-4 h-4 text-red-500" />}
    </div>
  );
}

export default function MeetingRoom({ meetingId, meetingTitle, userName, userPhone, onLeave, onCancel }: MeetingRoomProps) {
  const displayName = userName || "Guest";
  const clientId = useRef(randomId()).current;
  // Everyone who was in the room at some point, for the saved minutes.
  const attendees = useRef(new Set<string>([displayName]));

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isSubtitleVisible, setIsSubtitleVisible] = useState(true);
  const [duration, setDuration] = useState(0);
  const [activeSpeaker, setActiveSpeaker] = useState(displayName);
  const [subtitle, setSubtitle] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<{ id: string; emoji: string; x: number }[]>([]);
  const [tileReactions, setTileReactions] = useState<Record<string, string>>({});
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const [chatMessages, setChatMessages] = useState<RoomChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState<"link" | "transcript" | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const transcriptListRef = useRef<HTMLDivElement>(null);

  const sound = (type: SoundType) => {
    if (isSoundEnabled) playSound(type);
  };

  const showReaction = (emoji: string, senderName: string) => {
    const id = randomId();
    setFloatingReactions((prev) => [...prev, { id, emoji, x: Math.floor(Math.random() * 80) - 40 }]);
    setTileReactions((prev) => ({ ...prev, [senderName]: emoji }));
    setTimeout(() => setFloatingReactions((prev) => prev.filter((r) => r.id !== id)), 2000);
    setTimeout(
      () =>
        setTileReactions((prev) => {
          const next = { ...prev };
          delete next[senderName];
          return next;
        }),
      3000
    );
  };

  const addTranscriptLine = (line: TranscriptLine) => {
    setTranscriptLines((prev) => [...prev, line]);
    setActiveSpeaker(line.speaker);
    setSubtitle(line.text);
  };

  const room = useRoomSocket(
    meetingId,
    { id: clientId, name: displayName, phone: userPhone, isMuted, isCameraOn },
    {
      onTranscriptLine: addTranscriptLine,
      onReaction: showReaction,
      onChatMessage: (message) => setChatMessages((prev) => [...prev, message]),
      onSignal: (message) => handleSignalRef.current?.(message),
    }
  );

  const media = useLocalMedia(isMuted, isCameraOn);

  const handleSignalRef = useRef<(message: SignalMessage) => void>(undefined);
  const calls = usePeerConnections(clientId, room.remoteParticipants, media.stream, (to, data) =>
    room.send({ type: "signal", to, data })
  );
  handleSignalRef.current = calls.handleSignal;

  const speech = useSpeechRecognition(!isMuted && !isSaving, {
    onInterim: (text) => {
      setActiveSpeaker(displayName);
      setSubtitle(text);
    },
    onFinal: (text) => {
      const line = { id: randomId(), speaker: displayName, text, timestamp: clockTime() };
      addTranscriptLine(line);
      room.send({ type: "transcript-line", line });
    },
  });

  useEffect(() => {
    room.remoteParticipants.forEach((p) => attendees.current.add(p.name));
  }, [room.remoteParticipants]);

  useEffect(() => {
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    const chime = setTimeout(() => playSound("join"), 400);
    return () => {
      clearInterval(timer);
      clearTimeout(chime);
    };
  }, []);

  useEffect(() => {
    const list = transcriptListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [transcriptLines, panel]);

  const togglePanel = (next: Panel) => {
    setPanel((current) => (current === next ? null : next));
    sound("click");
  };

  const toggleMute = () => {
    sound(isMuted ? "unmute" : "mute");
    setIsMuted(!isMuted);
  };

  const toggleCamera = () => {
    sound("click");
    setIsCameraOn(!isCameraOn);
  };

  const toggleHand = () => {
    sound("click");
    setIsHandRaised(!isHandRaised);
    room.send({ type: "raise-hand", isHandRaised: !isHandRaised });
  };

  const sendReaction = (emoji: string) => {
    showReaction(emoji, displayName);
    room.send({ type: "reaction", senderName: displayName, reaction: emoji });
    setShowEmojiPicker(false);
  };

  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    const message: RoomChatMessage = { id: randomId(), senderId: clientId, senderName: displayName, text, timestamp: clockTime() };
    setChatMessages((prev) => [...prev, message]);
    room.send({ type: "chat-message", message });
    setChatInput("");
  };

  const copyText = async (text: string, what: "link" | "transcript") => {
    await navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  const transcriptText = transcriptLines.map((l) => `${l.speaker}: ${l.text}`).join("\n");

  const buildMeeting = (minutes?: Partial<Minutes>): Meeting => {
    const people = Array.from(
      new Set([...attendees.current, ...(minutes?.peoplePresent ?? [])].map((n) => n.trim()).filter(Boolean))
    );
    return {
      id: `${meetingId}-${Date.now().toString(36)}`,
      title: meetingTitle,
      date: new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" }),
      createdAt: new Date().toISOString(),
      participantsCount: people.length,
      duration: formatDuration(duration),
      transcript: transcriptLines,
      summary: minutes?.summary ?? "",
      topicsCovered: minutes?.topicsCovered ?? [],
      actionItems: minutes?.actionItems ?? [],
      decisions: minutes?.decisions ?? [],
      peoplePresent: people,
      discussion: minutes?.discussion ?? "",
    };
  };

  const saveMeeting = async (meeting: Meeting) => {
    try {
      await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(meeting),
      });
    } catch (err) {
      console.error("Failed to save meeting:", err);
    }
    onLeave(meeting);
  };

  const handleLeave = async () => {
    sound("leave");
    setSaveError(null);
    if (transcriptLines.length === 0) {
      setSaveError("Nothing was transcribed in this meeting, so there is nothing to summarise.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptText, title: meetingTitle }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Summarization failed.");
      await saveMeeting(buildMeeting(data));
    } catch (err: any) {
      setSaveError(err.message || "Summarization failed.");
      setIsSaving(false);
    }
  };

  const handleSaveWithoutSummary = async () => {
    setSaveError(null);
    setIsSaving(true);
    await saveMeeting(buildMeeting());
  };

  const filteredLines = transcriptLines.filter((line) => {
    const q = searchQuery.toLowerCase().trim();
    return !q || line.speaker.toLowerCase().includes(q) || line.text.toLowerCase().includes(q);
  });

  const participantCount = room.remoteParticipants.length + 1;
  const isSelfSpeaking = activeSpeaker === displayName;
  const remoteSpeaker = room.remoteParticipants.find((p) => p.name === activeSpeaker);
  const remoteSpeakerStream = remoteSpeaker ? calls.remoteStreams[remoteSpeaker.id] : undefined;
  const stageVideo = isSelfSpeaking
    ? isCameraOn && media.hasVideo ? media.stream : null
    : remoteSpeaker?.isCameraOn && hasLiveVideo(remoteSpeakerStream) ? remoteSpeakerStream! : null;
  const recognitionError = speech.error || media.error;

  const roundButton = (size: "sm" | "lg", active: boolean, danger: boolean) =>
    `${size === "lg" ? "w-12 h-12" : "w-11 h-11"} rounded-full flex items-center justify-center border transition active:scale-95 cursor-pointer shrink-0 ${
      danger
        ? "bg-red-600/15 border-red-500/40 text-red-500 hover:bg-red-600/30"
        : active
          ? "bg-amber-600/20 border-amber-500/40 text-amber-400"
          : "bg-[#181924] border-slate-800 text-slate-200 hover:bg-slate-800"
    }`;

  const renderCallControls = (size: "sm" | "lg") => (
    <>
      <button onClick={toggleMute} className={roundButton(size, false, isMuted)} title={isMuted ? "Unmute" : "Mute"}>
        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>
      <button onClick={toggleCamera} className={roundButton(size, false, !isCameraOn)} title={isCameraOn ? "Turn camera off" : "Turn camera on"}>
        {isCameraOn ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
      </button>
      <div className="relative">
        <button
          onClick={() => {
            setShowEmojiPicker(!showEmojiPicker);
            sound("click");
          }}
          className={roundButton(size, showEmojiPicker, false)}
          title="Send a reaction"
        >
          <Smile className="w-5 h-5" />
        </button>
        {showEmojiPicker && (
          <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-[#141520] border border-slate-800 rounded-full px-3 py-1.5 flex items-center gap-2.5 shadow-2xl z-50 animate-scale-in">
            {EMOJIS.map((emoji) => (
              <button key={emoji} onClick={() => sendReaction(emoji)} className="text-xl hover:scale-125 transition cursor-pointer">
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
      <button onClick={toggleHand} className={roundButton(size, isHandRaised, false)} title={isHandRaised ? "Lower hand" : "Raise hand"}>
        <Hand className="w-5 h-5" style={{ fill: isHandRaised ? "currentColor" : "none" }} />
      </button>
      <button
        onClick={handleLeave}
        disabled={isSaving}
        className={`${size === "lg" ? "w-12 h-12" : "w-11 h-11"} rounded-full bg-[#ea4335] hover:bg-red-600 text-white flex items-center justify-center transition active:scale-95 shrink-0 cursor-pointer`}
        title="Leave and save minutes"
      >
        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <PhoneOff className="w-5 h-5" />}
      </button>
    </>
  );

  const panelButton = (target: Exclude<Panel, null>, icon: React.ReactNode, label: string, badge?: number) => (
    <button
      onClick={() => togglePanel(target)}
      className={`flex flex-col items-center gap-1 transition relative cursor-pointer shrink-0 ${
        panel === target ? "text-blue-400" : "text-slate-400 hover:text-white"
      }`}
    >
      {icon}
      <span className="text-[9px] font-medium uppercase tracking-wider">{label}</span>
      {badge !== undefined && (
        <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );

  const panelButtons = (
    <>
      {panelButton("chat", <MessageSquare className="w-5 h-5" />, "Chat")}
      {panelButton("people", <Users className="w-5 h-5" />, "People", participantCount)}
      {panelButton("transcript", <FileText className="w-5 h-5" />, "Transcript")}
      {panelButton("ai", <Sparkles className="w-5 h-5" />, "Ask AI")}
    </>
  );

  return (
    <div
      className={`flex h-full w-full bg-[#090a0f] text-slate-200 p-2.5 sm:p-4 relative md:overflow-hidden md:pb-5 pb-28 ${
        panel ? "flex-col md:flex-row md:gap-4" : "flex-col overflow-y-auto"
      }`}
    >
      <div className={`flex flex-col flex-grow ${panel ? "w-full md:w-0 md:overflow-y-auto" : "h-full w-full md:h-0 md:min-h-0"}`}>
        <div className="flex items-center justify-between mt-2 mb-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white truncate max-w-[200px]">{meetingTitle}</h2>
            <p className="text-[10px] text-slate-500 font-mono">{meetingId}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-[#1b1c27] border border-slate-800 rounded-full px-3.5 py-1 text-xs text-slate-300 font-mono">
              {formatDuration(duration)}
            </span>
            <button
              onClick={() => setShowInfo(true)}
              className="p-2 text-slate-500 hover:text-white rounded-lg transition cursor-pointer"
              title="Meeting details"
            >
              <Info className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-grow flex flex-col md:grid md:grid-cols-12 md:gap-4 md:min-h-0 md:overflow-hidden">
          <div className="flex flex-col flex-grow md:col-span-8 md:h-full md:min-h-0">
            <div className="flex-grow flex flex-col items-center justify-center relative mb-4 md:mb-0 bg-[#11121b] border border-slate-900 rounded-2xl overflow-hidden min-h-[280px] pt-6 pb-24">
              {stageVideo ? (
                <div className="absolute inset-0 bg-black">
                  <VideoView stream={stageVideo} mirrored={isSelfSpeaking} />
                </div>
              ) : (
                <div className="relative mb-6">
                  <div
                    className={`w-24 h-24 sm:w-32 sm:h-32 rounded-full ${avatarColor(activeSpeaker)} flex items-center justify-center text-3xl sm:text-4xl font-bold text-white border-4 border-slate-900`}
                  >
                    {initials(activeSpeaker)}
                  </div>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#1c1e2d] border border-slate-800 rounded-full px-3 py-0.5 text-[9px] font-semibold text-emerald-400 whitespace-nowrap">
                    {activeSpeaker}
                  </div>
                </div>
              )}

              {isSubtitleVisible ? (
                <div className="absolute bottom-4 inset-x-4 bg-slate-950/85 backdrop-blur-md rounded-xl p-3 border border-slate-800/80 min-h-[60px] flex flex-col justify-center group">
                  <button
                    onClick={() => setIsSubtitleVisible(false)}
                    className="absolute top-2.5 right-2.5 p-1 text-slate-400 hover:text-white rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                    title="Hide captions"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                  </button>
                  {subtitle ? (
                    <>
                      <p className="text-[10px] text-emerald-400 font-bold uppercase mb-1 pr-6">{activeSpeaker}</p>
                      <p className="text-xs text-white leading-relaxed pr-6">{subtitle}</p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">{isMuted ? "You are muted." : "Captions will appear when someone speaks."}</p>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setIsSubtitleVisible(true)}
                  className="absolute bottom-4 right-4 bg-slate-950/85 border border-slate-800/80 rounded-full px-3 py-1.5 text-[10px] font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  Show captions
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3.5 md:col-span-4 md:h-full md:overflow-y-auto shrink-0 pb-6 md:pb-2">
            {recognitionError && (
              <div className="bg-red-950/30 border border-red-900/40 text-red-300 rounded-xl p-2.5 text-[10px] leading-relaxed">
                {recognitionError}
              </div>
            )}

            <div className="hidden md:flex items-center justify-between px-1 text-[10px] text-slate-500">
              <span className="uppercase font-bold tracking-wider">Participants</span>
              <span className="font-mono">{participantCount} in call</span>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-2 gap-2.5">
              <ParticipantTile
                name={displayName}
                label={`${displayName} (you)`}
                isMuted={isMuted}
                isCameraOn={isCameraOn}
                isHandRaised={isHandRaised}
                isSpeaking={isSelfSpeaking}
                reaction={tileReactions[displayName]}
                levels={media.audioLevels}
              />
              {room.remoteParticipants.map((p) => (
                <ParticipantTile
                  key={p.id}
                  name={p.name}
                  label={p.name}
                  isMuted={p.isMuted}
                  isCameraOn={p.isCameraOn}
                  isHandRaised={p.isHandRaised}
                  isSpeaking={activeSpeaker === p.name}
                  reaction={tileReactions[p.name]}
                  video={hasLiveVideo(calls.remoteStreams[p.id]) ? calls.remoteStreams[p.id] : null}
                />
              ))}
            </div>
            {Object.entries(calls.remoteStreams).map(([id, stream]) => (
              <RemoteAudio key={id} stream={stream} />
            ))}

            <div className="md:hidden flex flex-col gap-3 mt-2 shrink-0">
              <div className="flex items-center justify-around bg-[#13141f] border border-slate-900 rounded-2xl py-3 px-4">
                {panelButtons}
              </div>
              <div className="flex items-center justify-center gap-4 py-2">{renderCallControls("sm")}</div>
            </div>
          </div>
        </div>

        <div className="hidden md:flex flex-wrap items-center justify-between gap-x-6 gap-y-3 bg-[#11121b] border border-slate-800/85 rounded-2xl px-6 py-3.5 mt-4 shrink-0">
          <div className="flex items-center gap-4">{renderCallControls("lg")}</div>
          <div className="flex items-center gap-5">
            <button
              onClick={() => {
                setIsSoundEnabled(!isSoundEnabled);
                if (!isSoundEnabled) playSound("click");
              }}
              className={`flex flex-col items-center gap-1 transition cursor-pointer shrink-0 ${
                isSoundEnabled ? "text-emerald-400" : "text-slate-500 hover:text-white"
              }`}
              title="Toggle sound effects"
            >
              <Volume2 className="w-5 h-5" />
              <span className="text-[9px] font-medium uppercase tracking-wider">{isSoundEnabled ? "Sound on" : "Sound off"}</span>
            </button>
            {panelButtons}
          </div>
        </div>
      </div>

      {panel === "ai" && (
        <Drawer title="Ask AI" subtitle={meetingTitle} icon={<Sparkles className="w-4 h-4" />} onClose={() => setPanel(null)}>
          <AskAI transcript={transcriptText} />
        </Drawer>
      )}

      {panel === "transcript" && (
        <Drawer title="Transcript" subtitle={meetingTitle} icon={<FileText className="w-4 h-4" />} onClose={() => setPanel(null)}>
          <div className="px-5 py-3 border-b border-slate-800/40 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">
                {filteredLines.length} line{filteredLines.length !== 1 && "s"}
              </span>
              <button
                onClick={() =>
                  copyText(transcriptLines.map((l) => `[${l.timestamp}] ${l.speaker}: ${l.text}`).join("\n"), "transcript")
                }
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-[11px] font-semibold cursor-pointer"
              >
                {copied === "transcript" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === "transcript" ? "Copied" : "Copy all"}
              </button>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search transcript"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1c1d29] border border-slate-800 rounded-full pl-9 pr-8 py-1.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <div ref={transcriptListRef} className="flex-grow min-h-0 overflow-y-auto p-5 flex flex-col gap-3.5">
            {filteredLines.length === 0 ? (
              <p className="text-xs text-slate-500 text-center my-auto">
                {searchQuery ? "No matches." : "Nothing has been transcribed yet."}
              </p>
            ) : (
              filteredLines.map((line) => (
                <div key={line.id} className="flex gap-2.5 bg-[#12131b] border border-slate-800/40 rounded-2xl p-3.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${avatarColor(line.speaker)}`}>
                    {initials(line.speaker)}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-white truncate">{line.speaker}</span>
                      <span className="text-[9px] text-slate-500 font-mono shrink-0">{line.timestamp}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed break-words">{line.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Drawer>
      )}

      {panel === "chat" && (
        <Drawer title="Chat" subtitle={meetingTitle} icon={<MessageSquare className="w-4 h-4" />} onClose={() => setPanel(null)}>
          <div className="flex-grow min-h-0 overflow-y-auto p-5 flex flex-col gap-3.5">
            {chatMessages.length === 0 ? (
              <p className="text-xs text-slate-500 text-center my-auto">No messages yet.</p>
            ) : (
              chatMessages.map((msg) => {
                const isMe = msg.senderId === clientId;
                return (
                  <div key={msg.id} className={`flex flex-col max-w-[85%] ${isMe ? "self-end items-end" : "self-start items-start"}`}>
                    <div className="flex items-center gap-1.5 mb-1 text-[10px]">
                      <span className="font-bold text-slate-300">{msg.senderName}</span>
                      <span className="text-slate-500 font-mono">{msg.timestamp}</span>
                    </div>
                    <div
                      className={`rounded-2xl px-4 py-2 text-xs leading-relaxed break-words ${
                        isMe ? "bg-blue-600 text-white rounded-tr-none" : "bg-[#1c1d29] text-slate-200 border border-slate-800/80 rounded-tl-none"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <form onSubmit={sendChatMessage} className="p-4 border-t border-slate-800/50 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Message everyone"
              className="flex-grow bg-[#1c1d29] border border-slate-800 rounded-full px-4 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs rounded-full cursor-pointer"
            >
              Send
            </button>
          </form>
        </Drawer>
      )}

      {panel === "people" && (
        <Drawer title="People" subtitle={`${participantCount} in call`} icon={<Users className="w-4 h-4" />} onClose={() => setPanel(null)}>
          <div className="flex-grow min-h-0 overflow-y-auto p-5 space-y-3">
            {[
              { id: clientId, name: displayName, phone: userPhone, isMuted, isCameraOn, isHandRaised, isSelf: true },
              ...room.remoteParticipants.map((p) => ({ ...p, isSelf: false })),
            ].map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-[#12131b] border border-slate-800/40 rounded-2xl p-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-full ${avatarColor(p.name)} flex items-center justify-center text-white text-xs font-bold`}>
                    {initials(p.name)}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-white truncate">
                      {p.name}
                      {p.isSelf && " (you)"}
                    </span>
                    {p.phone && <span className="text-[9px] text-slate-500 font-mono truncate">{p.phone}</span>}
                  </div>
                </div>
                <StatusIcons isMuted={p.isMuted} isCameraOn={p.isCameraOn} isHandRaised={p.isHandRaised} />
              </div>
            ))}
          </div>
        </Drawer>
      )}

      <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
        {floatingReactions.map((r) => (
          <div
            key={r.id}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 text-4xl animate-float-up"
            style={{ "--float-x": `${r.x}px` } as React.CSSProperties}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {showInfo && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="bg-[#1c1d29] border border-slate-800 rounded-3xl p-5 w-full max-w-sm relative animate-scale-in">
            <button
              onClick={() => setShowInfo(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-bold text-white mb-4">Meeting details</h3>
            <dl className="bg-[#12131d] border border-slate-900 rounded-2xl p-3.5 space-y-3 text-xs">
              <div>
                <dt className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Title</dt>
                <dd className="font-semibold text-slate-200">{meetingTitle}</dd>
              </div>
              <div>
                <dt className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Invite link</dt>
                <dd className="flex items-center gap-2">
                  <span className="font-mono text-blue-400 truncate select-all">{meetingLink(meetingId)}</span>
                  <button onClick={() => copyText(meetingLink(meetingId), "link")} className="text-slate-400 hover:text-white cursor-pointer shrink-0">
                    {copied === "link" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </dd>
              </div>
              <div>
                <dt className="text-[9px] uppercase tracking-wider font-bold text-slate-500">You</dt>
                <dd className="font-semibold text-slate-200">
                  {displayName}
                  {userPhone && <span className="text-slate-400 font-mono font-normal"> · {userPhone}</span>}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {isSaving && (
        <div className="absolute inset-0 z-50 bg-[#07080c]/90 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 animate-fade-in">
          <Loader2 className="w-10 h-10 text-blue-400 animate-spin mb-4" />
          <h3 className="text-base font-bold text-white mb-1">Writing up the minutes</h3>
          <p className="text-xs text-slate-400">Summarising the transcript. This usually takes a few seconds.</p>
        </div>
      )}

      {saveError && (
        <div className="absolute inset-0 z-50 bg-[#07080c]/95 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#141522] border border-red-950 rounded-2xl p-6 max-w-md w-full">
            <div className="flex gap-4 mb-5">
              <XCircle className="w-8 h-8 text-red-400 shrink-0" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  {transcriptLines.length === 0 ? "Nothing to save" : "Couldn't create a summary"}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed break-words">{saveError}</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <button
                onClick={() => setSaveError(null)}
                className="px-4 py-2 text-xs font-semibold rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                Back to meeting
              </button>
              {transcriptLines.length === 0 ? (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 text-xs font-semibold rounded-full bg-red-600 hover:bg-red-500 text-white cursor-pointer"
                >
                  Leave without saving
                </button>
              ) : (
                <>
                  <button
                    onClick={handleSaveWithoutSummary}
                    className="px-4 py-2 text-xs font-semibold rounded-full bg-amber-600/15 border border-amber-500/30 text-amber-400 hover:bg-amber-600/25 cursor-pointer"
                  >
                    Save without summary
                  </button>
                  <button
                    onClick={handleLeave}
                    className="px-4 py-2 text-xs font-semibold rounded-full bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
                  >
                    Try again
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
