// components/requests/RequestsFilters.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  type RequestsFilters,
  defaultRequestsFilters,
} from "@/lib/internal-requests/filters";

export default function RequestsFiltersBar({
  mode,
  value,
  onChange,
}: {
  mode: "inbox" | "outbox" | "archive";
  value: RequestsFilters;
  onChange: (v: RequestsFilters) => void;
}) {
  return (
    <div className="rounded-md border p-3 grid gap-3">
      <div className="grid sm:grid-cols-3 gap-3">
        {/* status */}
        <div className="grid gap-1">
          <Label className="text-xs">فلتر</Label>
          <Select
            dir="rtl"
            value={value.status}
            onValueChange={(v) =>
              onChange({ ...value, status: v as any })
            }
          >
            <SelectTrigger className="text-right">
              <SelectValue placeholder="اختر الحالة" />
            </SelectTrigger>
            <SelectContent
              dir="rtl"
              align="end"
              sideOffset={6}
              className="max-h-56 overflow-y-auto">

              <div className="sticky top-0 h-3 bg-gradient-to-b from-background to-transparent pointer-events-none" />

              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="open">مفتوح</SelectItem>
              <SelectItem value="in_progress">قيد المعالجة</SelectItem>
              <SelectItem value="approved">معتمد</SelectItem>
              <SelectItem value="rejected">مرفوض</SelectItem>
              <SelectItem value="closed">مغلق</SelectItem>
              <SelectItem value="cancelled">ملغي</SelectItem>

              <div className="sticky top-0 h-3 bg-gradient-to-b from-background to-transparent pointer-events-none" />
            </SelectContent>
          </Select>
        </div>

        {/* inbox kind */}
        {mode === "inbox" ? (
          <div className="grid gap-1">
            <Label className="text-xs">وارد كـ</Label>
            <Select
              dir="rtl"
              value={value.inboxKind}
              onValueChange={(v) =>
                onChange({ ...value, inboxKind: v as any })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="الكل" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="primary">أساسي</SelectItem>
                <SelectItem value="cc">نسخة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div />
        )}

        {/* reset */}
        <div className="grid gap-1">
          <Label className="text-xs">&nbsp;</Label>
          <Button
            type="button"
            variant="outline"
            onClick={() => onChange(defaultRequestsFilters)}
          >
            مسح الفلاتر
          </Button>
        </div>
      </div>

      {/* date range */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="grid gap-1">
          <Label className="text-xs">من تاريخ</Label>
          <Input
            type="date"
            value={value.dateFrom}
            onChange={(e) => onChange({ ...value, dateFrom: e.target.value })}
          />
        </div>

        <div className="grid gap-1">
          <Label className="text-xs">إلى تاريخ</Label>
          <Input
            type="date"
            value={value.dateTo}
            onChange={(e) => onChange({ ...value, dateTo: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
