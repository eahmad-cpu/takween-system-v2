export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const HR_ROLES = ["hr", "chairman", "ceo", "admin", "superadmin"] as const;

function getAdminServices() {
  if (!getApps().length) {
    const rawProjectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      "";

    const projectId = rawProjectId.replace(/["',\s]/g, "");
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        "Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY"
      );
    }

    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  return {
    auth: getAuth(),
    db: getFirestore(),
  };
}

async function getRequester(req: NextRequest) {
  const { auth } = getAdminServices();

  // 1) session cookie (لو موجود)
  const sessionCookie = req.cookies.get("session")?.value;
  if (sessionCookie) {
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    return {
      uid: decoded.uid,
      role: (decoded.role as string | undefined) || "employee",
    };
  }

  // 2) Bearer token
  const authHeader = req.headers.get("authorization") || "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (m?.[1]) {
    const decoded = await auth.verifyIdToken(m[1], true);
    return {
      uid: decoded.uid,
      role: (decoded.role as string | undefined) || "employee",
    };
  }

  return null;
}

function parseAudience(audTokens: string[]) {
  const schools: string[] = [];
  const units: string[] = [];
  const roles: string[] = [];
  const tags: string[] = [];
  const schoolTypes: string[] = [];

  for (const tok of audTokens) {
    if (tok.startsWith("schoolKey:")) schools.push(tok.split(":")[1]);
    else if (tok.startsWith("unit:")) units.push(tok.split(":")[1]);
    else if (tok.startsWith("role:")) roles.push(tok.split(":")[1]);
    else if (tok.startsWith("tag:")) tags.push(tok.split(":")[1]);
    else if (tok.startsWith("schoolType:")) schoolTypes.push(tok.split(":")[1]);
  }

  return { schools, units, roles, tags, schoolTypes };
}

async function resolveAudienceUserIds(audTokens: string[]) {
  const { db } = getAdminServices();
  const uids = new Set<string>();

  if (audTokens.includes("all:all")) {
    const snap = await db.collection("users").get();
    snap.forEach((d) => uids.add(d.id));
    return Array.from(uids);
  }

  const { schools, units, roles, tags, schoolTypes } =
    parseAudience(audTokens);

  const queries = [];

  for (const sk of schools)
    queries.push(db.collection("users").where("schoolKey", "==", sk));
  for (const u of units)
    queries.push(db.collection("users").where("unit", "==", u));
  for (const r of roles)
    queries.push(db.collection("users").where("role", "==", r));
  for (const t of tags)
    queries.push(db.collection("users").where("tags", "array-contains", t));
  for (const st of schoolTypes)
    queries.push(db.collection("users").where("schoolType", "==", st));

  const snaps = await Promise.all(queries.map((q) => q.get()));
  snaps.forEach((s) => s.forEach((d) => uids.add(d.id)));

  return Array.from(uids);
}

export async function POST(req: NextRequest) {
  try {
    const requester = await getRequester(req);
    if (!requester) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!HR_ROLES.includes(requester.role as any)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { title, audTokens, annId } = await req.json();
    if (!title || !Array.isArray(audTokens) || !annId) {
      return Response.json(
        { error: "Missing title/audTokens/annId" },
        { status: 400 }
      );
    }

    const { db } = getAdminServices();
    const userIds = await resolveAudienceUserIds(audTokens);

    if (userIds.length === 0) {
      return Response.json({ ok: true, sent: 0 });
    }

    const nowMs = Date.now();
    const nowTs = Timestamp.fromMillis(nowMs);

    const batch = db.batch();
    for (const uid of userIds) {
      const ref = db
        .collection("users")
        .doc(uid)
        .collection("notifications")
        .doc();

      batch.set(ref, {
        title: "تعميم جديد",
        body: title,
        type: "announcement",
        link: "/announcements",
        createdAt: nowTs,
        createdAtMs: nowMs,
        read: false,
        annId,
      });
    }

    await batch.commit();
    return Response.json({ ok: true, sent: userIds.length });
  } catch (e: any) {
    console.error("fanout-announcement error:", e);
    return Response.json(
      { error: e?.message || "Fanout failed" },
      { status: 500 }
    );
  }
}
