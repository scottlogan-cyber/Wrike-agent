const CALL_PATTERNS = [
  /call scheduled/i,
  /scheduled for/i,
  /calendar invite/i,
  /meeting on/i,
  /discovery call/i,
  /demo on/i,
  /kickoff on/i,
  /\b(mon|tue|wed|thu|fri|sat|sun)day\b.*\d{1,2}(:\d{2})?\s*(am|pm)?/i,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/i,
];

export function detectCallScheduling(text: string): boolean {
  return CALL_PATTERNS.some((p) => p.test(text));
}

export function detectMention(text: string): boolean {
  return /@scott\b/i.test(text) || /\bscott\b/i.test(text);
}

export function isCalendarAttachment(name: string): boolean {
  return name.toLowerCase().endsWith(".ics");
}
