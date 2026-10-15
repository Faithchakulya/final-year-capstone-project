import React from "react";
import { X, Search, Grid, Link as LinkIcon, Calendar, Users, Info } from "lucide-react";

interface StartCallProps {
  onClose: () => void;
  onCreateLink: () => void;
  onInstantMeeting: () => void;
}

const SUGGESTIONS = [
  { id: "1", name: "Alex", email: "alex@gmail.com", initials: "AJ", bg: "bg-indigo-600/90 text-white" },
  { id: "2", name: "Sarah", email: "sarah.chen@gm...", initials: "SC", bg: "bg-emerald-600/90 text-white" },
  { id: "3", name: "Marcus", email: "marcus@gmail....", initials: "MR", bg: "bg-amber-600/90 text-white" },
  { id: "4", name: "Emily", email: "emily.w@gmail....", initials: "EW", bg: "bg-pink-600/90 text-white" },
  { id: "5", name: "James", email: "jpark@gmail.com", initials: "JP", bg: "bg-cyan-600/90 text-white" },
  { id: "6", name: "Nina", email: "nina.p@gmail.c...", initials: "NP", bg: "bg-purple-600/90 text-white" },
  { id: "7", name: "Tom", email: "tom.w@gmail.c...", initials: "TW", bg: "bg-red-500/90 text-white" },
  { id: "8", name: "Lisa", email: "lzhang@gmail.c...", initials: "LZ", bg: "bg-teal-600/90 text-white" },
  { id: "9", name: "Omar", email: "ohassan@gmail...", initials: "OH", bg: "bg-orange-500/90 text-white" }
];

export default function StartCall({ onClose, onCreateLink, onInstantMeeting }: StartCallProps) {
  return (
    <div id="start-call-view" className="flex flex-col h-full w-full bg-[#0d0e12] text-slate-200 p-2.5 sm:p-4 font-sans select-none relative overflow-y-auto scrollbar-none pb-12">
      <div className="w-full max-w-4xl mx-auto flex flex-col flex-grow relative">
        {/* Header */}
        <div className="flex items-center justify-between mt-1 mb-6">
          <button id="close-start-call" onClick={onClose} className="p-1.5 text-slate-400 hover:text-white transition duration-200 cursor-pointer">
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-sm font-semibold text-white tracking-wide">Start a call</h2>
          <div className="w-10"></div> {/* Spacer for alignment */}
        </div>

        {/* Search Input Bar */}
        <div className="flex items-center bg-[#181922] rounded-full px-4 py-2.5 mb-6 border-none">
          <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Search contacts or dial"
            className="bg-transparent border-none outline-none text-base text-slate-200 placeholder-slate-500 w-full"
            disabled
          />
          <Grid className="w-3.5 h-3.5 text-slate-400 ml-2 shrink-0" />
        </div>

        {/* 3 Buttons Grid */}
        <div className="grid grid-cols-3 gap-2.5 mb-6">
          <button
            onClick={onCreateLink}
            className="flex flex-col items-center justify-center bg-[#10192e]/80 hover:bg-[#162547] border border-blue-900/10 rounded-2xl py-4 px-2 text-center transition-all duration-200 active:scale-95 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-full bg-[#1c2e54] flex items-center justify-center text-[#3b82f6] mb-2 group-hover:bg-blue-600 group-hover:text-white transition-all">
              <LinkIcon className="w-4.5 h-4.5" />
            </div>
            <span className="text-[10px] font-semibold text-blue-400 group-hover:text-blue-300">Create link</span>
          </button>

          <button
            onClick={onInstantMeeting}
            className="flex flex-col items-center justify-center bg-[#101c1c]/85 hover:bg-[#162a2a] border border-teal-950/10 rounded-2xl py-4 px-2 text-center transition-all duration-200 active:scale-95 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-full bg-[#1c3333] flex items-center justify-center text-teal-400 mb-2 group-hover:bg-teal-600 group-hover:text-white transition-all">
              <Calendar className="w-4.5 h-4.5" />
            </div>
            <span className="text-[10px] font-semibold text-teal-400 group-hover:text-teal-300">Instant call</span>
          </button>

          <button
            onClick={onInstantMeeting}
            className="flex flex-col items-center justify-center bg-[#18152e]/80 hover:bg-[#231e47] border border-purple-950/10 rounded-2xl py-4 px-2 text-center transition-all duration-200 active:scale-95 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-full bg-[#272054] flex items-center justify-center text-purple-400 mb-2 group-hover:bg-purple-600 group-hover:text-white transition-all">
              <Users className="w-4.5 h-4.5" />
            </div>
            <span className="text-[10px] font-semibold text-purple-400 group-hover:text-purple-300">Group call</span>
          </button>
        </div>

        {/* Suggestions Section */}
        <div className="flex-grow">
          <div className="flex items-center gap-1.5 text-[#525876] mb-5 px-1 text-[10px] font-semibold tracking-wider uppercase">
            <span>Suggestions</span>
            <Info className="w-3 h-3 text-slate-500" />
          </div>

          {/* Grid of contacts */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-y-5 gap-x-2 md:gap-4">
            {SUGGESTIONS.map((contact) => (
              <div
                key={contact.id}
                onClick={onInstantMeeting}
                className="flex flex-col items-center text-center cursor-pointer group active:scale-95 transition-all"
              >
                <div className="relative mb-1.5">
                  {/* Avatar circle */}
                  <div className={`w-14 h-14 rounded-full ${contact.bg} flex items-center justify-center text-base font-semibold border-2 border-[#0d0e12] group-hover:border-blue-400 shadow-md transition-all duration-200`}>
                    {contact.initials}
                  </div>
                  {/* Yellow Camera Icon Badge */}
                  <div className="absolute bottom-0 right-0 w-5.5 h-5.5 rounded-full bg-[#f9ab00] flex items-center justify-center text-slate-950 border-2 border-[#0d0e12] shadow">
                    <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0-1-.45-1-1v-3.5l4 4v-11l-4 4z" />
                    </svg>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-slate-200 group-hover:text-[#3b82f6] transition-colors truncate w-full px-1">
                  {contact.name}
                </span>
                <span className="text-[9px] text-[#525876] mt-0.5 truncate w-20">
                  {contact.email}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
