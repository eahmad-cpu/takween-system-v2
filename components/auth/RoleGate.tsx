// components/auth/RoleGate.tsx
"use client";

import { ReactNode, useMemo } from "react";
import useClaimsRole, { Role } from "@/hooks/use-claims-role";

const rolePriority: Record<Role, number> = {
  employee: 1,
  hr: 2,
  chairman: 3,
  ceo: 4,
  admin: 5,
  superadmin: 6,
};

function hasRoleAtLeast(userRole: Role | null, min: Role) {
  if (!userRole) return false;
  return rolePriority[userRole] >= rolePriority[min];
}

export default function RoleGate({
  min,
  fallback = null,
  children,
}: {
  min: Role;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { role, loading } = useClaimsRole();

  const allowed = useMemo(() => {
    if (loading) return false;
    return hasRoleAtLeast(role, min);
  }, [loading, role, min]);

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground">
        جارٍ التحقق من الصلاحيات…
      </div>
    );
  }

  if (!allowed) return <>{fallback}</>;

  return <>{children}</>;
}
