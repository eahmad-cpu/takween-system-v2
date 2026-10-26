"use client";

import useClaimsRole from "@/hooks/use-claims-role";
import ProfessionalDevelopmentPanel from "@/components/professional-development/ProfessionalDevelopmentPanel";
import { isProfessionalDevelopmentManager } from "@/lib/professional-development";

export default function MyProfessionalDevelopmentPage() {
  const { uid, role, loading } = useClaimsRole();

  if (loading || !uid) return null;

  return (
    <div className="mx-auto grid max-w-5xl gap-6" dir="rtl">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">التطوير المهني</h1>
        <p className="text-sm text-muted-foreground">
          احتفظ بملفات دوراتك وشهاداتك وبرامجك التطويرية.
        </p>
      </div>

      <ProfessionalDevelopmentPanel
        employeeUid={
          role && isProfessionalDevelopmentManager(role) ? undefined : uid
        }
      />
    </div>
  );
}
