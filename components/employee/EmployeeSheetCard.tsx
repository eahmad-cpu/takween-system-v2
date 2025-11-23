/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { auth } from "@/lib/firebase";

type EmployeeSheet = Record<string, string>;

export default function EmployeeSheetCard({
  nationalId,
  title = "بياناتي الوظيفية (من Google Sheets)",
}: {
  nationalId?: string | null;
  title?: string;
}) {
  const [employeeSheet, setEmployeeSheet] = useState<EmployeeSheet | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  useEffect(() => {
  const nid = nationalId?.trim();
  if (!nid) return;

  let cancelled = false;

  (async () => {
    try {
      setSheetLoading(true);
      setSheetError(null);

      // ✅ 1) جرّب تجيب من الكاش أولاً
      const cacheKey = `employeeSheet:${nid}`;
      const cachedRaw = sessionStorage.getItem(cacheKey);

      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as {
          ts: number;
          employee: EmployeeSheet;
        };

        const TEN_MIN = 10 * 60 * 1000;
        if (Date.now() - cached.ts < TEN_MIN) {
          if (!cancelled) {
            setEmployeeSheet(cached.employee);
            setSheetLoading(false);
          }
          return; // ✅ وقف هنا، مش محتاج نروح للـ API
        }
      }

      setEmployeeSheet(null);

      // ✅ 2) هات التوكن
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        if (!cancelled) {
          setSheetError("لم يتم العثور على توكن تسجيل الدخول");
          setSheetLoading(false);
        }
        return;
      }

      // ✅ 3) نادى الـ API
      const res = await fetch(
        `/api/employee-sheet?nationalId=${encodeURIComponent(nid)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();

      if (!res.ok) {
        if (!cancelled) {
          setSheetError(data?.error || "تعذر تحميل بيانات الموظف من الشيت");
        }
        return;
      }

      const employee = data.employee as EmployeeSheet;

      // ✅ 4) خزّن في الكاش
      sessionStorage.setItem(
        cacheKey,
        JSON.stringify({ ts: Date.now(), employee })
      );

      if (!cancelled) {
        setEmployeeSheet(employee);
      }
    } catch (err) {
      console.error(err);
      if (!cancelled) {
        setSheetError("حدث خطأ أثناء الاتصال بواجهة Google Sheets");
      }
    } finally {
      if (!cancelled) setSheetLoading(false);
    }
  })();

  return () => {
    cancelled = true;
  };
}, [nationalId]);



  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        {!nationalId && (
          <div className="text-muted-foreground">
            لا يوجد رقم هوية (nationalId) مخزن في سجل المستخدم على Firestore.
          </div>
        )}

        {nationalId && (
          <div className="text-xs text-muted-foreground">
            رقم الهوية في الملف:{" "}
            <span className="font-semibold">{nationalId}</span>
          </div>
        )}

        {sheetLoading && (
          <div className="text-muted-foreground">
            جاري تحميل بياناتك من الشيت...
          </div>
        )}

        {sheetError && <div className="text-red-600 text-xs">{sheetError}</div>}

        {employeeSheet && (
          <div className="grid gap-2 md:grid-cols-2">
            {Object.entries(employeeSheet)
              .filter(([k, v]) => k && v && String(v).trim() !== "")
              .map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <div className="text-[11px] text-muted-foreground">{k}</div>
                  <div className="font-medium truncate">{v}</div>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
