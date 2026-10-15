export type SoundType = "join" | "leave" | "mute" | "unmute" | "click";

// Each sound is a short sequence of oscillator notes.
const SOUNDS: Record<SoundType, { wave: OscillatorType; notes: number[]; step: number; volume: number; length: number }> = {
  join: { wave: "sine", notes: [440, 554.37, 659.25, 880], step: 0.08, volume: 0.12, length: 0.45 },
  leave: { wave: "sine", notes: [783.99, 659.25, 523.25], step: 0.08, volume: 0.12, length: 0.4 },
  mute: { wave: "triangle", notes: [320, 240], step: 0.06, volume: 0.08, length: 0.12 },
  unmute: { wave: "triangle", notes: [240, 360], step: 0.06, volume: 0.08, length: 0.12 },
  click: { wave: "sine", notes: [600], step: 0, volume: 0.04, length: 0.05 },
};

export function playSound(type: SoundType) {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const ctx: AudioContext = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const { wave, notes, step, volume, length } = SOUNDS[type];
    const now = ctx.currentTime;
    osc.type = wave;
    notes.forEach((freq, i) => osc.frequency.setValueAtTime(freq, now + i * step));
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + length);
    osc.start(now);
    osc.stop(now + length);
    osc.onended = () => ctx.close();
  } catch {
    // Browsers can block audio before the first user interaction.
  }
}
