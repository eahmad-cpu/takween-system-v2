"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function RequestsSearchBar({
  value,
  onChange,
  placeholder = "بحث بعنوان الطلب...",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const hasValue = value.trim().length > 0;

  return (
    <div className={`flex items-center gap-2 ${className}`} dir="rtl">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-right"
      />
      {hasValue && (
        <Button type="button" variant="outline" onClick={() => onChange("")}>
          مسح
        </Button>
      )}
    </div>
  );
}
