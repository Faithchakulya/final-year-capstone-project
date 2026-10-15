import React, { useState, useEffect } from "react";
import { Menu, Search, Keyboard, Video, ChevronRight, Clock, Plus, Trash2, User } from "lucide-react";
import { Meeting } from "../types";

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

interface HomeProps {
  meetings: Meeting[];
  onStartNew: () => void;
  onJoinCode: (code: string) => void;
  onViewMeeting: (meeting: Meeting) => void;
  onDeleteMeeting: (id: string) => void;
  apiConfig: { hasApiKey: boolean; message: string };
}

export default function Home({
  meetings,
  onStartNew,
  onJoinCode,
  onViewMeeting,
  onDeleteMeeting,
  apiConfig
}: HomeProps) {
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [localError, setLocalError] = useState("");

  // Update digital clock and date dynamically
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      
      // Hours and minutes
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      const formattedHours = String(hours % 12 || 12).padStart(2, "0");
      setCurrentTime(`${formattedHours}:${minutes}`);

      // Date: e.g. "Saturday, 11 July"
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      setCurrentDate(`${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = extractMeetingId(joinCode);
    if (!cleanCode) return;

    setIsCheckingCode(true);
    setLocalError("");
    try {
      const res = await fetch(`/api/meetings/exists/${cleanCode}`);
      if (res.ok) {
        const data = await res.json();
        if (data.exists) {
          onJoinCode(cleanCode);
        } else {
          setLocalError("Meeting code or link does not exist. Check the code and try again.");
        }
      } else {
        setLocalError("Failed to verify code. Please try again.");
      }
    } catch (err) {
      setLocalError("Network error. Please try again.");
    } finally {
      setIsCheckingCode(false);
    }
  };

  return (
    <div id="home-view" className="flex flex-col h-full w-full bg-[#0d0e12] text-slate-200 p-2.5 sm:p-4 font-sans select-none relative overflow-y-auto scrollbar-none pb-24">
      <div className="w-full max-w-4xl mx-auto flex flex-col flex-grow relative">
        {/* Top Header Bar */}
        <div id="header-bar" className="flex items-center justify-between mt-1 mb-6">
          <button id="menu-btn" className="p-1.5 text-slate-300 hover:text-white transition duration-200 cursor-pointer">
            <Menu className="w-6 h-6" />
          </button>
          
          {/* Search Contacts Pill */}
          <div id="search-contacts-pill" className="flex items-center bg-[#181922] rounded-full px-4 py-2 w-56 border-none">
            <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
            <input
              id="search-contacts"
              type="text"
              placeholder="Search contacts"
              className="bg-transparent border-none outline-none text-base text-slate-200 placeholder-slate-500 w-full font-sans"
              disabled
            />
            <Keyboard className="w-3.5 h-3.5 text-slate-400 ml-2 shrink-0" />
          </div>

          {/* Profile Avatar */}
          <div id="profile-avatar" className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#6366f1] to-[#3b82f6] flex items-center justify-center text-white border border-[#4f46e5]/30 shadow-md">
            <User className="w-4 h-4 text-white/95" />
          </div>
        </div>

        {/* Clock Display */}
        <div id="clock-display" className="flex flex-col items-center justify-center text-center my-6">
          <h1 id="digital-clock" className="text-[5.5rem] font-light tracking-tighter text-white font-sans tabular-nums leading-none">
            {currentTime || "09:13"}
          </h1>
          <p id="calendar-date" className="text-slate-400/90 text-xs font-normal mt-2 tracking-wide font-sans">
            {currentDate || "Saturday 11 July"}
          </p>
        </div>

        {/* API Key Banner / Fallback Indicator */}
        {!apiConfig.hasApiKey && (
          <div id="api-warning-banner" className="mb-5 bg-[#211b15]/60 border border-amber-950/40 rounded-2xl p-3.5 text-[11px] text-amber-200/90 flex flex-col gap-1 shadow-sm leading-normal">
            <div className="flex items-center gap-1.5 font-semibold text-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
              Demo & Simulation Active
            </div>
            <p className="text-slate-400">
              AI API key (Gemini or Groq) is not configured. Start meetings using the high-fidelity **Simulated Demo Mode** to test transcribing and live summaries!
            </p>
          </div>
        )}

        {/* Activity Status */}
        <div id="activity-status" className="text-center mb-5">
          <p className="text-[#525876] text-xs font-medium tracking-wide">Your latest activity will appear here</p>
        </div>

        {/* Enter Code Search Bar */}
        <form id="join-form" onSubmit={handleJoinSubmit} className="mb-6">
          <div id="join-input-container" className="flex items-center bg-[#181922] rounded-full pl-4 pr-2 py-2 border border-transparent focus-within:border-blue-500/30 transition duration-200">
            <Search className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
            <input
              id="join-input"
              type="text"
              placeholder="Enter a code or link"
              value={joinCode}
              onChange={(e) => {
                setJoinCode(e.target.value);
                if (localError) setLocalError("");
              }}
              className="bg-transparent border-none outline-none text-base text-slate-200 placeholder-slate-500 w-full font-sans"
              disabled={isCheckingCode}
            />
            <button
              type="submit"
              disabled={isCheckingCode || !joinCode.trim()}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-full shadow-md hover:shadow-blue-500/30 transition cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shrink-0 min-w-[64px]"
            >
              {isCheckingCode ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                "Join"
              )}
            </button>
          </div>
          {localError && (
            <div className="mt-2.5 ml-4 text-xs font-medium text-red-400 animate-pulse flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0"></span>
              {localError}
            </div>
          )}
        </form>

        {/* Recent Meetings Section */}
        <div id="recent-meetings-section" className="flex-grow">
          <div className="flex items-center gap-2 text-[#525876] mb-3 px-1 text-[10px] tracking-wider uppercase font-semibold">
            <Clock className="w-3.5 h-3.5" />
            <span>Recent meetings</span>
          </div>

          {meetings.length === 0 ? (
            <div className="text-center py-10 text-slate-600 text-xs">
              No recent meetings. Click "New" to start one!
            </div>
          ) : (
            <div id="meetings-list" className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {meetings.map((meeting) => (
                <div
                  id={`meeting-card-${meeting.id}`}
                  key={meeting.id}
                  onClick={() => onViewMeeting(meeting)}
                  className="flex items-center justify-between bg-[#141520] hover:bg-[#1a1b2a] border border-slate-900/40 rounded-2xl p-3.5 cursor-pointer transition-all duration-200 group active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#13203c] flex items-center justify-center text-blue-400 shrink-0">
                      <Video className="w-4.5 h-4.5 text-[#3b82f6]" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <h3 className="text-xs font-semibold text-white group-hover:text-[#3b82f6] transition-colors duration-200 truncate pr-2">
                        {meeting.title}
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {meeting.date} · {meeting.participantsCount} people
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      id={`delete-btn-${meeting.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteMeeting(meeting.id);
                      }}
                      className="p-1.5 text-slate-600 hover:text-red-400 transition-all duration-200 rounded-lg hover:bg-red-950/20"
                      title="Delete Meeting"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition duration-200" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button "New" */}
      <button
        id="new-call-fab"
        onClick={onStartNew}
        className="absolute bottom-5 right-5 flex items-center gap-2 bg-[#1a73e8] hover:bg-blue-600 text-white font-semibold py-2.5 px-4.5 rounded-[20px] shadow-[0_4px_16px_rgba(26,115,232,0.35)] transition-all duration-200 active:scale-95 hover:translate-y-[-1px] cursor-pointer z-40"
      >
        <Video className="w-4.5 h-4.5" />
        <span className="text-xs">New</span>
      </button>
    </div>
  );
}
