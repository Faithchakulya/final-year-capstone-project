import { ReactNode, useState } from "react";
import { ArrowLeft, BookOpen, Calendar, CheckSquare, Clock, Download, Sparkles, Users } from "lucide-react";
import { Meeting } from "../types";
import { avatarColor, initials } from "../lib/meeting";
import { downloadMinutesAsWord } from "../lib/exportWord";
import AskAI from "./AskAI";

interface MeetingDetailProps {
  meeting: Meeting;
  onBack: () => void;
  onToggleActionItem: (meetingId: string, task: string, completed: boolean) => void;
}

const SECTIONS = [
  { id: "summary", label: "Summary" },
  { id: "transcript", label: "Transcript" },
  { id: "chat", label: "Ask AI" },
] as const;

type Section = (typeof SECTIONS)[number]["id"];

function SectionHeading({ children }: { children: ReactNode }) {
  return <h4 className="text-[10px] tracking-wider uppercase font-bold text-slate-400 mb-2.5">{children}</h4>;
}

export default function MeetingDetail({ meeting, onBack, onToggleActionItem }: MeetingDetailProps) {
  const [section, setSection] = useState<Section>("summary");
  const transcriptText = meeting.transcript.map((l) => `${l.speaker}: ${l.text}`).join("\n");
  const people = meeting.peoplePresent ?? [];

  return (
    <div className="flex flex-col h-full w-full bg-[#0d0e12] text-slate-200 p-2.5 sm:p-4 relative overflow-y-auto pb-6">
      <div className="w-full max-w-4xl mx-auto flex flex-col flex-grow">
        <div className="flex items-center justify-between gap-3 mt-2 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onBack} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-white truncate">{meeting.title}</h2>
          </div>
          <button
            onClick={() => downloadMinutesAsWord(meeting)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs active:scale-95 cursor-pointer shrink-0"
            title="Download the minutes as a Word document"
          >
            <Download className="w-3.5 h-3.5" />
            Export Word
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6 bg-[#13141f] border border-slate-900 rounded-2xl p-3.5 text-center">
          {[
            { icon: <Calendar className="w-4 h-4" />, label: "Date", value: meeting.date },
            { icon: <Clock className="w-4 h-4" />, label: "Duration", value: meeting.duration },
            { icon: <Users className="w-4 h-4" />, label: "People", value: meeting.participantsCount },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center min-w-0">
              <span className="text-slate-500 mb-1">{item.icon}</span>
              <span className="text-[9px] text-slate-500 uppercase font-semibold">{item.label}</span>
              <span className="text-xs font-semibold text-white mt-0.5 truncate w-full px-1">{item.value}</span>
            </div>
          ))}
        </div>

        <div className="flex bg-[#181924] rounded-full p-1 mb-6 border border-slate-800/80">
          {SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`flex-1 py-2 text-xs font-semibold rounded-full transition cursor-pointer ${
                section === id ? "bg-[#1a73e8] text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-grow flex flex-col pb-4">
          {section === "summary" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start animate-fade-in">
              <div className="space-y-6">
                <div className="bg-[#1c1d29] rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3 text-blue-400">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-[10px] tracking-wider uppercase font-bold">Summary</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {meeting.summary || "This meeting was saved without an AI summary."}
                  </p>
                </div>

                {people.length > 0 && (
                  <div>
                    <SectionHeading>People present</SectionHeading>
                    <div className="flex flex-wrap gap-2">
                      {people.map((person) => (
                        <span key={person} className="flex items-center gap-1.5 bg-[#141520] text-slate-300 px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-slate-800">
                          <span className={`w-4 h-4 rounded-full ${avatarColor(person)} text-[8px] font-bold flex items-center justify-center text-white`}>
                            {initials(person)}
                          </span>
                          {person}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {meeting.discussion && (
                  <div className="bg-[#13141f] border border-slate-900 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3 text-emerald-400">
                      <BookOpen className="w-4 h-4" />
                      <span className="text-[10px] tracking-wider uppercase font-bold">Discussion</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{meeting.discussion}</p>
                  </div>
                )}

                {meeting.topicsCovered.length > 0 && (
                  <div>
                    <SectionHeading>Topics</SectionHeading>
                    <div className="flex flex-wrap gap-1.5">
                      {meeting.topicsCovered.map((topic) => (
                        <span key={topic} className="bg-[#1e202e] text-slate-300 px-3 py-1.5 rounded-full text-[11px] font-semibold border border-slate-800">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div>
                  <SectionHeading>Action items</SectionHeading>
                  {meeting.actionItems.length > 0 ? (
                    <div className="flex flex-col gap-2.5">
                      {meeting.actionItems.map((action) => (
                        <button
                          key={action.task}
                          onClick={() => onToggleActionItem(meeting.id, action.task, !action.completed)}
                          className={`flex items-start gap-3 text-left bg-[#13141f] hover:bg-[#1a1b2a] p-3.5 rounded-2xl border transition cursor-pointer ${
                            action.completed ? "border-emerald-950/40 opacity-70" : "border-slate-800/80"
                          }`}
                        >
                          <CheckSquare className={`w-4 h-4 mt-0.5 shrink-0 ${action.completed ? "text-emerald-400" : "text-slate-600"}`} />
                          <div>
                            <p className={`text-xs font-semibold leading-relaxed ${action.completed ? "line-through text-slate-500" : "text-slate-200"}`}>
                              {action.task}
                            </p>
                            <span className="inline-block text-[9px] bg-blue-900/10 text-blue-400 px-1.5 py-0.5 rounded-md border border-blue-900/20 mt-1.5 font-bold">
                              {action.assignee}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No action items.</p>
                  )}
                </div>

                {meeting.decisions.length > 0 && (
                  <div>
                    <SectionHeading>Decisions</SectionHeading>
                    <ol className="flex flex-col gap-2.5">
                      {meeting.decisions.map((decision, i) => (
                        <li key={i} className="flex gap-3 bg-[#111e1e] border border-teal-950 p-4 rounded-2xl">
                          <span className="w-5 h-5 rounded-full bg-teal-900/20 flex items-center justify-center text-teal-400 text-[10px] font-bold shrink-0">
                            {i + 1}
                          </span>
                          <p className="text-xs text-slate-200 leading-relaxed">{decision}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>
          )}

          {section === "transcript" && (
            <div className="flex flex-col gap-3.5 animate-fade-in">
              {meeting.transcript.length > 0 ? (
                meeting.transcript.map((line) => (
                  <div key={line.id} className="flex gap-3 bg-[#13141f] border border-slate-900 rounded-2xl p-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${avatarColor(line.speaker)}`}>
                      {initials(line.speaker)}
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold text-white">{line.speaker}</span>
                        <span className="text-[9px] text-slate-500 font-mono">{line.timestamp}</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{line.text}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 py-10 text-center">No transcript recorded for this meeting.</p>
              )}
            </div>
          )}

          {section === "chat" && (
            <div className="flex flex-col h-[60vh] min-h-[320px] bg-[#101117] border border-slate-900 rounded-2xl overflow-hidden animate-fade-in">
              <AskAI transcript={transcriptText} placeholder={`Ask about "${meeting.title}"...`} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
