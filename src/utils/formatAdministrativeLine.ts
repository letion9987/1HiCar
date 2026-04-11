/** 将省 / 市 / 区拼成行政地址文案（直辖市等 city 与 province 相同时去重） */
export function formatAdministrativeLine(parts: {
  province?: string;
  city?: string;
  district?: string;
}): string {
  const p = String(parts.province ?? "").trim();
  const c = String(parts.city ?? "").trim();
  const d = String(parts.district ?? "").trim();
  const out: string[] = [];
  if (p) out.push(p);
  if (c && c !== p) out.push(c);
  if (d) out.push(d);
  return out.join("");
}
