"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ExternalLink,
  FileText,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import useClaimsRole from "@/hooks/use-claims-role";
import {
  PROFESSIONAL_DEVELOPMENT_CATEGORIES,
  isProfessionalDevelopmentManager,
} from "@/lib/professional-development";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProfessionalDevelopmentDocument = {
  id: string;
  title: string;
  category: string;
  originalFileName: string;
  fileSize: number;
  source: "ADMIN" | "EMPLOYEE";
  createdAt: string | null;
  fileUrl: string;
  canDelete: boolean;
};

type EmployeeOption = {
  uid: string;
  name: string;
  email: string;
  position: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("ar-SA");
}

function formatFileSize(value: number) {
  if (!value) return "—";
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function employeeLabel(employee: EmployeeOption) {
  return [employee.name, employee.position, employee.email]
    .filter(Boolean)
    .join(" — ");
}

export default function ProfessionalDevelopmentPanel({
  employeeUid,
}: {
  employeeUid?: string;
}) {
  const { uid, role, loading: authLoading } = useClaimsRole();
  const [documents, setDocuments] = useState<ProfessionalDevelopmentDocument[]>([]);
  const [loading, setLoading] = useState(Boolean(employeeUid));
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [category, setCategory] = useState<string>(
    PROFESSIONAL_DEVELOPMENT_CATEGORIES[0],
  );
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [selectedEmployeeUids, setSelectedEmployeeUids] = useState<string[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeSelectorOpen, setEmployeeSelectorOpen] = useState(false);

  const canManage = !!role && isProfessionalDevelopmentManager(role);
  const canAccess = !!uid && (canManage || (!!employeeUid && uid === employeeUid));
  const showDocuments = Boolean(employeeUid);

  const loadDocuments = useCallback(async () => {
    if (!canAccess || !employeeUid) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("تعذر التحقق من جلسة المستخدم");

      const response = await fetch(
        `/api/professional-development?uid=${encodeURIComponent(employeeUid)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "تعذر تحميل الملفات");

      setDocuments(Array.isArray(data?.documents) ? data.documents : []);
    } catch (error) {
      console.error("professional-development load error:", error);
      toast.error(error instanceof Error ? error.message : "تعذر تحميل الملفات");
    } finally {
      setLoading(false);
    }
  }, [canAccess, employeeUid]);

  const loadEmployees = useCallback(async () => {
    if (!canManage) return;

    try {
      setEmployeesLoading(true);
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("تعذر التحقق من جلسة المستخدم");

      const response = await fetch("/api/professional-development/employees", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "تعذر تحميل قائمة الموظفين");

      setEmployees(Array.isArray(data?.employees) ? data.employees : []);
    } catch (error) {
      console.error("professional-development employees load error:", error);
      toast.error(
        error instanceof Error ? error.message : "تعذر تحميل قائمة الموظفين",
      );
    } finally {
      setEmployeesLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    if (authLoading) return;
    if (!canAccess) {
      setLoading(false);
      return;
    }
    void loadDocuments();
  }, [authLoading, canAccess, loadDocuments]);

  useEffect(() => {
    if (!authLoading && canManage) void loadEmployees();
  }, [authLoading, canManage, loadEmployees]);

  useEffect(() => {
    if (canManage && employeeUid) {
      setSelectedEmployeeUids((current) =>
        current.length === 0 ? [employeeUid] : current,
      );
    }
  }, [canManage, employeeUid]);

  const selectedEmployees = useMemo(
    () =>
      selectedEmployeeUids.flatMap((selectedUid) => {
        const employee = employees.find((item) => item.uid === selectedUid);
        return employee ? [employee] : [];
      }),
    [employees, selectedEmployeeUids],
  );

  const visibleEmployees = useMemo(() => {
    const query = employeeSearch.trim().toLocaleLowerCase("ar");
    if (!query) return employees.slice(0, 60);
    return employees
      .filter((employee) =>
        employeeLabel(employee).toLocaleLowerCase("ar").includes(query),
      )
      .slice(0, 60);
  }, [employeeSearch, employees]);

  function toggleEmployee(uidToToggle: string, checked: boolean) {
    setSelectedEmployeeUids((current) =>
      checked
        ? current.includes(uidToToggle)
          ? current
          : [...current, uidToToggle]
        : current.filter((selectedUid) => selectedUid !== uidToToggle),
    );
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const targetUids = canManage ? selectedEmployeeUids : uid ? [uid] : [];

    if (targetUids.length === 0) {
      toast.error("يرجى تحديد موظف واحد على الأقل");
      return;
    }

    try {
      setSubmitting(true);
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("تعذر التحقق من جلسة المستخدم");

      const formData = new FormData(form);
      formData.set("targetUids", JSON.stringify(targetUids));
      formData.set("category", category);

      const response = await fetch("/api/professional-development", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "تعذر رفع الملف");

      form.reset();
      setCategory(PROFESSIONAL_DEVELOPMENT_CATEGORIES[0]);
      toast.success("تم رفع ملف التطوير المهني");
      await loadDocuments();
    } catch (error) {
      console.error("professional-development upload error:", error);
      toast.error(error instanceof Error ? error.message : "تعذر رفع الملف");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteDocument(documentId: string) {
    if (!window.confirm("هل تريد حذف هذا الملف؟")) return;

    try {
      setDeletingId(documentId);
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("تعذر التحقق من جلسة المستخدم");

      const response = await fetch(`/api/professional-development/${documentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "تعذر حذف الملف");

      setDocuments((current) => current.filter((document) => document.id !== documentId));
      toast.success("تم حذف الملف");
    } catch (error) {
      console.error("professional-development delete error:", error);
      toast.error(error instanceof Error ? error.message : "تعذر حذف الملف");
    } finally {
      setDeletingId(null);
    }
  }

  const adminDocuments = documents.filter((document) => document.source === "ADMIN");
  const employeeDocuments = documents.filter(
    (document) => document.source === "EMPLOYEE",
  );

  if (authLoading) return null;
  if (!canAccess) {
    return <div className="text-sm text-destructive">غير مصرح بالوصول إلى هذه الصفحة.</div>;
  }

  return (
    <div className="grid gap-6" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle>{canManage ? "إضافة ملف للموظفين" : "إضافة ملفي"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={uploadDocument}>
            <div className="grid gap-2">
              <Label htmlFor="professional-development-title">العنوان</Label>
              <Input id="professional-development-title" name="title" required maxLength={200} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="professional-development-category">التصنيف</Label>
              <select
                id="professional-development-category"
                name="category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {PROFESSIONAL_DEVELOPMENT_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            {canManage ? (
              <div className="grid gap-2 md:col-span-2">
                <Label>الموظفون المستهدفون</Label>
                <div className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-muted-foreground">
                      <Users className="ms-1 inline h-4 w-4" />
                      تم تحديد {selectedEmployeeUids.length} موظف
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedEmployeeUids([])}
                        disabled={selectedEmployeeUids.length === 0}
                      >
                        مسح الاختيار
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEmployeeSelectorOpen((open) => !open)}
                      >
                        <ChevronDown className="ms-1 h-4 w-4" />
                        اختيار الموظفين
                      </Button>
                    </div>
                  </div>

                  {selectedEmployees.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedEmployees.map((employee) => (
                        <span
                          key={employee.uid}
                          className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs"
                        >
                          {employeeLabel(employee)}
                          <button
                            type="button"
                            aria-label={`إزالة ${employee.name}`}
                            onClick={() => toggleEmployee(employee.uid, false)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {employeeSelectorOpen ? (
                    <div className="mt-3 grid gap-3 border-t pt-3">
                      <div className="flex flex-wrap gap-2">
                        <div className="relative min-w-[220px] flex-1">
                          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            value={employeeSearch}
                            onChange={(event) => setEmployeeSearch(event.target.value)}
                            className="pr-9"
                            placeholder="ابحث بالاسم أو البريد أو الوظيفة"
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setSelectedEmployeeUids((current) =>
                              Array.from(new Set([...current, ...visibleEmployees.map((employee) => employee.uid)])),
                            )
                          }
                          disabled={visibleEmployees.length === 0}
                        >
                          تحديد النتائج
                        </Button>
                      </div>

                      <div className="max-h-64 overflow-y-auto rounded-md border">
                        {employeesLoading ? (
                          <div className="p-3 text-sm text-muted-foreground">جارٍ تحميل الموظفين...</div>
                        ) : visibleEmployees.length === 0 ? (
                          <div className="p-3 text-sm text-muted-foreground">لا توجد نتائج.</div>
                        ) : (
                          visibleEmployees.map((employee) => {
                            const checked = selectedEmployeeUids.includes(employee.uid);
                            return (
                              <label
                                key={employee.uid}
                                className="flex cursor-pointer items-start gap-3 border-b p-3 text-sm last:border-b-0"
                              >
                                <input
                                  type="checkbox"
                                  className="mt-1"
                                  checked={checked}
                                  onChange={(event) => toggleEmployee(employee.uid, event.target.checked)}
                                />
                                <span className="min-w-0">
                                  <span className="block font-medium">{employee.name}</span>
                                  <span className="block text-xs text-muted-foreground">
                                    {[employee.position, employee.email].filter(Boolean).join(" — ")}
                                  </span>
                                </span>
                              </label>
                            );
                          })
                        )}
                      </div>
                      {employees.length > visibleEmployees.length ? (
                        <div className="text-xs text-muted-foreground">تظهر أول 60 نتيجة؛ استخدم البحث لتضييق القائمة.</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  يمكنك اختيار موظف واحد أو عدة موظفين، وسيظهر الملف في التطوير المهني لكل موظف محدد.
                </div>
              </div>
            ) : null}

            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="professional-development-file">ملف PDF</Label>
              <Input
                id="professional-development-file"
                name="file"
                type="file"
                accept="application/pdf,.pdf"
                required
              />
              <div className="text-xs text-muted-foreground">الحد الأقصى لحجم الملف: 15 ميجابايت.</div>
            </div>

            <div className="md:col-span-2">
              <Button type="submit" disabled={submitting || (canManage && selectedEmployeeUids.length === 0)}>
                <Upload className="ms-2 h-4 w-4" />
                {submitting ? "جارٍ الرفع..." : "رفع الملف"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {showDocuments ? (
        <>
          <DocumentSection
            title="ملفات أضيفت من الإدارة"
            documents={adminDocuments}
            loading={loading}
            deletingId={deletingId}
            onDelete={deleteDocument}
          />

          <DocumentSection
            title={canManage ? "ملفات أضافها الموظف" : "ملفاتي المضافة"}
            documents={employeeDocuments}
            loading={loading}
            deletingId={deletingId}
            onDelete={deleteDocument}
          />
        </>
      ) : null}
    </div>
  );
}

function DocumentSection({
  title,
  documents,
  loading,
  deletingId,
  onDelete,
}: {
  title: string;
  documents: ProfessionalDevelopmentDocument[];
  loading: boolean;
  deletingId: string | null;
  onDelete: (documentId: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {loading ? (
          <div className="text-sm text-muted-foreground">جارٍ التحميل...</div>
        ) : documents.length === 0 ? (
          <div className="text-sm text-muted-foreground">لا توجد ملفات.</div>
        ) : (
          documents.map((document) => (
            <div key={document.id} className="rounded-lg border p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 font-semibold">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="break-words">{document.title}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">{document.category}</div>
                  <div className="text-xs text-muted-foreground break-all">
                    {document.originalFileName} · {formatFileSize(document.fileSize)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(document.createdAt)} · {document.source === "ADMIN" ? "أضيف من الإدارة" : "أضيف بواسطة الموظف"}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={document.fileUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="ms-2 h-4 w-4" />
                      فتح PDF
                    </a>
                  </Button>
                  {document.canDelete ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={deletingId === document.id}
                      onClick={() => onDelete(document.id)}
                    >
                      <Trash2 className="ms-2 h-4 w-4" />
                      {deletingId === document.id ? "جارٍ الحذف..." : "حذف"}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
