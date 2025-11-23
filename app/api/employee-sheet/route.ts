// app/api/employee-sheet/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { google } from "googleapis";
import admin from "firebase-admin";

const HR_ROLES = ["hr", "chairman", "ceo", "admin", "superadmin"] as const;

// ✅ init firebase-admin مرة واحدة
function getAdminApp() {
  if (admin.apps.length) return admin.app();

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  const clientEmail =
    process.env.FIREBASE_CLIENT_EMAIL ||
    process.env.GOOGLE_CLIENT_EMAIL; // لو نفس الإيميل عندك

  const privateKey =
    (process.env.FIREBASE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY || "")
      .replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin env is missing");
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export async function GET(req: NextRequest) {
  try {
    // ===== 1) اقرأ nationalId من query =====
    const { searchParams } = new URL(req.url);
    const nationalId = searchParams.get("nationalId")?.trim();

    if (!nationalId) {
      return Response.json(
        { error: "nationalId مفقود في الـ query" },
        { status: 400 }
      );
    }

    // ===== 2) تحقق من هوية الطالب عبر Firebase ID Token =====
    const authHeader = req.headers.get("authorization") || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const idToken = match?.[1];

    if (!idToken) {
      return Response.json(
        { error: "Unauthorized: missing Bearer token" },
        { status: 401 }
      );
    }

    const app = getAdminApp();
    const decoded = await app.auth().verifyIdToken(idToken); // توثيق التوكن :contentReference[oaicite:0]{index=0}

    const requesterUid = decoded.uid;
    const requesterRole = (decoded.role as string | undefined) || "employee";
    const isHrOrAbove = HR_ROLES.includes(requesterRole as any);

    // ===== 3) لو مش HR: لازم الهوية المطلوبة = هوية المستخدم نفسه في Firestore =====
    if (!isHrOrAbove) {
      const userSnap = await app.firestore().doc(`users/${requesterUid}`).get();
      if (!userSnap.exists) {
        return Response.json(
          { error: "Requester user doc not found" },
          { status: 403 }
        );
      }

      const userData = userSnap.data() as any;

      // عندك الهوية داخل personalInfo.nationalId
      const myNationalId =
        (userData?.personalInfo?.nationalId ||
          userData?.nationalId ||
          "") + "";

      if (myNationalId.trim() !== nationalId) {
        return Response.json(
          { error: "Forbidden: nationalId لا يطابق حسابك" },
          { status: 403 }
        );
      }
    }

    // ===== 4) Google Sheets API (زي ما كان) =====
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const spreadsheetId =
      process.env.GOOGLE_SHEET_ID || "1FAKE_SPREADSHEET_ID_CHANGE_ME";

    if (!clientEmail || !privateKey) {
      return Response.json(
        { error: "بيئة Google Service Account غير مكتملة" },
        { status: 500 }
      );
    }

    const gAuth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth: gAuth });
    const range = `'رحلة الموظف'!A1:AZ1000`;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = res.data.values || [];
    if (rows.length === 0) {
      return Response.json({ error: "لا توجد بيانات في الشيت" }, { status: 404 });
    }

    const headers = rows[0].map((h: string) => (h || "").trim());
    const nationalIdIndex = headers.indexOf("nationalId");

    if (nationalIdIndex === -1) {
      return Response.json(
        { error: "لم يتم العثور على عمود nationalId في الشيت" },
        { status: 500 }
      );
    }

    const dataRow = rows.find(
      (row, idx) => idx > 0 && String(row[nationalIdIndex]).trim() === nationalId
    );

    if (!dataRow) {
      return Response.json(
        { error: "لم يتم العثور على موظف بهذا الرقم" },
        { status: 404 }
      );
    }

    const employee: Record<string, string> = {};
    headers.forEach((header, i) => {
      if (!header) return;
      employee[header] = (dataRow[i] ?? "").toString().trim();
    });

    return Response.json(
      { ok: true, nationalId, employee },
      { status: 200 }
    );
  } catch (err: any) {
  console.error("employee-sheet error:", err);
  return Response.json(
    { error: err?.message || String(err) || "Unknown server error" },
    { status: 500 }
  );
}

}
