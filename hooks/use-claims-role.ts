"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";

export type Role =
  | "employee"
  | "hr"
  | "chairman"
  | "ceo"
  | "admin"
  | "superadmin";

export type RecipientKey =
  | "chairman"
  | "ceo"
  | "finance"
  | "projects"
  | "maintenance"
  | "hr"
  | "platforms"
  | "collector"
  | "secretary"
  | "media_manager"
  | "designer"
  | "supervision_head"
  | "executive_assistant"
  | "admin_supervisor"
  | "edu_supervisor"
  | "athar_center"
  | "binaa_center";

type ClaimsState = {
  loading: boolean;
  uid: string | null;
  email: string | null;

  // صلاحية عامة (HR/CEO...)
  role: Role | null;

  // ✅ جهة المستخدم في نظام الطلبات (17 جهة)
  requestRecipientKey: RecipientKey | null;
  requestRecipientLabel: string | null;
  requestRecipientNumber: number | null;
};

export default function useClaimsRole(): ClaimsState {
  const [state, setState] = useState<ClaimsState>({
    loading: true,
    uid: null,
    email: null,
    role: null,
    requestRecipientKey: null,
    requestRecipientLabel: null,
    requestRecipientNumber: null,
  });

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        setState({
          loading: false,
          uid: null,
          email: null,
          role: null,
          requestRecipientKey: null,
          requestRecipientLabel: null,
          requestRecipientNumber: null,
        });
        return;
      }

      try {
        // اجبر تحديث التوكن عشان نقرأ الclaims الأحدث
        const token = await u.getIdTokenResult(true);

        const role = (token.claims?.role as Role | undefined) ?? null;

        const requestRecipientKey =
          (token.claims?.requestRecipientKey as RecipientKey | undefined) ?? null;

        const requestRecipientLabel =
          (token.claims?.requestRecipientLabel as string | undefined) ?? null;

        const rawNum = token.claims?.requestRecipientNumber;
        const requestRecipientNumber =
          typeof rawNum === "number" ? rawNum : rawNum ? Number(rawNum) : null;

        setState({
          loading: false,
          uid: u.uid,
          email: u.email ?? null,
          role,
          requestRecipientKey,
          requestRecipientLabel,
          requestRecipientNumber,
        });
      } catch {
        setState({
          loading: false,
          uid: u.uid,
          email: u.email ?? null,
          role: null,
          requestRecipientKey: null,
          requestRecipientLabel: null,
          requestRecipientNumber: null,
        });
      }
    });

    return () => unsub();
  }, []);

  return state;
}
