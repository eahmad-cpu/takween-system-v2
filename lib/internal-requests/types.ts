// lib/internal-requests/types.ts
import type { Role } from "@/lib/roles"
import type { RequestRecipientKey } from "./recipients"

// حالة الطلب الرئيسية
export type RequestStatus =
  | "open"        // تم إنشاؤه ومفتوح
  | "in_progress" // تحت الإجراء / الإحالات
  | "approved"    // تم اعتماده نهائيًا
  | "rejected"    // تم رفضه
  | "closed"      // تم إغلاقه بعد التنفيذ
  | "cancelled"   // تم إلغاؤه من مقدم الطلب

// نوع الحركة على الطلب (في سجل الإحالات / التايم لاين)
export type RequestActionType =
  | "submitted"     // أول إنشاء للطلب
  | "forwarded"     // إحالة من جهة/شخص لجهة/شخص آخر
  | "approved"      // موافقة
  | "rejected"      // رفض
  | "comment"       // تعليق فقط
  | "closed"        // إغلاق الطلب
  | "generated_pdf" // تم توليد ملف PDF

// نوع الطلب (اختياري — لو مش محتاجه سيبه)
export type RequestType = "general" | "finance" | "hr" | "projects" | "it"
export type RequestAttachment = {
  name: string
  size: number
  contentType: string
  url: string
  path: string

  uploadedByUid: string | null
  uploadedByLabel: string | null
  uploadedAtMs?: number
}

// خطوة / حركة واحدة في سجل الطلب
export interface RequestAction {
  id?: string
  at: Date | null

  fromUid: string | null
  fromRole: Role | null

  toUid: string | null
  toRole: Role | null

  // مهم لنظام الجهات
  toRecipientKey?: RequestRecipientKey | null

  actionType: RequestActionType
  comment: string
}

// الكيان الأساسي للطلب
export interface InternalRequest {
  id: string

  title: string
  // خليته اختياري عشان لو مش هتستخدم النوع
  type?: RequestType
  description: string

  createdByUid: string
  createdByEmail?: string | null
  createdByDept?: string | null

  status: RequestStatus

  // المسؤول الحالي (لو بتستخدم uid/role)
  currentAssignee: {
    uid: string | null
    role: Role | null
  }

  // ✅ نظام الجهات (الجديد)
  mainRecipientKey: RequestRecipientKey | null
  mainRecipientLabel: string | null
  mainRecipientNumber: number | null
  createdByLabel: string | null
  sequenceForRecipient: number | null
  // مثال: "2/15"
  requestNumber: string | null

  // نسخة للإطلاع
  ccRecipientKeys: RequestRecipientKey[]

  // الجهة المكلّفة حاليًا
  currentAssigneeKey: RequestRecipientKey | null
  currentAssigneeLabel: string | null

  createdAt: Date | null
  updatedAt: Date | null

  archived: boolean
  pdfUrl?: string | null

  actions: RequestAction[]

  attachments?: RequestAttachment[]

}
