import React, { useEffect, useState } from "react";
import { ChevronRight, Clock, Search, Trash2, Video } from "lucide-react";
import { Meeting } from "../types";
import { extractMeetingId } from "../lib/meeting";

interface HomeProps {
  meetings: Meeting[];
  hasApiKey: boolean;
  initialJoinCode: string;
  onStartNew: () => void;
  onJoinCode: (code: string) => void;
  onViewMeeting: (meeting: Meeting) => void;
  onDeleteMeeting: (id: string) => void;
}

export default function Home({ meetings, hasApiKey, initialJoinCode, onStartNew, onJoinCode, onViewMeeting, onDeleteMeeting }: HomeProps) {
  const [now, setNow] = useState(new Date());
  const [joinCode, setJoinCode] = useState(initialJoinCode);
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const checkAndJoin = async (input: string) => {
    const code = extractMeetingId(input);
    if (!code) return;

    setIsCheckingCode(true);
    setJoinError("");
    try {
      const res = await fetch(`/api/meetings/exists/${encodeURIComponent(code)}`);
      const data = await res.json();
      if (data.exists) {
        onJoinCode(code);
      } else {
        setJoinError("No meeting found with that code. It may have ended.");
      }
    } catch {
      setJoinError("Couldn't check the code. Try again.");
    } finally {
      setIsCheckingCode(false);
    }
  };

  // Opened from an invite link.
  useEffect(() => {
    if (initialJoinCode) checkAndJoin(initialJoinCode);
  }, []);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    checkAndJoin(joinCode);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0d0e12] text-slate-200 p-2.5 sm:p-4 relative overflow-y-auto pb-24">
      <div className="w-full max-w-4xl mx-auto flex flex-col flex-grow">
        <div className="flex flex-col items-center text-center my-10">
          <h1 className="text-[5.5rem] font-light tracking-tighter text-white tabular-nums leading-none">
            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </h1>
          <p className="text-slate-400 text-xs mt-2">
            {now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>

        {!hasApiKey && (
          <div className="mb-5 bg-[#211b15]/60 border border-amber-950/40 rounded-2xl p-3.5 text-[11px] text-amber-200/90">
            AI features are off because <code>GEMINI_API_KEY</code> isn't set. Calls and transcripts still work, but meetings
            can only be saved without a summary.
          </div>
        )}

        <form onSubmit={handleJoinSubmit} className="mb-6">
          <div className="flex items-center bg-[#181922] rounded-full pl-4 pr-2 py-2 border border-transparent focus-within:border-blue-500/30">
            <Search className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
            <input
              type="text"
              placeholder="Enter a code or link"
              value={joinCode}
              onChange={(e) => {
                setJoinCode(e.target.value);
                setJoinError("");
              }}
              className="bg-transparent outline-none text-base text-slate-200 placeholder-slate-500 w-full"
              disabled={isCheckingCode}
            />
            <button
              type="submit"
              disabled={isCheckingCode || !joinCode.trim()}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-full transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-w-[64px]"
            >
              {isCheckingCode ? "..." : "Join"}
            </button>
          </div>
          {joinError && <p className="mt-2.5 ml-4 text-xs text-red-400">{joinError}</p>}
        </form>

        <div className="flex-grow">
          <div className="flex items-center gap-2 text-[#525876] mb-3 px-1 text-[10px] tracking-wider uppercase font-semibold">
            <Clock className="w-3.5 h-3.5" />
            Recent meetings
          </div>

          {meetings.length === 0 ? (
            <p className="text-center py-10 text-slate-600 text-xs">No meetings yet. Press "New" to start one.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {meetings.map((meeting) => (
                <div
                  key={meeting.id}
                  onClick={() => onViewMeeting(meeting)}
                  className="flex items-center justify-between bg-[#141520] hover:bg-[#1a1b2a] border border-slate-900/40 rounded-2xl p-3.5 cursor-pointer transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[#13203c] flex items-center justify-center text-blue-400 shrink-0">
                      <Video className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-semibold text-white group-hover:text-blue-400 truncate">{meeting.title}</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {meeting.date} · {meeting.participantsCount} {meeting.participantsCount === 1 ? "person" : "people"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteMeeting(meeting.id);
                      }}
                      className="p-1.5 text-slate-600 hover:text-red-400 rounded-lg hover:bg-red-950/20"
                      title="Delete meeting"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={onStartNew}
        className="absolute bottom-5 right-5 flex items-center gap-2 bg-[#1a73e8] hover:bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-[20px] shadow-lg transition active:scale-95 cursor-pointer z-40"
      >
        <Video className="w-4 h-4" />
        <span className="text-xs">New</span>
      </button>
    </div>
  );
}
