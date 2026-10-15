export interface TranscriptLine {
  speaker: string;
  text: string;
  timestamp: string; // e.g. "10:32 AM" or "+0:15"
  id: string;
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
  createdAt: string; // ISO String
  participantsCount: number;
  duration: string; // e.g., "32m"
  transcript: TranscriptLine[];
  summary: string;
  topicsCovered: string[];
  actionItems: ActionItem[];
  decisions: string[];
  // Extended fields for full AI-generated minutes
  peoplePresent?: string[];
  discussion?: string;
}

export interface ChatMessage {
  sender: "user" | "ai";
  text: string;
  timestamp: string;
}
