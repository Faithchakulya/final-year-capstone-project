import React, { useState } from "react";
import { User, Phone, ArrowRight, X, Sparkles } from "lucide-react";

interface RegisterUserProps {
  onClose: () => void;
  onContinue: (name: string, phone: string) => void;
  initialName?: string;
  initialPhone?: string;
}

export default function RegisterUser({ onClose, onContinue, initialName = "", initialPhone = "" }: RegisterUserProps) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter your name to continue");
      return;
    }
    if (!phone.trim()) {
      setError("Please enter your phone number to continue");
      return;
    }
    setError("");
    onContinue(name.trim(), phone.trim());
  };

  return (
    <div id="register-user-view" className="flex flex-col h-full w-full bg-[#0d0e12] text-slate-200 p-4 sm:p-6 font-sans select-none relative overflow-y-auto scrollbar-none pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mt-1 mb-8">
        <button id="close-register-user" onClick={onClose} className="p-1.5 text-slate-400 hover:text-white transition duration-200 cursor-pointer">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-sm font-semibold text-white tracking-wide">Identify Yourself</h2>
        <div className="w-10"></div> {/* Spacer for alignment */}
      </div>

      <div className="flex-grow flex flex-col justify-center max-w-sm mx-auto w-full">
        {/* Animated Badge & Intro */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4 shadow-lg shadow-blue-500/5">
            <Sparkles className="w-6 h-6 text-blue-400 animate-pulse" />
          </div>
          <h3 className="text-lg font-bold text-white tracking-tight">Enter Your Details</h3>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed max-w-[280px]">
            Please enter your name and phone number to set up your profile for this call.
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3.5 py-2.5 rounded-xl text-center font-medium animate-pulse">
              {error}
            </div>
          )}

          {/* Name Field */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 px-1">
              Your Full Name
            </label>
            <div className="relative flex items-center">
              <User className="absolute left-3.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="e.g. John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#181922] border border-slate-800/80 rounded-2xl pl-11 pr-4 py-3 text-base text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500/50 focus:bg-[#1b1c28] transition-all duration-200"
                maxLength={40}
              />
            </div>
          </div>

          {/* Phone Field */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 px-1">
              Your Phone Number
            </label>
            <div className="relative flex items-center">
              <Phone className="absolute left-3.5 w-4 h-4 text-slate-500" />
              <input
                type="tel"
                placeholder="e.g. +1 (555) 019-2834"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#181922] border border-slate-800/80 rounded-2xl pl-11 pr-4 py-3 text-base text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500/50 focus:bg-[#1b1c28] transition-all duration-200"
                maxLength={25}
              />
            </div>
          </div>

          {/* Spacer */}
          <div className="pt-2"></div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-[#1a73e8] hover:bg-blue-600 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg shadow-blue-500/20 transition-all duration-200 active:scale-95 cursor-pointer text-xs uppercase tracking-wider"
          >
            <span>Continue to Setup</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-[9px] text-slate-500 text-center mt-6 leading-normal">
          This is stored locally on your browser. Your name will appear as your speaker profile in meetings.
        </p>
      </div>
    </div>
  );
}
