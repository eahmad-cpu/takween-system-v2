export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { isProfessionalDevelopmentManager } from "@/lib/professional-development";
import { getAdminServices } from "@/lib/server/firebaseAdmin";

type Requester = {
  uid: string;
  role: string;
};

function noStoreJson(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isSafeDocumentId(value: string) {
  return value.length > 0 && value.length <= 1500 && !value.includes("/");
}

function isSafeUid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    !value.includes("/")
  );
}

function documentTargetUids(value: Record<string, unknown>): string[] {
  const targetUids = Array.isArray(value.targetUids)
    ? value.targetUids.filter(isSafeUid)
    : [];
  const legacyEmployeeUid = isSafeUid(value.employeeUid) ? value.employeeUid : null;
  return legacyEmployeeUid
    ? Array.from(new Set([...targetUids, legacyEmployeeUid]))
    : Array.from(new Set(targetUids));
}

function getStorageBucketName() {
  return (
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    ""
  ).trim();
}

async function getRequester(req: NextRequest): Promise<Requester | null> {
  const authorization = req.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;

  try {
    const { auth } = getAdminServices();
    const decoded = await auth.verifyIdToken(match[1], true);
    return {
      uid: decoded.uid,
      role: (decoded.role as string | undefined) || "employee",
    };
  } catch {
    return null;
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const requester = await getRequester(req);
    if (!requester) return noStoreJson({ error: "غير مصرح" }, 401);

    const { documentId } = await context.params;
    if (!isSafeDocumentId(documentId)) {
      return noStoreJson({ error: "معرف المستند غير صالح" }, 400);
    }

    const { db, storage } = getAdminServices();
    const documentRef = db.collection("professionalDevelopmentDocuments").doc(documentId);
    const snapshot = await documentRef.get();
    if (!snapshot.exists) return noStoreJson({ error: "المستند غير موجود" }, 404);

    const document = snapshot.data() as Record<string, unknown>;
    const uploadedByUid = typeof document.uploadedByUid === "string" ? document.uploadedByUid : "";
    const source = document.source === "EMPLOYEE" ? "EMPLOYEE" : "ADMIN";
    const canManage = isProfessionalDevelopmentManager(requester.role);
    const canDeleteOwnUpload =
      documentTargetUids(document).includes(requester.uid) &&
      uploadedByUid === requester.uid &&
      source === "EMPLOYEE";

    if (!canManage && !canDeleteOwnUpload) {
      return noStoreJson({ error: "غير مصرح بحذف هذا المستند" }, 403);
    }

    const storagePath = typeof document.storagePath === "string" ? document.storagePath : "";
    const bucketName = getStorageBucketName();
    if (!bucketName) {
      return noStoreJson({ error: "إعدادات مساحة تخزين الملفات غير مكتملة" }, 500);
    }

    if (storagePath) {
      try {
        await storage.bucket(bucketName).file(storagePath).delete();
      } catch (storageError: unknown) {
        if ((storageError as { code?: number }).code !== 404) throw storageError;
      }
    }
    await documentRef.delete();

    return noStoreJson({ ok: true });
  } catch (error: unknown) {
    console.error("professional-development DELETE error:", error);
    return noStoreJson(
      {
        error:
          error instanceof Error ? error.message : "تعذر حذف ملف التطوير المهني",
      },
      500,
    );
  }
}
