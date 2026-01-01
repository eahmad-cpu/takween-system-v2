import type { InternalRequest } from "@/lib/internal-requests/types";

export function searchRequestsByTitleOnly(items: InternalRequest[], q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return items;
  return items.filter((r) => String(r.title ?? "").toLowerCase().includes(s));
}
