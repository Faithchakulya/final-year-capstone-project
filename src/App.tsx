import React, { useState, useEffect } from "react";
import { Sparkles, Video, Mic, ArrowLeft, Play, X, User, Menu } from "lucide-react";
import { Meeting } from "./types";
import Home from "./components/Home";
import RegisterUser from "./components/RegisterUser";
import StartCall from "./components/StartCall";
import JoinModal from "./components/JoinModal";
import MeetingRoom from "./components/MeetingRoom";
import MeetingDetail from "./components/MeetingDetail";

// Helper to robustly extract meeting ID from any typed text/link
const extractMeetingId = (input: string): string => {
  const trimmed = input.trim();
  const patternMatch = trimmed.match(/[a-z]{3}-[a-z]{4}-[a-z]{3}/i);
  if (patternMatch) {
    return patternMatch[0].toLowerCase();
  }
  const lastSlashIndex = trimmed.lastIndexOf("/");
  if (lastSlashIndex !== -1) {
    return trimmed.substring(lastSlashIndex + 1).trim();
  }
  return trimmed;
};

export default function App() {
  const [currentView, setCurrentView] = useState<"home" | "register" | "start-call" | "meeting" | "detail">("home");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showStartChoice, setShowStartChoice] = useState(false);

  // User Profile details
  const [userName, setUserName] = useState(() => localStorage.getItem("user_name") || "");
  const [userPhone, setUserPhone] = useState(() => localStorage.getItem("user_phone") || "");

  // Active meeting configuration
  const [activeMeetingId, setActiveMeetingId] = useState("");
  const [activeMeetingTitle, setActiveMeetingTitle] = useState("");
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null);

  // API Config Status
  const [apiConfig, setApiConfig] = useState({ hasApiKey: false, message: "" });
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  // Fetch initial meetings and config from Express server
  useEffect(() => {
    const initData = async () => {
      try {
        const [configRes, meetingsRes] = await Promise.all([
          fetch("/api/config"),
          fetch("/api/meetings")
        ]);

        if (configRes.ok) {
          const config = await configRes.json();
          setApiConfig(config);
        }
        if (meetingsRes.ok) {
          const meetingsList = await meetingsRes.json();
          setMeetings(meetingsList);
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setIsLoadingConfig(false);
      }
    };

    initData();
  }, []);

  // Sync action items toggles on server
  const handleToggleActionItem = async (meetingId: string, task: string, completed: boolean) => {
    // Optimistic Update
    setMeetings((prev) =>
      prev.map((m) => {
        if (m.id === meetingId) {
          const updatedActions = m.actionItems.map((act) =>
            act.task === task ? { ...act, completed } : act
          );
          return { ...m, actionItems: updatedActions };
        }
        return m;
      })
    );

    if (selectedMeeting && selectedMeeting.id === meetingId) {
      setSelectedMeeting((prev) => {
        if (!prev) return null;
        const updatedActions = prev.actionItems.map((act) =>
          act.task === task ? { ...act, completed } : act
        );
        return { ...prev, actionItems: updatedActions };
      });
    }

    try {
      await fetch(`/api/meetings/${meetingId}/actions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, completed })
      });
    } catch (err) {
      console.error("Failed to sync action item completed state on server:", err);
    }
  };

  // Delete a meeting
  const handleDeleteMeeting = async (id: string) => {
    // Optimistic Update
    setMeetings((prev) => prev.filter((m) => m.id !== id));
    try {
      await fetch(`/api/meetings/${id}`, {
        method: "DELETE"
      });
    } catch (err) {
      console.error("Failed to delete meeting:", err);
    }
  };

  // Helper to generate a Google-Meet-style random letters ID (e.g. xhe-xual-fta)
  const generateMeetingId = () => {
    const gen = (len: number) =>
      Array.from({ length: len }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("");
    return `${gen(3)}-${gen(4)}-${gen(3)}`;
  };

  // Helper to generate standard titles
  const getRandomTitle = () => {
    const titles = ["Sprint Sync", "Product Alignment", "Design Review", "Engineering Sync", "Strategy Session", "Tech Sync", "Team Huddle"];
    return titles[Math.floor(Math.random() * titles.length)];
  };

  // Trigger starting a new meeting
  const handleStartNewMeeting = () => {
    const code = generateMeetingId();
    const title = `Meeting ${meetings.length + 1}`;
    setActiveMeetingId(code);
    setActiveMeetingTitle(title);
    setCurrentView("register");
  };

  // Continue after registering name/phone
  const handleRegisterContinue = (name: string, phone: string) => {
    setUserName(name);
    setUserPhone(phone);
    localStorage.setItem("user_name", name);
    localStorage.setItem("user_phone", phone);
    if (pendingJoinCode) {
      setActiveMeetingId(pendingJoinCode);
      setActiveMeetingTitle(`Meeting ${meetings.length + 1}`);
      setIsDemoMode(false);
      setPendingJoinCode(null);
      setCurrentView("meeting");
    } else {
      setCurrentView("start-call");
    }
  };

  // Trigger from code/link search bar
  const handleJoinByCode = (code: string) => {
    // Clean up code/link
    const cleanCode = extractMeetingId(code);
    setActiveMeetingId(cleanCode || generateMeetingId());
    setActiveMeetingTitle(`Meeting ${meetings.length + 1}`);
    setIsDemoMode(false);
    if (!userName) {
      setPendingJoinCode(cleanCode || generateMeetingId());
      setCurrentView("register");
    } else {
      setCurrentView("meeting");
    }
  };

  // Click on "Create Link"
  const handleCreateLink = () => {
    setShowJoinModal(true);
  };

  // Click on "Instant Call" / "Group Call" or sugersted user
  const handleInstantCall = () => {
    setShowStartChoice(true);
  };

  // Finish Choice Dialog and Start Meeting Room
  const handleConfirmStartMeeting = (demo: boolean) => {
    setIsDemoMode(demo);
    setShowStartChoice(false);
    setShowJoinModal(false);
    setCurrentView("meeting");
  };

  // Left meeting with finalized AI minutes generated
  const handleLeaveMeeting = (finalMeeting: Meeting) => {
    setMeetings((prev) => [finalMeeting, ...prev]);
    setCurrentView("home");
  };

  return (
    <div id="app-container" className="min-h-screen bg-[#07080b] flex flex-col items-center justify-center p-0.5 sm:p-2 md:p-3">
      {/* Clean borderless responsive container layout */}
      <div className="w-full max-w-[1360px] h-screen md:h-[880px] md:max-h-[96vh] bg-[#0d0e12] md:rounded-3xl shadow-2xl overflow-hidden flex flex-col relative md:border md:border-slate-800/40">
        {/* PRIMARY VIEW ROUTER */}
        {currentView === "home" && (
          <Home
            meetings={meetings}
            onStartNew={handleStartNewMeeting}
            onJoinCode={handleJoinByCode}
            onViewMeeting={(meeting) => {
              setSelectedMeeting(meeting);
              setCurrentView("detail");
            }}
            onDeleteMeeting={handleDeleteMeeting}
            apiConfig={apiConfig}
          />
        )}

        {currentView === "start-call" && (
          <StartCall
            onClose={() => setCurrentView("home")}
            onCreateLink={handleCreateLink}
            onInstantMeeting={handleInstantCall}
          />
        )}

        {currentView === "register" && (
          <RegisterUser
            onClose={() => setCurrentView("home")}
            onContinue={handleRegisterContinue}
            initialName={userName}
            initialPhone={userPhone}
          />
        )}

        {currentView === "meeting" && (
          <MeetingRoom
            meetingId={activeMeetingId}
            meetingTitle={activeMeetingTitle}
            isDemo={isDemoMode}
            onLeave={handleLeaveMeeting}
            onCancel={() => setCurrentView("home")}
            userName={userName}
            userPhone={userPhone}
          />
        )}

        {currentView === "detail" && selectedMeeting && (
          <MeetingDetail
            meeting={selectedMeeting}
            onBack={() => setCurrentView("home")}
            onToggleActionItem={handleToggleActionItem}
          />
        )}

        {/* JOIN MEETING MODAL */}
        {showJoinModal && (
          <JoinModal
            meetingCode={activeMeetingId}
            onClose={() => setShowJoinModal(false)}
            onJoin={handleInstantCall}
          />
        )}

        {/* MEETING ENGINE CHOICE MODAL */}
        {showStartChoice && (
          <div id="choice-overlay" className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs px-5 overflow-hidden">
            <div className="bg-[#1c1d29] border border-slate-800/80 rounded-3xl p-5 w-full max-w-sm shadow-2xl relative animate-scale-in">
              <button
                onClick={() => setShowStartChoice(false)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4.5 h-4.5" />
              </button>

              <div className="flex flex-col items-center text-center mt-1 mb-5">
                <div className="w-11 h-11 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-400 mb-2.5">
                  <Sparkles className="w-5 h-5 text-blue-400 animate-pulse" />
                </div>
                <h3 className="text-sm font-bold text-white">Choose Meeting Mode</h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-normal px-1">
                  Select how you would like to run this AI minutes taker session.
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                {/* Option A: Live Microphone */}
                <button
                  onClick={() => handleConfirmStartMeeting(false)}
                  className="flex items-center gap-3 text-left bg-[#102422] hover:bg-[#163330] border border-teal-500/20 p-3 rounded-2xl transition active:scale-[0.98] cursor-pointer group shadow-lg"
                >
                  <div className="w-9 h-9 rounded-full bg-teal-600/15 flex items-center justify-center text-teal-400 shrink-0 group-hover:bg-teal-600 group-hover:text-white transition">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-grow">
                    <h4 className="text-[11px] font-bold text-teal-300 group-hover:text-white flex items-center gap-1.5">
                      Live Microphone Mode
                      <span className="text-[8px] bg-teal-500/20 text-teal-400 px-1.5 py-0.2 rounded-full font-semibold uppercase tracking-wider scale-90">Default</span>
                    </h4>
                    <p className="text-[9px] text-slate-400 mt-0.5 leading-tight truncate">
                      Real voice transcription, summarized by {apiConfig.message.includes("Groq") ? "Groq" : "Gemini"}.
                    </p>
                  </div>
                </button>

                {/* Option B: Simulated Demo */}
                <button
                  onClick={() => handleConfirmStartMeeting(true)}
                  className="flex items-center gap-3 text-left bg-[#221f3b]/60 hover:bg-[#2b274c] border border-indigo-500/5 p-3 rounded-2xl transition active:scale-[0.98] cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-full bg-indigo-600/15 flex items-center justify-center text-indigo-400 shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition">
                    <Play className="w-4 h-4 fill-current" />
                  </div>
                  <div className="min-w-0 flex-grow">
                    <h4 className="text-[11px] font-bold text-indigo-300 group-hover:text-white">Simulated Team Demo</h4>
                    <p className="text-[9px] text-slate-400 mt-0.5 leading-tight truncate">
                      Lively sync simulation with Sarah, Marcus, Emily.
                    </p>
                  </div>
                </button>
              </div>

              <p className="text-[8px] text-slate-500 text-center mt-5">
                Both modes generate structured summaries, actions & decisions.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
