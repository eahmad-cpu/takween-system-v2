export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { isProfessionalDevelopmentManager } from "@/lib/professional-development";
import { POSITION_LABELS } from "@/lib/internal-requests/creator-label";
import { getAdminServices } from "@/lib/server/firebaseAdmin";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function isManagementRequester(req: NextRequest): Promise<boolean> {
  const authorization = req.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return false;

  try {
    const { auth } = getAdminServices();
    const decoded = await auth.verifyIdToken(match[1], true);
    return isProfessionalDevelopmentManager(
      (decoded.role as string | undefined) || "employee",
    );
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!(await isManagementRequester(req))) {
      return Response.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { db } = getAdminServices();
    const snapshot = await db.collection("users").get();
    const employees = snapshot.docs.flatMap((document) => {
      const data = document.data() as Record<string, unknown>;
      const positionCode = asString(data.positionCode);
      return [
        {
          uid: document.id,
          name: asString(data.name) || asString(data.displayName) || "موظف",
          email: asString(data.email),
          position: POSITION_LABELS[positionCode] || asString(data.position),
        },
      ];
    });

    employees.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    return Response.json(
      { employees },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("professional-development employees GET error:", error);
    return Response.json(
      { error: "تعذر تحميل قائمة الموظفين" },
      { status: 500 },
    );
  }
}
