"use client";

import { useParams } from "next/navigation";

import ProfessionalDevelopmentPanel from "@/components/professional-development/ProfessionalDevelopmentPanel";

export default function EmployeeProfessionalDevelopmentPage() {
  const params = useParams<{ uid: string }>();
  const uid = params?.uid;

  if (!uid) return null;

  return (
    <div className="mx-auto grid max-w-5xl gap-6" dir="rtl">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">التطوير المهني</h1>
        <p className="text-sm text-muted-foreground">
          ملفات التطوير المهني الخاصة بالموظف.
        </p>
      </div>

      <ProfessionalDevelopmentPanel employeeUid={uid} />
    </div>
  );
}
