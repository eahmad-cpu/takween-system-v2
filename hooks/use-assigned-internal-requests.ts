"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import useClaimsRole from "@/hooks/use-claims-role";
import type { InternalRequest } from "@/lib/internal-requests/types";
import { mapDataToInternalRequest } from "@/lib/internal-requests/firestore";

type State = { loading: boolean; requests: InternalRequest[]; error?: string | null };

export function useAssignedInternalRequests(): State {
  const { loading: claimsLoading, role, uid, email } = useClaimsRole();
  // ✅ هترجع claim (لازم تكون ضايفها) — لو مش موجودة هتفضل null
  const myRecipientKey = (role as any)?.requestRecipientKey ?? null; // لو أنت ما بتعيدها من useClaimsRole، تجاهل السطر ده

  const [primary, setPrimary] = useState<InternalRequest[]>([]);
  const [cc, setCc] = useState<InternalRequest[]>([]);
  const [sub1, setSub1] = useState(false);
  const [sub2, setSub2] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (claimsLoading) return;

    // ⚠️ الأفضل: أنت ترجع requestRecipientKey من useClaimsRole نفسه بدل hack ده
    // لو مش متوفر عندك: استخدم صفحة inbox اللي بتقرأ من users/{uid}
    if (!uid) {
      setPrimary([]);
      setCc([]);
      setSub1(true);
      setSub2(true);
      return;
    }

    // هنا مفيش recipientKey => مفيش وارد
    if (!myRecipientKey) {
      setPrimary([]);
      setCc([]);
      setSub1(true);
      setSub2(true);
      return;
    }

    let u1: Unsubscribe | null = null;
    let u2: Unsubscribe | null = null;

    setSub1(false);
    setSub2(false);
    setError(null);

    const q1 = query(
      collection(db, "internalRequests"),
      where("currentAssigneeKey", "==", myRecipientKey),
      where("archived", "==", false),
      orderBy("createdAt", "desc")
    );

    u1 = onSnapshot(
      q1,
      (snap) => {
        const list: InternalRequest[] = snap.docs.map((d) =>
          mapDataToInternalRequest(d.id, d.data())
        );
        setPrimary(list);
        setSub1(true);
      },
      (err) => {
        setError(err?.message || "تعذر تحميل الوارد الأساسي");
        setSub1(true);
      }
    );

    const q2 = query(
      collection(db, "internalRequests"),
      where("ccRecipientKeys", "array-contains", myRecipientKey),
      where("archived", "==", false),
      orderBy("createdAt", "desc")
    );

    u2 = onSnapshot(
      q2,
      (snap) => {
        const list: InternalRequest[] = snap.docs.map((d) =>
          mapDataToInternalRequest(d.id, d.data())
        );
        setCc(list);
        setSub2(true);
      },
      (err) => {
        setError(err?.message || "تعذر تحميل النسخ (CC)");
        setSub2(true);
      }
    );

    return () => {
      u1?.();
      u2?.();
    };
  }, [claimsLoading, uid, myRecipientKey]);

  const requests = useMemo(() => {
    const map = new Map<string, InternalRequest>();
    for (const r of primary) map.set(r.id, r);
    for (const r of cc) if (!map.has(r.id)) map.set(r.id, r);

    const arr = Array.from(map.values());
    arr.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
    return arr;
  }, [primary, cc]);

  return { loading: claimsLoading || !(sub1 && sub2), requests, error };
}
