export interface TranscriptLine {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
}

export interface ActionItem {
  assignee: string;
  task: string;
  completed?: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  createdAt: string;
  participantsCount: number;
  duration: string;
  transcript: TranscriptLine[];
  summary: string;
  topicsCovered: string[];
  actionItems: ActionItem[];
  decisions: string[];
  peoplePresent?: string[];
  discussion?: string;
}

/** A message in the "Ask AI" conversation about a meeting. */
export interface AssistantMessage {
  sender: "user" | "ai";
  text: string;
  timestamp: string;
}

/** A message in the in-call chat. */
export interface RoomChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
}

export interface RoomParticipant {
  id: string;
  name: string;
  phone: string;
  isMuted: boolean;
  isCameraOn: boolean;
  isHandRaised: boolean;
}
