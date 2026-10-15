import React from "react";
import { X } from "lucide-react";

interface DrawerProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}

/** Side panel on desktop, bottom sheet on mobile. */
export default function Drawer({ title, subtitle, icon, onClose, children }: DrawerProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 md:relative md:inset-auto md:h-full md:w-[380px] md:rounded-2xl md:border md:border-slate-800/80 md:animate-none z-40 bg-[#14151f] rounded-t-3xl border-t border-slate-800 shadow-[0_-8px_40px_rgba(0,0,0,0.5)] flex flex-col h-[75%] w-full animate-slide-up">
      <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto my-3 md:hidden" />
      <div className="flex items-center justify-between px-6 py-2 border-b border-slate-800/50">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-white text-base">{title}</h3>
            {subtitle && <p className="text-[10px] text-slate-400 truncate">{subtitle}</p>}
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer">
          <X className="w-5 h-5" />
        </button>
      </div>
      {children}
    </div>
  );
}
