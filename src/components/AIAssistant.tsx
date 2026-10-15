import React, { useState, useEffect, useRef } from "react";
import { Sparkles, X, MessageSquare, CheckSquare, FileText, Send, User, Loader2 } from "lucide-react";
import { Meeting, ChatMessage, ActionItem } from "../types";

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  meetingTitle: string;
  transcript: string;
  summary: string;
  topicsCovered: string[];
  participantsCount: number;
  duration: string;
  actionItems: ActionItem[];
  decisions: string[];
  onToggleActionItem?: (task: string, completed: boolean) => void;
  isGenerating?: boolean;
}

export default function AIAssistant({
  isOpen,
  onClose,
  meetingTitle,
  transcript,
  summary,
  topicsCovered,
  participantsCount,
  duration,
  actionItems,
  decisions,
  onToggleActionItem,
  isGenerating = false
}: AIAssistantProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "actions" | "decisions" | "chat">("summary");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      sender: "ai",
      text: "Hi! I'm your live Meeting AI. You can ask me anything about our conversation, such as 'What were the main talking points?' or 'Who has to share a report?'",
      timestamp: "Just now"
    }
  ]);
  const [userInput, setUserInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, activeTab]);

  if (!isOpen) return null;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isSending) return;

    const userMessage = userInput.trim();
    setUserInput("");
    setIsSending(true);

    const newMessages = [
      ...chatMessages,
      { sender: "user" as const, text: userMessage, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ];
    setChatMessages(newMessages);

    try {
      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          messages: newMessages,
          question: userMessage
        })
      });

      const data = await response.json();
      if (response.ok && data.answer) {
        setChatMessages((prev) => [
          ...prev,
          { sender: "ai", text: data.answer, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
        ]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          { sender: "ai", text: data.error || "Sorry, I ran into an error processing your request.", timestamp: "Just now" }
        ]);
      }
    } catch (err) {
      console.error(err);
      setChatMessages((prev) => [
        ...prev,
        { sender: "ai", text: "Connection error. Please make sure the server is online.", timestamp: "Just now" }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div id="ai-assistant-drawer" className="absolute inset-x-0 bottom-0 md:relative md:inset-auto md:h-full md:w-[380px] md:rounded-2xl md:border md:border-slate-800/80 md:shadow-none md:animate-none z-40 bg-[#14151f] rounded-t-3xl border-t border-slate-800 shadow-[0_-8px_40px_rgba(0,0,0,0.5)] flex flex-col h-[75%] w-full animate-slide-up select-none">
      {/* Top Grab Bar / Handle */}
      <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto my-3 md:hidden"></div>

      {/* Header */}
      <div className="flex items-center justify-between px-6 pb-2 border-b border-slate-800/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400">
            <Sparkles className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-base">AI Assistant</h3>
            <p className="text-[10px] text-slate-400 font-medium truncate max-w-[180px]">{meetingTitle}</p>
          </div>
          <span className="bg-blue-900/30 text-blue-400 border border-blue-800/30 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase flex items-center gap-1 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            LIVE
          </span>
        </div>
        <button id="close-ai" onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs Row */}
      <div id="ai-tabs" className="flex border-b border-slate-800/50 px-3 py-1">
        {(["summary", "actions", "decisions", "chat"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 text-center py-2 text-xs font-semibold tracking-wide border-b-2 capitalize transition-all cursor-pointer ${
              activeTab === tab
                ? "border-blue-500 text-white font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab === "chat" ? "Ask AI" : tab}
          </button>
        ))}
      </div>

      {/* Tab Content Container */}
      <div className="flex-grow overflow-y-auto p-5 text-slate-200">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center h-full py-10 gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-sm font-medium">AI is compiling minutes and transcribing...</p>
          </div>
        ) : (
          <>
            {/* 1. SUMMARY TAB */}
            {activeTab === "summary" && (
              <div id="summary-tab-content" className="flex flex-col gap-5">
                {/* AI SUMMARY CARD */}
                <div className="bg-[#1c1d29] border border-blue-900/10 rounded-2xl p-4 shadow-md relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-600/5 to-transparent rounded-full blur-xl"></div>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    <span className="text-[10px] tracking-wider uppercase font-extrabold text-blue-400">AI SUMMARY</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-normal">
                    {summary || "No discussion recorded yet. Start talking or play simulated meeting to see AI live summary."}
                  </p>
                </div>

                {/* TOPICS COVERED */}
                <div>
                  <h4 className="text-[10px] tracking-wider uppercase font-bold text-slate-400 mb-2.5">TOPICS COVERED</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {topicsCovered.length === 0 ? (
                      <span className="text-xs text-slate-500">None detected yet</span>
                    ) : (
                      topicsCovered.map((topic, i) => (
                        <span key={i} className="bg-[#1e202e] text-slate-300 px-3 py-1.5 rounded-full text-[11px] font-semibold border border-slate-800">
                          {topic}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* STATS TILES GRID */}
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div className="bg-[#181924] border border-slate-800/80 rounded-2xl p-4 text-center shadow-sm">
                    <span className="block text-2xl font-bold text-white mb-0.5">{participantsCount}</span>
                    <span className="text-[10px] font-medium text-slate-400">Participants</span>
                  </div>
                  <div className="bg-[#181924] border border-slate-800/80 rounded-2xl p-4 text-center shadow-sm">
                    <span className="block text-2xl font-bold text-white mb-0.5">{duration}</span>
                    <span className="text-[10px] font-medium text-slate-400">Duration</span>
                  </div>
                  <div className="bg-[#181924] border border-slate-800/80 rounded-2xl p-4 text-center shadow-sm">
                    <span className="block text-2xl font-bold text-white mb-0.5">{actionItems.length}</span>
                    <span className="text-[10px] font-medium text-slate-400">Action items</span>
                  </div>
                </div>
              </div>
            )}

            {/* 2. ACTIONS TAB */}
            {activeTab === "actions" && (
              <div id="actions-tab-content">
                <h4 className="text-[10px] tracking-wider uppercase font-bold text-slate-400 mb-4">ASSIGNED ACTION ITEMS</h4>
                {actionItems.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-xs">
                    No action items identified yet.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {actionItems.map((action, i) => (
                      <div
                        key={i}
                        onClick={() => onToggleActionItem && onToggleActionItem(action.task, !action.completed)}
                        className={`flex items-start gap-3 bg-[#181924] hover:bg-[#1f2030] p-4 rounded-2xl border transition cursor-pointer ${
                          action.completed ? "border-emerald-950/40 opacity-75" : "border-slate-800"
                        }`}
                      >
                        <div className="mt-0.5">
                          <CheckSquare className={`w-4 h-4 transition ${
                            action.completed ? "text-emerald-400" : "text-slate-500"
                          }`} />
                        </div>
                        <div className="flex-grow">
                          <p className={`text-xs font-medium leading-relaxed ${action.completed ? "line-through text-slate-500" : "text-slate-200"}`}>
                            {action.task}
                          </p>
                          <div className="flex items-center gap-1.5 mt-2">
                            <span className="text-[9px] bg-blue-900/20 text-blue-400 px-2 py-0.5 rounded-md border border-blue-900/30 font-semibold uppercase">
                              {action.assignee}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. DECISIONS TAB */}
            {activeTab === "decisions" && (
              <div id="decisions-tab-content">
                <h4 className="text-[10px] tracking-wider uppercase font-bold text-slate-400 mb-4">MEETING DECISIONS</h4>
                {decisions.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-xs">
                    No strategic decisions recorded yet.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {decisions.map((decision, i) => (
                      <div key={i} className="flex gap-3 bg-[#111e1e] border border-teal-950 p-4 rounded-2xl">
                        <div className="w-5 h-5 rounded-full bg-teal-900/30 flex items-center justify-center text-teal-400 text-[10px] font-extrabold shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        <p className="text-xs font-semibold text-slate-200 leading-relaxed">
                          {decision}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 4. CHAT TAB (ASK AI) */}
            {activeTab === "chat" && (
              <div id="chat-tab-content" className="flex flex-col h-full -mx-5 -my-5">
                {/* Chat Message Logs */}
                <div className="flex-grow overflow-y-auto px-5 py-4 space-y-4 flex flex-col justify-end min-h-[220px]">
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex gap-3 max-w-[85%] ${
                        msg.sender === "user" ? "self-end flex-row-reverse" : "self-start"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 ${
                        msg.sender === "user" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"
                      }`}>
                        {msg.sender === "user" ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4 text-blue-400" />}
                      </div>
                      <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                        msg.sender === "user"
                          ? "bg-blue-600 text-white rounded-tr-none"
                          : "bg-[#181924] text-slate-200 border border-slate-800 rounded-tl-none"
                      }`}>
                        {msg.text}
                        <span className={`block text-[8px] mt-1 text-right ${
                          msg.sender === "user" ? "text-blue-200" : "text-slate-500"
                        }`}>
                          {msg.timestamp}
                        </span>
                      </div>
                    </div>
                  ))}
                  {isSending && (
                    <div className="flex gap-3 self-start max-w-[85%]">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs shrink-0">
                        <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
                      </div>
                      <div className="bg-[#181924] text-slate-400 border border-slate-800 p-3 rounded-2xl rounded-tl-none text-xs flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                        <span>AI is typing...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Input form */}
                <form onSubmit={handleSendMessage} className="p-4 bg-[#101117] border-t border-slate-800 flex gap-2">
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Ask AI about this meeting..."
                    className="flex-grow bg-[#1c1e27] border border-slate-800 rounded-full px-4 py-2.5 text-base text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 transition"
                    disabled={isSending}
                  />
                  <button
                    type="submit"
                    className="p-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white shrink-0 active:scale-95 transition cursor-pointer disabled:opacity-50"
                    disabled={!userInput.trim() || isSending}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
