const CODE_PATTERN = /[a-z]{3}-[a-z]{4}-[a-z]{3}/i;

const AVATAR_COLORS = [
  "bg-emerald-600",
  "bg-amber-600",
  "bg-pink-600",
  "bg-indigo-600",
  "bg-cyan-600",
  "bg-purple-600",
  "bg-red-500",
  "bg-teal-600",
];

/** Pulls a meeting code out of a pasted code or share link. */
export function extractMeetingId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(CODE_PATTERN);
  if (match) return match[0].toLowerCase();
  const joinParam = trimmed.match(/[?&]join=([^&]+)/);
  if (joinParam) return decodeURIComponent(joinParam[1]);
  return trimmed.slice(trimmed.lastIndexOf("/") + 1).trim();
}

/** Generates a code like "xhe-xual-fta". */
export function generateMeetingId(): string {
  const letters = (n: number) =>
    Array.from({ length: n }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("");
  return `${letters(3)}-${letters(4)}-${letters(3)}`;
}

export function meetingLink(code: string): string {
  return `${window.location.origin}/?join=${encodeURIComponent(code)}`;
}

export function randomId(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export function avatarColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function clockTime(date = new Date()): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
