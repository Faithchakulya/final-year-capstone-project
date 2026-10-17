import { test } from "node:test";
import assert from "node:assert/strict";
import { avatarColor, extractMeetingId, formatDuration, generateMeetingId, initials } from "../src/lib/meeting.ts";

test("extractMeetingId accepts codes and links in different forms", () => {
  const cases: [string, string][] = [
    ["abc-defg-hij", "abc-defg-hij"],
    ["  ABC-DEFG-HIJ  ", "abc-defg-hij"],
    ["https://192.168.1.20:3000/?join=abc-defg-hij", "abc-defg-hij"],
    ["Join my meeting: http://x.com/?join=abc-defg-hij&utm=1", "abc-defg-hij"],
    ["http://localhost:3000/?join=custom%20room", "custom room"],
    ["https://site/abc", "abc"],
    ["", ""],
    ["   ", ""],
  ];
  for (const [input, expected] of cases) {
    assert.equal(extractMeetingId(input), expected, `input ${JSON.stringify(input)}`);
  }
});

test("generateMeetingId produces xxx-xxxx-xxx codes that are not repeated", () => {
  const codes = new Set(Array.from({ length: 200 }, generateMeetingId));
  for (const code of codes) assert.match(code, /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/);
  assert.ok(codes.size > 195, "codes should be effectively unique");
});

test("initials uses up to two letters and copes with odd input", () => {
  assert.equal(initials("Faith Chakulya"), "FC");
  assert.equal(initials("Maximilian Alexander Wolfgang"), "MA");
  assert.equal(initials("ana"), "A");
  assert.equal(initials("   "), "?");
});

test("avatarColor is stable for a name", () => {
  assert.equal(avatarColor("Faith"), avatarColor("Faith"));
  assert.match(avatarColor("Godwin"), /^bg-/);
});

test("formatDuration shows minutes and seconds", () => {
  assert.equal(formatDuration(0), "00:00");
  assert.equal(formatDuration(75), "01:15");
  assert.equal(formatDuration(3600), "60:00");
});
