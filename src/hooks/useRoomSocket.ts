import { useEffect, useRef, useState } from "react";
import { RoomChatMessage, RoomParticipant, TranscriptLine } from "../types";
import type { SignalMessage } from "./usePeerConnections";

interface Self {
  id: string;
  name: string;
  phone: string;
  isMuted: boolean;
  isCameraOn: boolean;
}

interface Handlers {
  onTranscriptLine: (line: TranscriptLine) => void;
  onReaction: (emoji: string, senderName: string) => void;
  onChatMessage: (message: RoomChatMessage) => void;
  onSignal: (message: SignalMessage) => void;
}

/** Connects to the room over WebSocket and keeps the participant list in sync. */
export function useRoomSocket(roomId: string, self: Self, handlers: Handlers) {
  const socketRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const selfRef = useRef(self);
  selfRef.current = self;

  const [participants, setParticipants] = useState<RoomParticipant[]>([]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    socketRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join-room", roomId, participant: selfRef.current }));
    };

    ws.onmessage = (event) => {
      let message: any;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      switch (message.type) {
        case "room-participants":
          setParticipants(message.participants);
          break;
        case "receive-transcript-line":
          handlersRef.current.onTranscriptLine(message.line);
          break;
        case "receive-reaction":
          handlersRef.current.onReaction(message.reaction, message.senderName);
          break;
        case "receive-chat-message":
          handlersRef.current.onChatMessage(message.message);
          break;
        case "signal":
          handlersRef.current.onSignal(message);
          break;
      }
    };

    ws.onerror = (err) => console.error("WebSocket error:", err);

    return () => {
      ws.close();
      socketRef.current = null;
    };
  }, [roomId]);

  const send = (payload: object) => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  };

  useEffect(() => {
    send({ type: "update-state", isMuted: self.isMuted, isCameraOn: self.isCameraOn });
  }, [self.isMuted, self.isCameraOn]);

  const remoteParticipants = participants.filter((p) => p.id !== self.id);
  return { send, remoteParticipants };
}
