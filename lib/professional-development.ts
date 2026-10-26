export const PROFESSIONAL_DEVELOPMENT_CATEGORIES = [
  "دورة تدريبية",
  "شهادة",
  "ورشة عمل",
  "برنامج تطويري",
  "أخرى",
] as const;

export type ProfessionalDevelopmentCategory =
  (typeof PROFESSIONAL_DEVELOPMENT_CATEGORIES)[number];

export const PROFESSIONAL_DEVELOPMENT_MANAGER_ROLES = [
  "hr",
  "chairman",
  "ceo",
  "admin",
  "superadmin",
] as const;

export const PROFESSIONAL_DEVELOPMENT_MAX_PDF_SIZE_BYTES = 15 * 1024 * 1024;

export function isProfessionalDevelopmentManager(role: string): boolean {
  return PROFESSIONAL_DEVELOPMENT_MANAGER_ROLES.includes(
    role as (typeof PROFESSIONAL_DEVELOPMENT_MANAGER_ROLES)[number],
  );
}

export function isProfessionalDevelopmentCategory(
  value: string,
): value is ProfessionalDevelopmentCategory {
  return PROFESSIONAL_DEVELOPMENT_CATEGORIES.includes(
    value as ProfessionalDevelopmentCategory,
  );
}
