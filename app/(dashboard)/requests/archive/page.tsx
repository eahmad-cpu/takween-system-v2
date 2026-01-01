"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";

import { db } from "@/lib/firebase";
import useClaimsRole from "@/hooks/use-claims-role";
import type { InternalRequest } from "@/lib/internal-requests/types";
import { mapDataToInternalRequest } from "@/lib/internal-requests/firestore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RequestsSearchBar from "@/components/requests/RequestsSearchBar";
import { searchRequestsByTitleOnly } from "@/lib/internal-requests/search";
import { applyRequestFilters, defaultRequestsFilters } from "@/lib/internal-requests/filters";
import RequestsFiltersBar from "@/components/requests/RequestsFilters";


export function searchRequestsByTitle(items: InternalRequest[], q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return items;
  return items.filter((r) => String(r.title ?? "").toLowerCase().includes(s));
}

export default function ArchivePage() {
  const router = useRouter();
  const { uid, loading } = useClaimsRole();
  const [items, setItems] = useState<InternalRequest[]>([]);
  const [subscribed, setSubscribed] = useState(false);
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState(defaultRequestsFilters);

  const filteredItems = useMemo(() => {
    const afterFilters = applyRequestFilters(items, filters, {
      mode: "outbox",
    });
    return searchRequestsByTitleOnly(afterFilters, q);
  }, [items, filters, q]);

  const hasActiveFilters =
    JSON.stringify(filters) !== JSON.stringify(defaultRequestsFilters);


  useEffect(() => {
    if (loading) return;
    if (!uid) return;

    const q = query(
      collection(db, "internalRequests"),
      where("createdByUid", "==", uid),
      where("archived", "==", true),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: InternalRequest[] = [];
        snap.forEach((doc) => list.push(mapDataToInternalRequest(doc.id, doc.data())));
        setItems(list);
        setSubscribed(true);
      },
      () => setSubscribed(true)
    );

    return () => unsub();
  }, [loading, uid]);

  if (loading || !subscribed) {
    return (
      <div className="min-h-[40vh] grid place-items-center text-sm text-muted-foreground">
        جارٍ تحميل الأرشيف…
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>الأرشيف</CardTitle>
        </CardHeader>
        <div className="px-6 pb-4">
          <RequestsSearchBar value={q} onChange={setQ} />
        </div>
        <div className="px-6 pb-4">
          <RequestsFiltersBar mode="archive" value={filters} onChange={setFilters} />
        </div>
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="text-sm text-muted-foreground">لا توجد طلبات مؤرشفة.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-right">رقم</th>
                    <th className="py-2 text-right">العنوان</th>
                    <th className="py-2 text-right">الحالة</th>
                    <th className="py-2 text-right">تاريخ</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r, idx) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 align-top">{idx + 1}</td>
                      <td className="py-2 align-top font-medium">{r.title}</td>
                      <td className="py-2 align-top">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-2 align-top text-xs text-muted-foreground">
                        {r.updatedAt ? r.updatedAt.toLocaleString("ar-SA") : (r.createdAt ? r.createdAt.toLocaleString("ar-SA") : "—")}
                      </td>
                      <td className="py-2 align-top text-left">
                        <Button size="sm" variant="outline" onClick={() => router.push(`/requests/${r.id}`)}>
                          فتح
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: InternalRequest["status"] }) {
  const labelMap: Record<string, string> = {
    open: "مفتوح",
    in_progress: "قيد المعالجة",
    approved: "معتمد",
    rejected: "مرفوض",
    closed: "مغلق",
    cancelled: "ملغي",
  };
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
      {labelMap[status] ?? status}
    </span>
  );
}
