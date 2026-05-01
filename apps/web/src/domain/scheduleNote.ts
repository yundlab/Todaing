export function encodeScheduleNote(peopleCsv: string, memo: string): string | null {
  const people = peopleCsv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const memoT = memo.trim();
  if (!people.length && !memoT) return null;
  const lines: string[] = [];
  if (people.length) lines.push(`함께:${people.join(",")}`);
  if (memoT) lines.push(`메모:${memoT}`);
  return lines.join("\n");
}

export function parseScheduleNote(raw: string | null | undefined): {
  people: string[];
  memo: string | null;
} {
  if (!raw?.trim()) return { people: [], memo: null };
  const text = raw.trim();
  const lines = text.split("\n");
  const people: string[] = [];
  let memo: string | null = null;
  let hadStructured = false;

  for (const line of lines) {
    if (line.startsWith("함께:")) {
      hadStructured = true;
      const rest = line.slice("함께:".length);
      people.push(...rest.split(",").map((s) => s.trim()).filter(Boolean));
    } else if (line.startsWith("메모:")) {
      hadStructured = true;
      const m = line.slice("메모:".length).trim();
      memo = m || null;
    }
  }

  if (!hadStructured) {
    return { people: [], memo: text };
  }
  return { people, memo };
}
