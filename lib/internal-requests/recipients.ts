// lib/internal-requests/recipients.ts

export type RequestRecipientKey =
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
  | "binaa_center"

export type RequestRecipient = {
  key: RequestRecipientKey
  label: string
  number: number
  email: string
}

export const RECIPIENTS: RequestRecipient[] = [
  { key: "chairman",            label: "رئيس المجلس",             number: 1,  email: "pres.tk@qz.org.sa" },
  { key: "ceo",                 label: "المدير التنفيذي",         number: 2,  email: "asalfayez@qz.org.sa" },
  { key: "finance",             label: "المالية",                 number: 3,  email: "a.alhrbi@qz.org.sa" },
  { key: "projects",            label: "المشاريع",                number: 4,  email: "aldawish@qz.org.sa" },
  { key: "maintenance",         label: "الصيانة",                 number: 5,  email: "a.almunifi@qz.org.sa" },
  { key: "hr",                  label: "الموارد البشرية",         number: 6,  email: "kh.alamer@qz.org.sa" },
  { key: "platforms",           label: "المنصات",                 number: 7,  email: "aa.alshaya@qz.org.sa" },
  { key: "collector",           label: "المحصل المالي",           number: 8,  email: "n.alamer@qz.org.sa" },
  { key: "secretary",           label: "السكرتارية",              number: 9,  email: "e.ahmad@qz.org.sa" },
  { key: "media_manager",       label: "مدير الإعلام",            number: 10, email: "m.albahr@qz.org.sa" },
  { key: "designer",            label: "المصممة",                 number: 11, email: "a.aljasir@qz.org.sa" },
  { key: "supervision_head",    label: "رئيس قسم الإشراف",        number: 12, email: "h-alnasser@qz.org.sa" },
  { key: "executive_assistant", label: "مساعدة المدير التنفيذي",  number: 13, email: "h.alshaya@qz.org.sa" },
  { key: "admin_supervisor",    label: "المشرفة الإدارية",        number: 14, email: "a-almansur@qz.org.sa" },
  { key: "edu_supervisor",      label: "المشرفة التعليمية",       number: 15, email: "f-alhamaad@qz.org.sa" },
  { key: "athar_center",        label: "مركز أثر",                number: 16, email: "bader-a-albader@qz.org.sa" },
  { key: "binaa_center",        label: "مركز بناء",               number: 17, email: "aa.alhumidi@qz.org.sa" },
]

export function getRecipientByKey(key: RequestRecipientKey): RequestRecipient | undefined {
  return RECIPIENTS.find(r => r.key === key)
}

export function getRecipientByEmail(email: string): RequestRecipient | undefined {
  const norm = email.trim().toLowerCase()
  return RECIPIENTS.find(r => r.email.toLowerCase() === norm)
}

export function getAllRecipients(): RequestRecipient[] {
  return [...RECIPIENTS]
}

