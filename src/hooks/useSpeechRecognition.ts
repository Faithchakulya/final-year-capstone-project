import { useEffect, useRef, useState } from "react";

interface Handlers {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
}

/**
 * Runs the browser's Web Speech API while `active` is true and restarts it
 * when the browser ends a session on its own.
 */
export function useSpeechRecognition(active: boolean, handlers: Handlers) {
  const [error, setError] = useState<string | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!active) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition isn't supported in this browser. Use Chrome or Edge.");
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    let stopped = false;

    rec.onresult = (e: any) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += text;
        else interim += text;
      }
      if (final.trim()) handlersRef.current.onFinal(final.trim());
      else if (interim.trim()) handlersRef.current.onInterim(interim.trim());
    };

    rec.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        stopped = true;
        setError("Microphone permission was denied, so speech can't be transcribed.");
      }
    };

    rec.onend = () => {
      if (stopped) return;
      try {
        rec.start();
      } catch {
        // Already started.
      }
    };

    try {
      rec.start();
    } catch (err) {
      console.warn("Could not start speech recognition:", err);
    }

    return () => {
      stopped = true;
      rec.onend = null;
      rec.stop();
    };
  }, [active]);

  return { error };
}
