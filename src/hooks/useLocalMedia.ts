import { useEffect, useState } from "react";

const BAR_COUNT = 7;

/**
 * Opens the camera and microphone and exposes the stream plus live mic levels.
 * Falls back to audio only if the camera is unavailable.
 */
export function useLocalMedia(isMuted: boolean, isCameraOn: boolean) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let mediaStream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let frame = 0;

    async function open() {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: 640, height: 480, facingMode: "user" },
        });
      } catch {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
          console.warn("Microphone access failed:", err);
          setError("Microphone access was denied, so nothing will be transcribed.");
          return;
        }
      }

      if (!active) {
        mediaStream.getTracks().forEach((t) => t.stop());
        return;
      }
      setStream(mediaStream);

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      audioCtx = new AudioContextClass() as AudioContext;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 32;
      audioCtx.createMediaStreamSource(mediaStream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!active) return;
        analyser.getByteFrequencyData(data);
        setAudioLevels(
          Array.from({ length: BAR_COUNT }, (_, i) => {
            const value = data[Math.floor((i / BAR_COUNT) * data.length)] || 0;
            return Math.floor((value / 255) * 35) + 5;
          })
        );
        frame = requestAnimationFrame(tick);
      };
      tick();
    }

    open();

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      audioCtx?.close().catch(() => {});
      mediaStream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    stream?.getAudioTracks().forEach((t) => (t.enabled = !isMuted));
  }, [stream, isMuted]);

  useEffect(() => {
    stream?.getVideoTracks().forEach((t) => (t.enabled = isCameraOn));
  }, [stream, isCameraOn]);

  const hasVideo = Boolean(stream?.getVideoTracks().length);
  return { stream, hasVideo, audioLevels, error };
}
