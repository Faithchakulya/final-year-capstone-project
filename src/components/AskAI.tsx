import React, { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles, User } from "lucide-react";
import { AssistantMessage } from "../types";
import { clockTime } from "../lib/meeting";

interface AskAIProps {
  transcript: string;
  placeholder?: string;
}

/** Q&A chat about a meeting transcript, backed by /api/ai/chat. */
export default function AskAI({ transcript, placeholder = "Ask about this meeting..." }: AskAIProps) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const addMessage = (sender: AssistantMessage["sender"], text: string) =>
    setMessages((prev) => [...prev, { sender, text, timestamp: clockTime() }]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || isSending) return;

    const history = messages;
    setInput("");
    addMessage("user", question);

    if (!transcript.trim()) {
      addMessage("ai", "There is no transcript to answer from yet.");
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, messages: history, question }),
      });
      const data = await response.json();
      addMessage("ai", response.ok ? data.answer : data.error || "Something went wrong.");
    } catch {
      addMessage("ai", "Could not reach the server.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col flex-grow min-h-[300px]">
      <div className="flex-grow overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {messages.length === 0 && (
          <p className="text-xs text-slate-500 text-center my-auto">
            Ask a question and the answer will come from the transcript.
          </p>
        )}
        {messages.map((msg, i) => {
          const isUser = msg.sender === "user";
          return (
            <div key={i} className={`flex gap-3 max-w-[85%] ${isUser ? "self-end flex-row-reverse" : "self-start"}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  isUser ? "bg-blue-600 text-white" : "bg-slate-800 text-blue-400"
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              </div>
              <div
                className={`p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? "bg-blue-600 text-white rounded-tr-none"
                    : "bg-[#181924] text-slate-200 border border-slate-800 rounded-tl-none"
                }`}
              >
                {msg.text}
                <span className={`block text-[8px] mt-1 text-right ${isUser ? "text-blue-200" : "text-slate-500"}`}>
                  {msg.timestamp}
                </span>
              </div>
            </div>
          );
        })}
        {isSending && (
          <div className="self-start flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
            Thinking...
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-800 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={isSending}
          className="flex-grow bg-[#1c1e27] border border-slate-800 rounded-full px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 transition"
        />
        <button
          type="submit"
          disabled={!input.trim() || isSending}
          className="p-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white shrink-0 transition cursor-pointer disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
