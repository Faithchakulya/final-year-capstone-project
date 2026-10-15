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
  const [status, setStatus] = useState<"connecting" | "connected" | "reconnecting">("connecting");

  useEffect(() => {
    let closedByUs = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      socketRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setStatus("connected");
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

      // Keep retrying (1s, 2s, ... up to 5s) so a Wi-Fi blip or server restart doesn't end the call.
      ws.onclose = () => {
        if (closedByUs) return;
        setStatus("reconnecting");
        setParticipants([]);
        retryTimer = setTimeout(connect, Math.min(1000 * ++attempt, 5000));
      };
    };

    connect();

    return () => {
      closedByUs = true;
      clearTimeout(retryTimer);
      socketRef.current?.close();
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
  return { send, remoteParticipants, status };
}
