import React, { useState } from "react";
import { Share2, Video, Copy, Check } from "lucide-react";

interface JoinModalProps {
  meetingCode: string;
  onClose: () => void;
  onJoin: () => void;
}

export default function JoinModal({ meetingCode, onClose, onJoin }: JoinModalProps) {
  const [copied, setCopied] = useState(false);
  const fullUrl = `meet.now/${meetingCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join my meeting",
          text: `Join my meeting on Minutes Taker: ${fullUrl}`,
          url: fullUrl
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div id="join-modal" className="absolute inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs rounded-b-[38px] overflow-hidden">
      {/* Drawer content sliding up */}
      <div className="w-full max-w-md bg-[#1e2130] rounded-t-3xl md:rounded-b-3xl p-5 flex flex-col items-center border-t border-slate-800 md:border md:border-slate-800 md:mb-6 animate-slide-up shadow-2xl">
        {/* Top Handle bar */}
        <div className="w-10 h-1 bg-slate-600 rounded-full mb-6"></div>

        <h2 className="text-base font-semibold text-white text-center px-4 mb-6 leading-snug">
          Share this joining info with others that you want in the meeting
        </h2>

        {/* Meeting Link Pill */}
        <div className="w-full bg-[#13141f] rounded-2xl p-4 flex items-center justify-between mb-6 border border-slate-800">
          <span className="text-sm font-medium text-slate-300 truncate select-all">
            {fullUrl}
          </span>
          <button
            onClick={handleCopy}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-xl transition cursor-pointer"
            title="Copy link"
          >
            {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>

        {/* Actions Grid */}
        <div className="grid grid-cols-2 gap-4 w-full mb-8">
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 border border-slate-700 hover:bg-slate-800 text-slate-200 font-semibold py-3.5 px-4 rounded-full transition active:scale-95 cursor-pointer text-sm"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>

          <button
            onClick={onJoin}
            className="flex items-center justify-center gap-2 bg-[#1a73e8] hover:bg-blue-600 text-white font-semibold py-3.5 px-4 rounded-full transition active:scale-95 cursor-pointer text-sm"
          >
            <Video className="w-4 h-4" />
            <span>Join meeting</span>
          </button>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={onClose}
          className="text-sm font-semibold text-blue-400 hover:text-blue-300 py-2 cursor-pointer transition"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
