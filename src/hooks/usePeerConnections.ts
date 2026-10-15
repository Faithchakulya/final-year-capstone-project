import { useEffect, useRef, useState } from "react";
import { RoomParticipant } from "../types";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

interface Peer {
  pc: RTCPeerConnection;
  pendingCandidates: RTCIceCandidateInit[];
}

export interface SignalMessage {
  from: string;
  data: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
}

/**
 * Sends our audio/video to every other participant and receives theirs, using
 * one RTCPeerConnection per pair (a mesh, fine for small meetings).
 *
 * To avoid both sides offering at once, the participant with the smaller id
 * always makes the offer. The offerer creates an audio and a video transceiver
 * up front, so tracks can be swapped in later with replaceTrack (e.g. when the
 * camera finishes starting) without renegotiating.
 */
export function usePeerConnections(
  selfId: string,
  remoteParticipants: RoomParticipant[],
  localStream: MediaStream | null,
  sendSignal: (to: string, data: SignalMessage["data"]) => void
) {
  const peers = useRef(new Map<string, Peer>());
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const streamRef = useRef(localStream);
  streamRef.current = localStream;
  const sendRef = useRef(sendSignal);
  sendRef.current = sendSignal;

  const attachLocalTracks = (pc: RTCPeerConnection) => {
    const stream = streamRef.current;
    for (const transceiver of pc.getTransceivers()) {
      const kind = transceiver.receiver.track.kind;
      const track = stream?.getTracks().find((t) => t.kind === kind) ?? null;
      if (transceiver.sender.track !== track) {
        transceiver.sender.replaceTrack(track).catch((err) => console.warn("replaceTrack failed:", err));
      }
    }
  };

  const removePeer = (id: string) => {
    peers.current.get(id)?.pc.close();
    peers.current.delete(id);
    setRemoteStreams((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const createPeer = (remoteId: string): Peer => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer: Peer = { pc, pendingCandidates: [] };
    peers.current.set(remoteId, peer);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) sendRef.current(remoteId, { candidate: candidate.toJSON() });
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      setRemoteStreams((prev) => {
        const existing = prev[remoteId];
        if (existing && existing !== stream) {
          existing.addTrack(event.track);
          return { ...prev };
        }
        return { ...prev, [remoteId]: existing ?? stream };
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") console.warn(`Connection to ${remoteId} failed`);
    };

    return peer;
  };

  const startCall = async (remoteId: string) => {
    const { pc } = createPeer(remoteId);
    // A stream id lets the other side group audio and video together.
    const groupingStream = new MediaStream();
    pc.addTransceiver("audio", { direction: "sendrecv", streams: [groupingStream] });
    pc.addTransceiver("video", { direction: "sendrecv", streams: [groupingStream] });
    attachLocalTracks(pc);
    await pc.setLocalDescription(await pc.createOffer());
    sendRef.current(remoteId, { description: pc.localDescription!.toJSON() });
  };

  const handleSignal = async ({ from, data }: SignalMessage) => {
    try {
      if (data.description) {
        const { description } = data;
        if (description.type === "offer") {
          removePeer(from);
          const peer = createPeer(from);
          await peer.pc.setRemoteDescription(description);
          for (const transceiver of peer.pc.getTransceivers()) transceiver.direction = "sendrecv";
          attachLocalTracks(peer.pc);
          await peer.pc.setLocalDescription(await peer.pc.createAnswer());
          sendRef.current(from, { description: peer.pc.localDescription!.toJSON() });
          await flushCandidates(peer);
        } else {
          const peer = peers.current.get(from);
          if (!peer) return;
          await peer.pc.setRemoteDescription(description);
          await flushCandidates(peer);
        }
      } else if (data.candidate) {
        const peer = peers.current.get(from);
        if (!peer) return;
        if (peer.pc.remoteDescription) {
          await peer.pc.addIceCandidate(data.candidate);
        } else {
          peer.pendingCandidates.push(data.candidate);
        }
      }
    } catch (err) {
      console.warn("Failed to handle signal from", from, err);
    }
  };

  const flushCandidates = async (peer: Peer) => {
    for (const candidate of peer.pendingCandidates.splice(0)) {
      await peer.pc.addIceCandidate(candidate).catch((err) => console.warn("addIceCandidate failed:", err));
    }
  };

  // Connect to new participants and drop the ones who left.
  const remoteIds = remoteParticipants.map((p) => p.id).sort().join(",");
  useEffect(() => {
    const present = new Set(remoteParticipants.map((p) => p.id));
    for (const id of [...peers.current.keys()]) {
      if (!present.has(id)) removePeer(id);
    }
    for (const id of present) {
      if (!peers.current.has(id) && selfId < id) {
        startCall(id).catch((err) => console.warn("Failed to call", id, err));
      }
    }
  }, [remoteIds, selfId]);

  // Send the camera/mic once they are ready (or after they change).
  useEffect(() => {
    for (const { pc } of peers.current.values()) attachLocalTracks(pc);
  }, [localStream]);

  useEffect(() => {
    const current = peers.current;
    return () => {
      for (const { pc } of current.values()) pc.close();
      current.clear();
    };
  }, []);

  return { remoteStreams, handleSignal };
}
