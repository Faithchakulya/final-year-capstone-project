import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Sparkles, CheckSquare, Clock, Users, Calendar, MessageSquare, Send, User, Loader2, Sparkle, Download, BookOpen, Heart, ListTodo } from "lucide-react";
import { Meeting, ChatMessage, ActionItem } from "../types";

interface MeetingDetailProps {
  meeting: Meeting;
  onBack: () => void;
  onToggleActionItem: (meetingId: string, task: string, completed: boolean) => void;
}

export default function MeetingDetail({
  meeting,
  onBack,
  onToggleActionItem
}: MeetingDetailProps) {
  const [activeSection, setActiveSection] = useState<"summary" | "transcript" | "chat">("summary");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleDownloadWord = () => {
    const safeTitle = meeting.title.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const rawAttendees = meeting.peoplePresent && meeting.peoplePresent.length > 0
      ? meeting.peoplePresent
      : ["Sarah Chen", "Marcus", "Emily", "You"];
    const attendeesStr = rawAttendees
      .map((name: string) => {
        let cleanName = name.replace(/^You \((.+)\)$/i, "$1").trim();
        if (cleanName.toLowerCase() === "me" || cleanName.toLowerCase() === "you (me)") {
          return "You";
        }
        return cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
      })
      .join(", ");
    const topicsStr = meeting.topicsCovered && meeting.topicsCovered.length > 0
      ? meeting.topicsCovered.join(", ")
      : "General Sync";
    const formattedDate = new Date(meeting.createdAt || Date.now()).toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    const wordHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>${meeting.title} - Meeting Minutes</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page {
            size: 8.5in 11in;
            margin: 1.0in 1.0in 1.0in 1.0in;
          }
          body {
            font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
            color: #1e293b;
            line-height: 1.6;
            background-color: #ffffff;
          }
          .doc-header {
            border-bottom: 3px solid #1e3a8a;
            padding-bottom: 16px;
            margin-bottom: 28px;
          }
          .doc-subtitle {
            font-size: 10pt;
            color: #2563eb;
            text-transform: uppercase;
            letter-spacing: 1.8px;
            font-weight: bold;
            margin: 0 0 6px 0;
          }
          .doc-title {
            color: #0f172a;
            font-size: 26pt;
            font-weight: bold;
            margin: 0;
            font-family: 'Georgia', 'Calibri', 'Segoe UI', serif;
            line-height: 1.15;
          }
          .doc-date {
            font-size: 10.5pt;
            color: #64748b;
            margin: 8px 0 0 0;
            font-style: italic;
          }
          h2 {
            color: #1e3a8a;
            font-size: 14pt;
            border-bottom: 2px solid #cbd5e1;
            padding-bottom: 6px;
            margin-top: 28pt;
            margin-bottom: 14pt;
            font-family: 'Georgia', 'Calibri-Bold', 'Segoe UI Semibold', serif;
            letter-spacing: 0.5px;
          }
          .meta-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24pt;
            border: 1px solid #cbd5e1;
          }
          .meta-table td {
            padding: 10px 14px;
            border: 1px solid #cbd5e1;
            font-size: 10pt;
            vertical-align: middle;
          }
          .meta-label {
            font-weight: bold;
            background-color: #f8fafc;
            width: 22%;
            color: #334155;
          }
          .summary-box {
            background-color: #f8fafc;
            border-left: 4px solid #2563eb;
            padding: 16px 18px;
            margin-bottom: 18pt;
            font-size: 11pt;
            color: #1e293b;
            border-radius: 0 4px 4px 0;
          }
          .discussion-box {
            background-color: #fcfdfd;
            border: 1px solid #e2e8f0;
            border-left: 4px solid #16a34a;
            padding: 16px 18px;
            margin-bottom: 18pt;
            font-size: 11pt;
            color: #0f2f1d;
            border-radius: 0 4px 4px 0;
          }
          .decision-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 18pt;
          }
          .decision-table td {
            padding: 10px 0;
            font-size: 11pt;
            border-bottom: 1px solid #f1f5f9;
          }
          .decision-badge {
            width: 55px;
            font-weight: bold;
            color: #2563eb;
            vertical-align: top;
            font-family: Consolas, monospace;
          }
          .action-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12pt;
            margin-bottom: 22pt;
            border: 1px solid #cbd5e1;
          }
          .action-table th {
            background-color: #1e3a8a;
            color: #ffffff;
            font-weight: bold;
            text-align: left;
            padding: 12px 14px;
            font-size: 10pt;
            border: 1px solid #1e3a8a;
            font-family: 'Calibri-Bold', 'Segoe UI Semibold', sans-serif;
          }
          .action-table td {
            padding: 12px 14px;
            border: 1px solid #cbd5e1;
            font-size: 10.5pt;
          }
          .action-ref {
            font-weight: bold;
            color: #475569;
            text-align: center;
            font-family: Consolas, monospace;
          }
          .transcript-container {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 18px;
            margin-top: 12pt;
            border-radius: 4px;
          }
          .transcript-line {
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 10pt;
            line-height: 1.5;
          }
          .transcript-speaker {
            font-weight: bold;
            color: #0f172a;
          }
          .transcript-time {
            color: #64748b;
            font-family: Consolas, monospace;
            font-size: 9pt;
            margin-right: 10px;
          }
          .footer {
            margin-top: 60pt;
            border-top: 1.5px solid #e2e8f0;
            padding-top: 14px;
            font-size: 9pt;
            color: #64748b;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="doc-header">
          <p class="doc-subtitle">AI-Synthesized Meeting Minutes - Atarashi Meet</p>
          <h1 class="doc-title">${meeting.title}</h1>
          <p class="doc-date">Compiled on ${formattedDate}</p>
        </div>
        
        <table class="meta-table">
          <tr>
            <td class="meta-label">Title</td>
            <td colspan="3" style="font-weight: bold; font-size: 11pt; color: #0f172a;">${meeting.title}</td>
          </tr>
          <tr>
            <td class="meta-label">Date & Time</td>
            <td>${meeting.date}</td>
            <td class="meta-label">Duration</td>
            <td>${meeting.duration}</td>
          </tr>
          <tr>
            <td class="meta-label">Total Attendees</td>
            <td>${meeting.participantsCount}</td>
            <td class="meta-label">Topics Covered</td>
            <td>${topicsStr}</td>
          </tr>
          <tr>
            <td class="meta-label">People Present</td>
            <td colspan="3">${attendeesStr}</td>
          </tr>
        </table>

        <h2>1. Executive Summary</h2>
        <div class="summary-box">
          ${meeting.summary}
        </div>

        <h2>2. Detailed Discussion Flow</h2>
        <div class="discussion-box">
          ${meeting.discussion || "The core agenda items and conversation segments were synthesized offline. Active brainstorming on product priorities occurred with input from all present members."}
        </div>

        <h2>3. Key Decisions</h2>
        <table class="decision-table">
          ${meeting.decisions && meeting.decisions.length > 0 
            ? meeting.decisions.map((decision, idx) => `
              <tr>
                <td class="decision-badge">D${idx + 1}</td>
                <td>${decision}</td>
              </tr>
            `).join("")
            : '<tr><td colspan="2" style="color: #64748b; font-style: italic;">No decisions were formally recorded during this session.</td></tr>'
          }
        </table>

        <h2>4. Action Items Assigned</h2>
        <table class="action-table">
          <thead>
            <tr>
              <th style="width: 10%; text-align: center;">ID</th>
              <th style="width: 65%;">Action Item / Deliverable Description</th>
              <th style="width: 25%;">Assignee</th>
            </tr>
          </thead>
          <tbody>
            ${meeting.actionItems && meeting.actionItems.length > 0
              ? meeting.actionItems.map((action, idx) => `
                <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                  <td class="action-ref">A${idx + 1}</td>
                  <td>${action.task}</td>
                  <td><b>${action.assignee}</b></td>
                </tr>
              `).join("")
              : '<tr><td colspan="3" style="text-align: center; color: #64748b; font-style: italic;">No action items assigned in this meeting.</td></tr>'
            }
          </tbody>
        </table>

        <h2>5. Chronological Transcript</h2>
        <div class="transcript-container">
          ${meeting.transcript && meeting.transcript.length > 0
            ? meeting.transcript.map(line => `
              <div class="transcript-line">
                <span class="transcript-time">[${line.timestamp}]</span>
                <span class="transcript-speaker">${line.speaker}:</span>
                <span>${line.text}</span>
              </div>
            `).join("")
            : '<div>No transcript segments recorded for this session.</div>'
          }
        </div>

        <div class="footer">
          Generated automatically by Atarashi Meet on ${new Date().toLocaleDateString()}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + wordHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `meeting_minutes_${safeTitle}.doc`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Initialize Chat Messages
  useEffect(() => {
    setChatMessages([
      {
        sender: "ai",
        text: `Hi! I have analyzed the transcript of "${meeting.title}". You can ask me any questions about what was discussed, such as 'Who was assigned to Marcus's task?' or 'What did Emily present?'`,
        timestamp: "Just now"
      }
    ]);
  }, [meeting]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, activeSection]);

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
      const fullTranscriptText = meeting.transcript
        .map((line) => `${line.speaker}: ${line.text}`)
        .join("\n");

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: fullTranscriptText,
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
        { sender: "ai", text: "Connection error. Make sure the server is online.", timestamp: "Just now" }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const getSpeakerInitials = (speaker: string) => {
    return speaker.split(" ").map(s => s[0]).join("").substring(0, 2).toUpperCase();
  };

  const getSpeakerColorClass = (speaker: string) => {
    switch (speaker) {
      case "Sarah Chen": return "bg-emerald-600/20 text-emerald-400 border-emerald-500/20";
      case "Marcus": return "bg-amber-600/20 text-amber-400 border-amber-500/20";
      case "Emily": return "bg-pink-600/20 text-pink-400 border-pink-500/20";
      case "Tom": return "bg-red-500/20 text-red-400 border-red-500/20";
      case "Alex": return "bg-indigo-600/20 text-indigo-400 border-indigo-500/20";
      default: return "bg-blue-600/20 text-blue-400 border-blue-500/20";
    }
  };

  return (
    <div id="meeting-detail-view" className="flex flex-col h-full w-full bg-[#0d0e12] text-slate-200 p-2.5 sm:p-4 font-sans select-none relative overflow-y-auto scrollbar-none pb-6">
      <div className="w-full max-w-4xl mx-auto flex flex-col flex-grow relative">
      {/* Back Header */}
      <div className="flex items-center justify-between gap-3 mt-2 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold font-mono">Past Meeting Explorer</span>
            <h2 className="text-base font-bold text-white truncate max-w-[180px] sm:max-w-[320px]">{meeting.title}</h2>
          </div>
        </div>

        <button
          onClick={handleDownloadWord}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-900/20 active:scale-95 transition cursor-pointer shrink-0"
          title="Download complete meeting minutes in Word format"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Word</span>
        </button>
      </div>

      {/* Quick Metadata Info Row */}
      <div className="grid grid-cols-3 gap-2 mb-6 bg-[#13141f] border border-slate-900 rounded-2xl p-3.5">
        <div className="flex flex-col items-center justify-center text-center">
          <Calendar className="w-4 h-4 text-slate-500 mb-1" />
          <span className="text-[9px] text-slate-500 uppercase font-semibold">Date</span>
          <span className="text-xs font-semibold text-white mt-0.5 truncate w-full px-1">{meeting.date.split(",")[0]}</span>
        </div>
        <div className="flex flex-col items-center justify-center text-center border-x border-slate-800/80">
          <Clock className="w-4 h-4 text-slate-500 mb-1" />
          <span className="text-[9px] text-slate-500 uppercase font-semibold">Duration</span>
          <span className="text-xs font-semibold text-white mt-0.5">{meeting.duration}</span>
        </div>
        <div className="flex flex-col items-center justify-center text-center">
          <Users className="w-4 h-4 text-slate-500 mb-1" />
          <span className="text-[9px] text-slate-500 uppercase font-semibold">Attendees</span>
          <span className="text-xs font-semibold text-white mt-0.5">{meeting.participantsCount}</span>
        </div>
      </div>

      {/* Section Switcher Bar */}
      <div className="flex bg-[#181924] rounded-full p-1 mb-6 border border-slate-800/80">
        {(["summary", "transcript", "chat"] as const).map((sec) => (
          <button
            key={sec}
            onClick={() => setActiveSection(sec)}
            className={`flex-1 py-2 text-xs font-semibold rounded-full transition-all cursor-pointer ${
              activeSection === sec
                ? "bg-[#1a73e8] text-white font-bold shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {sec === "chat" ? "Ask AI Chat" : sec === "summary" ? "AI Summary" : "Transcript"}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex-grow overflow-y-auto pb-4">
        
        {/* 1. SUMMARY SECTION */}
        {activeSection === "summary" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in items-start">
            {/* Left Column: Summary & Topics */}
            <div className="space-y-6">
              {/* Summary Block */}
              <div className="bg-[#1c1d29] border border-blue-900/10 rounded-2xl p-4 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-600/5 to-transparent rounded-full blur-xl"></div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span className="text-[10px] tracking-wider uppercase font-extrabold text-blue-400">AI DETAILED SUMMARY</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {meeting.summary}
                </p>
              </div>

              {/* People Present */}
              <div>
                <h4 className="text-[10px] tracking-wider uppercase font-bold text-slate-400 mb-2.5">PEOPLE PRESENT</h4>
                <div className="flex flex-wrap gap-2">
                  {(meeting.peoplePresent || ["Sarah Chen", "Marcus", "Emily", "You (Me)"]).map((person, i) => (
                    <span key={i} className="flex items-center gap-1.5 bg-[#141520] text-slate-300 px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-slate-800">
                      <div className="w-4 h-4 rounded-full bg-[#1a73e8] text-[9px] font-extrabold flex items-center justify-center text-white">
                        {person.split(" ").map(s => s[0]).join("").substring(0, 2).toUpperCase()}
                      </div>
                      {person}
                    </span>
                  ))}
                </div>
              </div>

              {/* Detailed Discussion Notes */}
              <div className="bg-[#13141f] border border-slate-900 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] tracking-wider uppercase font-extrabold text-emerald-400">DETAILED DISCUSSION FLOW</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap text-left">
                  {meeting.discussion || "The core agenda items and conversation segments were synthesized offline. Active brainstorming on product priorities occurred with input from all present members."}
                </p>
              </div>

              {/* Topics Covered */}
              {meeting.topicsCovered && meeting.topicsCovered.length > 0 && (
                <div>
                  <h4 className="text-[10px] tracking-wider uppercase font-bold text-slate-400 mb-2.5">KEY TOPICS DISCUSSED</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {meeting.topicsCovered.map((topic, i) => (
                      <span key={i} className="bg-[#1e202e] text-slate-300 px-3 py-1.5 rounded-full text-[11px] font-semibold border border-slate-800">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Actions & Decisions */}
            <div className="space-y-6">
              {/* Action Items List */}
              <div>
                <h4 className="text-[10px] tracking-wider uppercase font-bold text-slate-400 mb-3">ACTION ITEMS</h4>
                {meeting.actionItems && meeting.actionItems.length > 0 ? (
                  <div className="flex flex-col gap-2.5">
                    {meeting.actionItems.map((action, i) => (
                      <div
                        key={i}
                        onClick={() => onToggleActionItem(meeting.id, action.task, !action.completed)}
                        className={`flex items-start gap-3 bg-[#13141f] hover:bg-[#1a1b2a] p-3.5 rounded-2xl border transition cursor-pointer ${
                          action.completed ? "border-emerald-950/40 opacity-70" : "border-slate-800/80"
                        }`}
                      >
                        <div className="mt-0.5">
                          <CheckSquare className={`w-4 h-4 transition ${
                            action.completed ? "text-emerald-400" : "text-slate-600"
                          }`} />
                        </div>
                        <div className="flex-grow">
                          <p className={`text-xs font-semibold leading-relaxed ${action.completed ? "line-through text-slate-500 font-normal" : "text-slate-200"}`}>
                            {action.task}
                          </p>
                          <span className="inline-block text-[8px] tracking-wide bg-blue-900/10 text-blue-400 px-1.5 py-0.5 rounded-md border border-blue-900/20 mt-1.5 font-bold uppercase">
                            {action.assignee}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No action items decided.</p>
                )}
              </div>

              {/* Decisions List */}
              {meeting.decisions && meeting.decisions.length > 0 && (
                <div>
                  <h4 className="text-[10px] tracking-wider uppercase font-bold text-slate-400 mb-3">KEY DECISIONS MADE</h4>
                  <div className="flex flex-col gap-2.5">
                    {meeting.decisions.map((decision, i) => (
                      <div key={i} className="flex gap-3 bg-[#111e1e] border border-teal-950 p-4 rounded-2xl">
                        <div className="w-5 h-5 rounded-full bg-teal-900/20 border border-teal-800/30 flex items-center justify-center text-teal-400 text-[10px] font-extrabold shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        <p className="text-xs font-semibold text-slate-200 leading-relaxed">
                          {decision}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. TRANSCRIPT SECTION */}
        {activeSection === "transcript" && (
          <div className="space-y-4 animate-fade-in pr-1">
            <h4 className="text-[10px] tracking-wider uppercase font-bold text-slate-400 mb-1">CHRONOLOGICAL TRANSCRIPT</h4>
            {meeting.transcript && meeting.transcript.length > 0 ? (
              <div className="flex flex-col gap-3.5">
                {meeting.transcript.map((line, i) => (
                  <div key={i} className="flex gap-3 bg-[#13141f] border border-slate-900 rounded-2xl p-4">
                    {/* Circle Avatar */}
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${getSpeakerColorClass(line.speaker)}`}>
                      {getSpeakerInitials(line.speaker)}
                    </div>
                    {/* Body */}
                    <div className="flex-grow">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-extrabold text-white">{line.speaker}</span>
                        <span className="text-[9px] text-slate-500 font-mono">{line.timestamp}</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed font-normal">{line.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-10 text-center">No transcript recorded for this meeting.</p>
            )}
          </div>
        )}

        {/* 3. ASK AI CHAT SECTION */}
        {activeSection === "chat" && (
          <div className="flex flex-col h-full -mx-4 -my-4 animate-fade-in">
            {/* Logs area */}
            <div className="flex-grow overflow-y-auto px-4 py-4 space-y-4 min-h-[300px] flex flex-col justify-end">
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
                  <div className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
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
                    <span>AI is reading transcript...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <form onSubmit={handleSendMessage} className="p-4 bg-[#101117] border-t border-slate-800 flex gap-2">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder={`Ask AI about "${meeting.title}"...`}
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
      </div>
      </div>
    </div>
  );
}
