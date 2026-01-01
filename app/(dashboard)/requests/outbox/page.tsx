"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import useClaimsRole from "@/hooks/use-claims-role";
import type { InternalRequest } from "@/lib/internal-requests/types";
import { mapDataToInternalRequest } from "@/lib/internal-requests/firestore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getRecipientByKey } from "@/lib/internal-requests/recipients";
import { applyRequestFilters, defaultRequestsFilters } from "@/lib/internal-requests/filters";
import RequestsFiltersBar from "@/components/requests/RequestsFilters";
import { searchRequestsByTitleOnly } from "@/lib/internal-requests/search";
import RequestsSearchBar from "@/components/requests/RequestsSearchBar";

export default function OutboxPage() {
  const router = useRouter();
  const { uid, loading } = useClaimsRole();
  const [items, setItems] = useState<InternalRequest[]>([]);
  const [subscribed, setSubscribed] = useState(false);
  const [filters, setFilters] = useState(defaultRequestsFilters);
  const [q, setQ] = useState("");

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
      where("archived", "==", false),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: InternalRequest[] = [];
      snap.forEach((d) => list.push(mapDataToInternalRequest(d.id, d.data())));
      setItems(list);
      setSubscribed(true);
    },
      (err) => {
        if ((err as any)?.code === "permission-denied") return;
        console.error("snapshot error:", err);
      });

    return () => unsub();
  }, [loading, uid]);

  if (loading || !subscribed) {
    return (
      <div className="min-h-[40vh] grid place-items-center text-sm text-muted-foreground">
        جارٍ تحميل الصادر…
      </div>
    );
  }




  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>الصادر (طلباتي)</CardTitle>
        </CardHeader>
        <div className="px-6 pb-4">
          <RequestsSearchBar value={q} onChange={setQ} />
        </div>
        <div className="px-6 pb-4">
          <RequestsFiltersBar mode="outbox" value={filters} onChange={setFilters} />
        </div>
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {hasActiveFilters
                ? "لا توجد نتائج مطابقة للفلاتر الحالية."
                : "لم تقم بإنشاء أي طلبات بعد."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-right">رقم الطلب</th>
                    <th className="py-2 text-right">العنوان</th>
                    <th className="py-2 text-right">الحالة</th>
                    <th className="py-2 text-right">تاريخ الإنشاء</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredItems.map((r) => {
                    const toLabel =
                      (r as any).currentAssigneeLabel ||
                      ((r as any).currentAssigneeKey
                        ? getRecipientByKey((r as any).currentAssigneeKey)?.label
                        : null) ||
                      (r as any).mainRecipientLabel ||
                      ((r as any).mainRecipientKey
                        ? getRecipientByKey((r as any).mainRecipientKey)?.label
                        : null) ||
                      "—";

                    return (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 align-top font-mono">
                          {(r as any).requestNumber || "—"}
                        </td>

                        <td className="py-2 align-top font-medium">
                          {r.title}
                          <div className="text-xs text-muted-foreground mt-1">
                            إلى: {toLabel}
                          </div>
                        </td>

                        <td className="py-2 align-top">
                          <StatusBadge status={r.status} />
                        </td>

                        <td className="py-2 align-top text-xs text-muted-foreground">
                          {r.createdAt ? r.createdAt.toLocaleString("ar-SA") : "—"}
                        </td>

                        <td className="py-2 align-top text-left">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/requests/${r.id}`)}
                          >
                            فتح
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
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
  const label = labelMap[status] ?? status;

  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
      {label}
    </span>
  );
}
