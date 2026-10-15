import React, { useState } from "react";
import { User, Phone, ArrowRight, X } from "lucide-react";

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
      setError("Enter your name to continue.");
      return;
    }
    setError("");
    onContinue(name.trim(), phone.trim());
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0d0e12] text-slate-200 p-4 sm:p-6 font-sans select-none relative overflow-y-auto pb-12">
      <div className="flex items-center justify-between mt-1 mb-8">
        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white transition duration-200 cursor-pointer">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-sm font-semibold text-white tracking-wide">Your details</h2>
        <div className="w-10" />
      </div>

      <div className="flex-grow flex flex-col justify-center max-w-sm mx-auto w-full">
        <div className="flex flex-col items-center text-center mb-8">
          <h3 className="text-lg font-bold text-white tracking-tight">How should others see you?</h3>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed max-w-[280px]">
            Your name is shown to other participants and used as your speaker label in the transcript.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3.5 py-2.5 rounded-xl text-center font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 px-1">
              Name
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

          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 px-1">
              Phone (optional)
            </label>
            <div className="relative flex items-center">
              <Phone className="absolute left-3.5 w-4 h-4 text-slate-500" />
              <input
                type="tel"
                placeholder="e.g. +260 97 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#181922] border border-slate-800/80 rounded-2xl pl-11 pr-4 py-3 text-base text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500/50 focus:bg-[#1b1c28] transition-all duration-200"
                maxLength={25}
              />
            </div>
          </div>

          <div className="pt-2" />

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-[#1a73e8] hover:bg-blue-600 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg shadow-blue-500/20 transition-all duration-200 active:scale-95 cursor-pointer text-xs uppercase tracking-wider"
          >
            <span>Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-[9px] text-slate-500 text-center mt-6 leading-normal">
          Saved in this browser only.
        </p>
      </div>
    </div>
  );
}
