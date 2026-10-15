import { Link as LinkIcon, Video, X } from "lucide-react";

interface StartCallProps {
  onClose: () => void;
  onCreateLink: () => void;
  onStartCall: () => void;
}

export default function StartCall({ onClose, onCreateLink, onStartCall }: StartCallProps) {
  return (
    <div className="flex flex-col h-full w-full bg-[#0d0e12] text-slate-200 p-2.5 sm:p-4 relative overflow-y-auto">
      <div className="w-full max-w-md mx-auto flex flex-col flex-grow">
        <div className="flex items-center justify-between mt-1 mb-10">
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white cursor-pointer">
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-sm font-semibold text-white">Start a call</h2>
          <div className="w-9" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onCreateLink}
            className="flex flex-col items-center justify-center bg-[#10192e]/80 hover:bg-[#162547] rounded-2xl py-6 px-2 transition active:scale-95 cursor-pointer"
          >
            <div className="w-11 h-11 rounded-full bg-[#1c2e54] flex items-center justify-center text-blue-400 mb-2">
              <LinkIcon className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-blue-400">Get invite link</span>
          </button>

          <button
            onClick={onStartCall}
            className="flex flex-col items-center justify-center bg-[#101c1c]/85 hover:bg-[#162a2a] rounded-2xl py-6 px-2 transition active:scale-95 cursor-pointer"
          >
            <div className="w-11 h-11 rounded-full bg-[#1c3333] flex items-center justify-center text-teal-400 mb-2">
              <Video className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-teal-400">Start now</span>
          </button>
        </div>
      </div>
    </div>
  );
}
