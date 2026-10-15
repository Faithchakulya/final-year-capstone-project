import { Meeting } from "../types";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function orderedList(items: string[], empty: string): string {
  if (items.length === 0) return `<p class="muted">${empty}</p>`;
  return `<ol>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`;
}

/** Downloads the meeting minutes as a .doc file (HTML that Word can open). */
export function downloadMinutesAsWord(meeting: Meeting) {
  const e = escapeHtml;
  const date = new Date(meeting.createdAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const actionRows = meeting.actionItems.length
    ? meeting.actionItems
        .map((a, i) => `<tr><td>${i + 1}</td><td>${e(a.task)}</td><td>${e(a.assignee)}</td></tr>`)
        .join("")
    : `<tr><td colspan="3" class="muted">No action items.</td></tr>`;

  const transcript = meeting.transcript.length
    ? meeting.transcript
        .map((l) => `<p><span class="muted">[${e(l.timestamp)}]</span> <b>${e(l.speaker)}:</b> ${e(l.text)}</p>`)
        .join("")
    : `<p class="muted">No transcript recorded.</p>`;

  const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${e(meeting.title)}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; color: #1e293b; line-height: 1.5; }
  h1 { font-size: 22pt; margin-bottom: 0; }
  h2 { font-size: 14pt; color: #1e3a8a; border-bottom: 1px solid #cbd5e1; margin-top: 24pt; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 10.5pt; text-align: left; }
  th { background: #e2e8f0; }
  .muted { color: #64748b; }
</style>
</head>
<body>
  <h1>${e(meeting.title)}</h1>
  <p class="muted">${e(date)}</p>
  <table>
    <tr><th>Duration</th><td>${e(meeting.duration)}</td></tr>
    <tr><th>People present</th><td>${e((meeting.peoplePresent ?? []).join(", ") || "-")}</td></tr>
    <tr><th>Topics</th><td>${e(meeting.topicsCovered.join(", ") || "-")}</td></tr>
  </table>

  <h2>Summary</h2>
  <p>${e(meeting.summary || "No summary.")}</p>

  ${meeting.discussion ? `<h2>Discussion</h2><p>${e(meeting.discussion)}</p>` : ""}

  <h2>Decisions</h2>
  ${orderedList(meeting.decisions, "No decisions recorded.")}

  <h2>Action items</h2>
  <table>
    <tr><th>#</th><th>Task</th><th>Assignee</th></tr>
    ${actionRows}
  </table>

  <h2>Transcript</h2>
  ${transcript}
</body>
</html>`;

  const blob = new Blob(["﻿" + html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `minutes_${meeting.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.doc`;
  link.click();
  URL.revokeObjectURL(url);
}
