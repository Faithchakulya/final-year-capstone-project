import { useEffect, useState } from "react";
import { Meeting } from "./types";
import { extractMeetingId, generateMeetingId } from "./lib/meeting";
import Home from "./components/Home";
import RegisterUser from "./components/RegisterUser";
import StartCall from "./components/StartCall";
import JoinModal from "./components/JoinModal";
import MeetingRoom from "./components/MeetingRoom";
import MeetingDetail from "./components/MeetingDetail";

type View = "home" | "register" | "start-call" | "meeting" | "detail";

export default function App() {
  const [view, setView] = useState<View>("home");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);

  const [userName, setUserName] = useState(() => localStorage.getItem("user_name") || "");
  const [userPhone, setUserPhone] = useState(() => localStorage.getItem("user_phone") || "");

  const [activeMeetingId, setActiveMeetingId] = useState("");
  const [activeMeetingTitle, setActiveMeetingTitle] = useState("");
  // Set when someone joins by code before entering their name.
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((config) => setHasApiKey(config.hasApiKey))
      .catch((err) => console.error("Failed to load config:", err));

    fetch("/api/meetings")
      .then((res) => res.json())
      .then(setMeetings)
      .catch((err) => console.error("Failed to load meetings:", err));

    const joinCode = new URLSearchParams(window.location.search).get("join");
    if (joinCode) {
      window.history.replaceState(null, "", window.location.pathname);
      joinByCode(joinCode);
    }
  }, []);

  const updateActionItem = (meeting: Meeting, task: string, completed: boolean): Meeting => ({
    ...meeting,
    actionItems: meeting.actionItems.map((a) => (a.task === task ? { ...a, completed } : a)),
  });

  const handleToggleActionItem = async (meetingId: string, task: string, completed: boolean) => {
    setMeetings((prev) => prev.map((m) => (m.id === meetingId ? updateActionItem(m, task, completed) : m)));
    setSelectedMeeting((prev) => (prev && prev.id === meetingId ? updateActionItem(prev, task, completed) : prev));

    try {
      await fetch(`/api/meetings/${meetingId}/actions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, completed }),
      });
    } catch (err) {
      console.error("Failed to update action item:", err);
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    setMeetings((prev) => prev.filter((m) => m.id !== id));
    try {
      await fetch(`/api/meetings/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to delete meeting:", err);
    }
  };

  const nextMeetingTitle = () => `Meeting ${meetings.length + 1}`;

  const handleStartNewMeeting = () => {
    setActiveMeetingId(generateMeetingId());
    setActiveMeetingTitle(nextMeetingTitle());
    setView("register");
  };

  const handleRegisterContinue = (name: string, phone: string) => {
    setUserName(name);
    setUserPhone(phone);
    localStorage.setItem("user_name", name);
    localStorage.setItem("user_phone", phone);
    if (pendingJoinCode) {
      setActiveMeetingId(pendingJoinCode);
      setPendingJoinCode(null);
      setView("meeting");
    } else {
      setView("start-call");
    }
  };

  function joinByCode(input: string) {
    const code = extractMeetingId(input);
    if (!code) return;
    setActiveMeetingId(code);
    setActiveMeetingTitle(nextMeetingTitle());
    if (localStorage.getItem("user_name")) {
      setView("meeting");
    } else {
      setPendingJoinCode(code);
      setView("register");
    }
  }

  const enterMeeting = () => {
    setShowJoinModal(false);
    setView("meeting");
  };

  const handleLeaveMeeting = (meeting: Meeting) => {
    setMeetings((prev) => [meeting, ...prev]);
    setView("home");
  };

  return (
    <div className="min-h-screen bg-[#07080b] flex flex-col items-center justify-center p-0.5 sm:p-2 md:p-3">
      <div className="w-full max-w-[1360px] h-screen md:h-[880px] md:max-h-[96vh] bg-[#0d0e12] md:rounded-3xl shadow-2xl overflow-hidden flex flex-col relative md:border md:border-slate-800/40">
        {view === "home" && (
          <Home
            meetings={meetings}
            hasApiKey={hasApiKey}
            onStartNew={handleStartNewMeeting}
            onJoinCode={joinByCode}
            onViewMeeting={(meeting) => {
              setSelectedMeeting(meeting);
              setView("detail");
            }}
            onDeleteMeeting={handleDeleteMeeting}
          />
        )}

        {view === "register" && (
          <RegisterUser
            onClose={() => setView("home")}
            onContinue={handleRegisterContinue}
            initialName={userName}
            initialPhone={userPhone}
          />
        )}

        {view === "start-call" && (
          <StartCall
            onClose={() => setView("home")}
            onCreateLink={() => setShowJoinModal(true)}
            onStartCall={enterMeeting}
          />
        )}

        {view === "meeting" && (
          <MeetingRoom
            meetingId={activeMeetingId}
            meetingTitle={activeMeetingTitle}
            userName={userName}
            userPhone={userPhone}
            onLeave={handleLeaveMeeting}
            onCancel={() => setView("home")}
          />
        )}

        {view === "detail" && selectedMeeting && (
          <MeetingDetail meeting={selectedMeeting} onBack={() => setView("home")} onToggleActionItem={handleToggleActionItem} />
        )}

        {showJoinModal && (
          <JoinModal meetingCode={activeMeetingId} onClose={() => setShowJoinModal(false)} onJoin={enterMeeting} />
        )}
      </div>
    </div>
  );
}
