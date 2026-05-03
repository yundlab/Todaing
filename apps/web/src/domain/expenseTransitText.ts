/** 세부 내용에서 노출용으로 경로 접두어를 뗀다. */
export function stripTransitRoutePrefix(detail: string, transitFrom: string | null, transitTo: string | null) {
  const d = (detail ?? "").trim();
  if (!d) return detail;
  const from = (transitFrom ?? "").trim();
  const to = (transitTo ?? "").trim();
  const route = from && to ? `${from} → ${to}` : "";
  if (!route) return detail;
  const prefix1 = `${route} · `;
  const prefix2 = `${route}·`;
  if (d.startsWith(prefix1)) return d.slice(prefix1.length);
  if (d.startsWith(prefix2)) return d.slice(prefix2.length);
  return detail;
}
