// app/api/fanout-request/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminServices } from "@/lib/server/firebaseAdmin";

const HR_ROLES = ["hr", "chairman", "ceo", "admin", "superadmin"] as const;

async function getRequester(req: NextRequest) {
  const { auth } = getAdminServices();

  // Bearer token فقط (خلّيناها واضحة)
  const authHeader = req.headers.get("authorization") || "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m?.[1]) return null;

  const decoded = await auth.verifyIdToken(m[1], true);
  return {
    uid: decoded.uid,
    role: (decoded.role as string | undefined) || "employee",
  };
}

async function getMyRecipientKey(uid: string) {
  const { db } = getAdminServices();
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return null;
  return (snap.data() as any)?.requestRecipientKey ?? null;
}

async function resolveUidsByRecipientKeys(keys: string[]) {
  const { db } = getAdminServices();
  const uniq = Array.from(new Set(keys.filter(Boolean)));

  if (uniq.length === 0) return [];

  // Firestore "in" حدها 10 قيم => نجزّئ
  const chunks: string[][] = [];
  for (let i = 0; i < uniq.length; i += 10) chunks.push(uniq.slice(i, i + 10));

  const uids = new Set<string>();
  for (const c of chunks) {
    const snap = await db
      .collection("users")
      .where("requestRecipientKey", "in", c)
      .get();
    snap.forEach((d) => uids.add(d.id));
  }

  return Array.from(uids);
}

export async function POST(req: NextRequest) {
  try {
    const requester = await getRequester(req);
    if (!requester) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const requestId = String(body?.requestId || "").trim();
    const toRecipientKeys = Array.isArray(body?.toRecipientKeys)
      ? (body.toRecipientKeys as string[])
      : [];
    const title = String(body?.title || "").trim();
    const msg = String(body?.body || "").trim();
    const link = String(body?.link || "").trim();

    if (!requestId || !title || !link || toRecipientKeys.length === 0) {
      return Response.json(
        { error: "Missing requestId/title/link/toRecipientKeys" },
        { status: 400 }
      );
    }

    // ✅ Authorization منطقي: لازم يكون منشئ الطلب أو HR+ أو الجهة الحالية
    const { db } = getAdminServices();
    const reqSnap = await db.collection("internalRequests").doc(requestId).get();
    if (!reqSnap.exists) {
      return Response.json({ error: "Request not found" }, { status: 404 });
    }
    const reqData = reqSnap.data() as any;

    const isHr =
      HR_ROLES.includes(requester.role as any);

    const myKey = await getMyRecipientKey(requester.uid);

    const can =
      isHr ||
      reqData?.createdByUid === requester.uid ||
      (myKey && reqData?.currentAssigneeKey === myKey);

    if (!can) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // ✅ Resolve recipients to uids
    const targetUids = await resolveUidsByRecipientKeys(toRecipientKeys);

    if (targetUids.length === 0) {
      return Response.json({ ok: true, sent: 0 });
    }

    const nowMs = Date.now();
    const nowTs = Timestamp.fromMillis(nowMs);

    const batch = db.batch();
    for (const uid of targetUids) {
      const ref = db.collection("users").doc(uid).collection("notifications").doc();
      batch.set(ref, {
        title,
        body: msg || "",
        type: "internal_request",
        link,
        createdAt: nowTs,
        createdAtMs: nowMs,
        read: false,
        requestId,
      });
    }

    await batch.commit();
    return Response.json({ ok: true, sent: targetUids.length });
  } catch (e: any) {
    console.error("fanout-request error:", e);
    return Response.json(
      { error: e?.message || "Fanout failed" },
      { status: 500 }
    );
  }
}
// app/api/fanout-request/route.ts