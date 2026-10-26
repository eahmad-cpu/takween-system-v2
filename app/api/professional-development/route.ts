export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
  PROFESSIONAL_DEVELOPMENT_MAX_PDF_SIZE_BYTES,
  isProfessionalDevelopmentCategory,
  isProfessionalDevelopmentManager,
} from "@/lib/professional-development";
import { getAdminServices } from "@/lib/server/firebaseAdmin";

const SIGNED_URL_TTL_MS = 30 * 60 * 1000;

type Requester = {
  uid: string;
  role: string;
};

type ProfessionalDevelopmentDocument = {
  id: string;
  title: string;
  category: string;
  originalFileName: string;
  fileSize: number;
  contentType: string;
  source: "ADMIN" | "EMPLOYEE";
  uploadedByUid: string;
  uploadedByRole: string;
  createdAt: string | null;
  updatedAt: string | null;
  fileUrl?: string;
  canDelete?: boolean;
};

function noStoreJson(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isSafeUid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    !value.includes("/")
  );
}

function uniqueTargetUids(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const targetUids = Array.from(new Set(value));
  return targetUids.every(isSafeUid) ? targetUids : null;
}

function documentTargetUids(value: Record<string, unknown>): string[] {
  const targetUids = uniqueTargetUids(value.targetUids) ?? [];
  const legacyEmployeeUid = isSafeUid(value.employeeUid) ? value.employeeUid : null;
  return legacyEmployeeUid
    ? Array.from(new Set([...targetUids, legacyEmployeeUid]))
    : targetUids;
}

function documentTargetsEmployee(value: Record<string, unknown>, uid: string) {
  return (
    documentTargetUids(value).includes(uid) ||
    value.employeeUid === uid
  );
}

function asIsoDate(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const date = (value as { toDate?: () => Date }).toDate?.();
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

function getStorageBucketName() {
  return (
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    ""
  ).trim();
}

function sanitizeFileName(fileName: string) {
  const safeName = fileName
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return safeName || "document.pdf";
}

function isPdf(file: File) {
  return (
    !file.type ||
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
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

function toDocument(
  id: string,
  value: Record<string, unknown>,
): ProfessionalDevelopmentDocument {
  return {
    id,
    title: typeof value.title === "string" ? value.title : "",
    category: typeof value.category === "string" ? value.category : "",
    originalFileName:
      typeof value.originalFileName === "string" ? value.originalFileName : "document.pdf",
    fileSize: typeof value.fileSize === "number" ? value.fileSize : 0,
    contentType:
      typeof value.contentType === "string" ? value.contentType : "application/pdf",
    source: value.source === "EMPLOYEE" ? "EMPLOYEE" : "ADMIN",
    uploadedByUid: typeof value.uploadedByUid === "string" ? value.uploadedByUid : "",
    uploadedByRole: typeof value.uploadedByRole === "string" ? value.uploadedByRole : "",
    createdAt: asIsoDate(value.createdAt),
    updatedAt: asIsoDate(value.updatedAt),
  };
}

function canDeleteDocument(
  requester: Requester,
  value: Record<string, unknown>,
) {
  if (isProfessionalDevelopmentManager(requester.role)) return true;
  return (
    documentTargetsEmployee(value, requester.uid) &&
    value.uploadedByUid === requester.uid &&
    value.source === "EMPLOYEE"
  );
}

async function requireTargetEmployees(targetUids: string[]) {
  const { db } = getAdminServices();
  const employeeRefs = targetUids.map((uid) => db.collection("users").doc(uid));
  const employees = employeeRefs.length ? await db.getAll(...employeeRefs) : [];
  return employees.length === targetUids.length && employees.every((employee) => employee.exists);
}

export async function GET(req: NextRequest) {
  try {
    const requester = await getRequester(req);
    if (!requester) return noStoreJson({ error: "غير مصرح" }, 401);

    const employeeUid = new URL(req.url).searchParams.get("uid");
    if (!isSafeUid(employeeUid)) {
      return noStoreJson({ error: "معرف الموظف غير صالح" }, 400);
    }
    if (
      requester.uid !== employeeUid &&
      !isProfessionalDevelopmentManager(requester.role)
    ) {
      return noStoreJson({ error: "غير مصرح بالوصول إلى هذا الملف" }, 403);
    }
    if (!(await requireTargetEmployees([employeeUid]))) {
      return noStoreJson({ error: "الموظف غير موجود" }, 404);
    }

    const bucketName = getStorageBucketName();
    if (!bucketName) {
      return noStoreJson({ error: "إعدادات مساحة تخزين الملفات غير مكتملة" }, 500);
    }

    const { db, storage } = getAdminServices();
    const snapshot = await db
      .collection("professionalDevelopmentDocuments")
      .where("active", "==", true)
      .get();
    const bucket = storage.bucket(bucketName);
    const documents = await Promise.all(
      snapshot.docs.filter((documentSnapshot) =>
        documentTargetsEmployee(
          documentSnapshot.data() as Record<string, unknown>,
          employeeUid,
        ),
      ).map(async (documentSnapshot) => {
        const value = documentSnapshot.data() as Record<string, unknown>;
        const document = toDocument(documentSnapshot.id, value);
        const storagePath = typeof value.storagePath === "string" ? value.storagePath : "";
        if (!storagePath) return null;

        const [fileUrl] = await bucket.file(storagePath).getSignedUrl({
          version: "v4",
          action: "read",
          expires: Date.now() + SIGNED_URL_TTL_MS,
        });

        return {
          ...document,
          fileUrl,
          canDelete: canDeleteDocument(requester, value),
        };
      }),
    );

    return noStoreJson({
      ok: true,
      documents: documents
        .filter((document): document is ProfessionalDevelopmentDocument & { fileUrl: string; canDelete: boolean } => document !== null)
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
    });
  } catch (error: unknown) {
    console.error("professional-development GET error:", error);
    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "تعذر تحميل ملفات التطوير المهني",
      },
      500,
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const requester = await getRequester(req);
    if (!requester) return noStoreJson({ error: "غير مصرح" }, 401);

    const formData = await req.formData();
    const title = String(formData.get("title") || "").trim();
    const category = String(formData.get("category") || "").trim();
    const file = formData.get("file");
    const submittedTargetUids = formData.get("targetUids");
    const legacyEmployeeUid = String(formData.get("employeeUid") || "").trim();
    const canManage = isProfessionalDevelopmentManager(requester.role);
    let targetUids: string[];

    if (canManage) {
      try {
        targetUids = uniqueTargetUids(
          typeof submittedTargetUids === "string"
            ? JSON.parse(submittedTargetUids)
            : undefined,
        ) ?? [];
      } catch {
        targetUids = [];
      }

      // Supports a still-open single-employee management form during rollout.
      if (targetUids.length === 0 && isSafeUid(legacyEmployeeUid)) {
        targetUids = [legacyEmployeeUid];
      }
      if (targetUids.length === 0) {
        return noStoreJson({ error: "يرجى تحديد موظف واحد على الأقل" }, 400);
      }
    } else {
      if (typeof submittedTargetUids === "string") {
        try {
          const submitted = uniqueTargetUids(JSON.parse(submittedTargetUids));
          if (!submitted || submitted.length !== 1 || submitted[0] !== requester.uid) {
            return noStoreJson({ error: "غير مصرح بتحديد موظفين آخرين" }, 403);
          }
        } catch {
          return noStoreJson({ error: "الموظفون المستهدفون غير صالحين" }, 400);
        }
      }
      if (legacyEmployeeUid && legacyEmployeeUid !== requester.uid) {
        return noStoreJson({ error: "غير مصرح بالرفع لموظف آخر" }, 403);
      }
      targetUids = [requester.uid];
    }

    if (!(await requireTargetEmployees(targetUids))) {
      return noStoreJson({ error: "أحد الموظفين المحددين غير موجود" }, 404);
    }
    if (!title || title.length > 200 || !isProfessionalDevelopmentCategory(category)) {
      return noStoreJson({ error: "يرجى إدخال عنوان وتصنيف صالحين" }, 400);
    }
    if (!(file instanceof File) || file.size === 0) {
      return noStoreJson({ error: "يرجى اختيار ملف PDF" }, 400);
    }
    if (!isPdf(file)) {
      return noStoreJson({ error: "الملف يجب أن يكون بصيغة PDF" }, 400);
    }
    if (file.size > PROFESSIONAL_DEVELOPMENT_MAX_PDF_SIZE_BYTES) {
      return noStoreJson({ error: "حجم ملف PDF يجب ألا يتجاوز 15 ميجابايت" }, 400);
    }

    const bucketName = getStorageBucketName();
    if (!bucketName) {
      return noStoreJson({ error: "إعدادات مساحة تخزين الملفات غير مكتملة" }, 500);
    }

    const { db, storage } = getAdminServices();
    const documentRef = db.collection("professionalDevelopmentDocuments").doc();
    const storagePath = `professional-development/${documentRef.id}-${sanitizeFileName(file.name)}`;
    const storageFile = storage.bucket(bucketName).file(storagePath);
    const source = canManage ? "ADMIN" : "EMPLOYEE";

    await storageFile.save(Buffer.from(await file.arrayBuffer()), {
      resumable: false,
      metadata: { contentType: "application/pdf" },
    });

    try {
      await documentRef.create({
        targetUids,
        title,
        category,
        storagePath,
        originalFileName: file.name,
        fileSize: file.size,
        contentType: "application/pdf",
        source,
        uploadedByUid: requester.uid,
        uploadedByRole: requester.role,
        active: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (writeError) {
      await storageFile.delete().catch(() => undefined);
      throw writeError;
    }

    const created = await documentRef.get();
    return noStoreJson({
      ok: true,
      document: toDocument(documentRef.id, created.data() as Record<string, unknown>),
    });
  } catch (error: unknown) {
    console.error("professional-development POST error:", error);
    return noStoreJson(
      {
        error:
          error instanceof Error ? error.message : "تعذر رفع ملف التطوير المهني",
      },
      500,
    );
  }
}
