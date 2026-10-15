import { useEffect, useRef, useState } from "react";

const BAR_COUNT = 7;
const VIDEO_CONSTRAINTS: MediaTrackConstraints = { width: 640, height: 480, facingMode: "user" };

/**
 * Opens the camera and microphone and exposes the stream plus live mic levels.
 *
 * Turning the camera off stops the video track (releasing the camera), and
 * turning it on requests a new one. Only pausing the track leaves a frozen or
 * black picture on some phones when it is resumed.
 */
export function useLocalMedia(isMuted: boolean, isCameraOn: boolean) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraWanted = useRef(isCameraOn);
  cameraWanted.current = isCameraOn;

  const publish = (next: MediaStream) => {
    streamRef.current = next;
    setStream(next);
  };

  useEffect(() => {
    let active = true;
    let audioCtx: AudioContext | null = null;
    let frame = 0;

    async function open() {
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: cameraWanted.current ? VIDEO_CONSTRAINTS : false,
        });
      } catch {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
          console.warn("Microphone access failed:", err);
          setError("Microphone access was denied, so others can't hear you and nothing will be transcribed.");
          return;
        }
      }

      if (!active) {
        mediaStream.getTracks().forEach((t) => t.stop());
        return;
      }
      publish(mediaStream);

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      audioCtx = new AudioContextClass() as AudioContext;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 32;
      audioCtx.createMediaStreamSource(new MediaStream(mediaStream.getAudioTracks())).connect(analyser);
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
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    stream?.getAudioTracks().forEach((t) => (t.enabled = !isMuted));
  }, [stream, isMuted]);

  // Start or stop the camera when it is toggled.
  useEffect(() => {
    const current = streamRef.current;
    if (!current) return;
    const audio = current.getAudioTracks();
    const video = current.getVideoTracks().filter((t) => t.readyState === "live");

    if (!isCameraOn && video.length > 0) {
      video.forEach((t) => t.stop());
      publish(new MediaStream(audio));
      return;
    }

    if (isCameraOn && video.length === 0) {
      let cancelled = false;
      navigator.mediaDevices
        .getUserMedia({ video: VIDEO_CONSTRAINTS })
        .then((camera) => {
          if (cancelled || !cameraWanted.current) {
            camera.getTracks().forEach((t) => t.stop());
            return;
          }
          publish(new MediaStream([...audio, ...camera.getVideoTracks()]));
        })
        .catch((err) => {
          console.warn("Camera access failed:", err);
          setError("Couldn't start the camera.");
        });
      return () => {
        cancelled = true;
      };
    }
  }, [isCameraOn, stream]);

  const hasVideo = Boolean(stream?.getVideoTracks().some((t) => t.readyState === "live"));
  return { stream, hasVideo, audioLevels, error };
}
