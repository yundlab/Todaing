export function encodeScheduleNote(
  peopleCsv: string,
  memo: string,
  detail: string = ""
): string | null {
  const people = peopleCsv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const memoT = memo.trim();
  const detailT = detail.trim();
  if (!people.length && !memoT && !detailT) return null;
  const lines: string[] = [];
  if (people.length) lines.push(`함께:${people.join(",")}`);
  if (memoT) lines.push(`메모:${memoT}`);
  if (detailT) lines.push(`세부:${detailT}`);
  return lines.join("\n");
}

export function parseScheduleNote(raw: string | null | undefined): {
  people: string[];
  memo: string | null;
  detail: string | null;
} {
  if (!raw?.trim()) return { people: [], memo: null, detail: null };
  const text = raw.trim();
  const lines = text.split("\n");
  const people: string[] = [];
  let memo: string | null = null;
  let detail: string | null = null;
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
    } else if (line.startsWith("세부:")) {
      hadStructured = true;
      const d = line.slice("세부:".length).trim();
      detail = d || null;
    }
  }

  if (!hadStructured) {
    return { people: [], memo: text, detail: null };
  }
  return { people, memo, detail };
}
