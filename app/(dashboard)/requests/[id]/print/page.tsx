"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { listenInternalRequestById } from "@/lib/internal-requests/firestore";
import { getRecipientByEmail, getRecipientByKey } from "@/lib/internal-requests/recipients";
import type { InternalRequest } from "@/lib/internal-requests/types";

type UserMini = {
  label: string;
  recipientKey?: string | null;
  recipientLabel?: string | null;
  email?: string | null;
};

export default function RequestPrintPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  const [userCache] = useState<Record<string, UserMini>>({});
  const [req, setReq] = useState<InternalRequest | null>(null);

  useEffect(() => {
    if (!id) return;
    const unsub = listenInternalRequestById(id, (r) => setReq(r));
    return () => unsub();
  }, [id]);

  if (!req) {
    return (
      <div className="min-h-[40vh] grid place-items-center text-sm text-muted-foreground">
        جارٍ تحميل صفحة الطباعة…
      </div>
    );
  }

  const requestNumberText =
    req.requestNumber || (req.mainRecipientNumber ? `${req.mainRecipientNumber}/—` : "—");

  const mainRecipientLabel =
    req.mainRecipientLabel ||
    (req.mainRecipientKey ? getRecipientByKey(req.mainRecipientKey as any)?.label : null) ||
    "غير محددة";

  const creatorLabel = (() => {
    const byEmail = req.createdByEmail ? getRecipientByEmail(req.createdByEmail) : undefined;
    if (byEmail) return byEmail.label;

    const c = userCache[req.createdByUid];
    if (c?.label) return c.label;

    return "موظف";
  })();

  return (
    <div className="print-wrap">
      {/* أدوات (لا تظهر في الطباعة) */}
      <div className="no-print flex justify-end gap-2 mb-4">
        <Button variant="outline" onClick={() => router.back()}>
          رجوع
        </Button>
        <Button onClick={() => window.print()}>طباعة / حفظ PDF</Button>
      </div>

      {/* الورقة */}
      <div className="paper">
        {/* ✅ Watermark Image */}
        <img
          src="/print/watermark.png"
          alt=""
          className="wm-img"
          aria-hidden="true"
        />

        {/* ✅ كل المحتوى داخل wrapper فوق الـ watermark */}
        <div className="paper-content">
          <header className="paper-header">
            <div>
              <div className="org">  </div>
              <div className="sub">  </div>
            </div>

            <div className="meta">
              <div><span>رقم الطلب:</span> {requestNumberText}</div>
              <div><span>المرسل إليه:</span> {mainRecipientLabel}</div>
              <div><span>منشئ الطلب:</span> {creatorLabel}</div>
              <div>
                <span>تاريخ الإنشاء:</span>{" "}
                {req.createdAt ? req.createdAt.toLocaleString("ar-SA") : "—"}
              </div>
              <div><span>عنوان الطلب:</span> {req.title || "طلب بدون عنوان"}</div>
            </div>
          </header>

          {/* <h1 className="title">{req.title || "طلب بدون عنوان"}</h1> */}

          <section className="section">
            <h2>وصف الطلب</h2>
            <div className="desc">
              {req.description?.trim() ? req.description : "لا يوجد وصف مكتوب."}
            </div>
          </section>
<div className="no-print">
          {Array.isArray((req as any).attachments) && (req as any).attachments.length > 0 ? (
            <section className="section">
              <h2>المرفقات</h2>
              <ol className="attach">
                {(req as any).attachments.map((a: any, i: number) => (
                  <li key={i}>
                    {a?.name || "ملف"}{" "}
                    {a?.url ? <span className="muted">({a.url})</span> : null}
                  </li>
                ))}
              </ol>
              <div className="muted">
                * الروابط تظهر للمرجع، وقد لا تُطبع كرابط قابل للنقر حسب إعدادات المتصفح.
              </div>
            </section>
          ) : null}
</div>
          <footer className="paper-footer">
            <div>تمت الطباعة من نظام تكوين — {new Date().toLocaleDateString("ar-SA")}</div>
          </footer>
        </div>
      </div>

      {/* CSS للطباعة */}
      <style jsx global>{`
        .print-wrap { direction: rtl; padding: 16px; }

        .paper {
          position: relative;
          overflow: hidden;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 18px;
        }

        /* ✅ watermark (لا يأخذ مساحة لأنه absolute) */
        .wm-img{
          position: absolute;
          left: 50%;
          top: 55%;
          transform: translate(-50%, -50%);
          width: 520px;
          opacity: 0.20;
          pointer-events: none;
          z-index: 0;
        }

        /* ✅ المحتوى كله فوقه */
        .paper-content{
          position: relative;
          z-index: 1;
        }

        .paper-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 37px;
          margin-bottom: 19px;
        }

        .org { font-size: 16px; font-weight: 800; }
        .sub { font-size: 12px; color: #6b7280; margin-top: 2px; }

        .meta { font-size: 12px; line-height: 1.9; color: #111827; }
        .meta span { color: #6b7280; }

        .title { font-size: 20px; font-weight: 900; margin: 12px 0; }

        .section { margin-top: 12px; }
        .section h2 {
          font-size: 14px;
          font-weight: 800;
          margin: 0 0 8px;
          border-right: 3px solid #111827;
          padding-right: 8px;
        }

        .desc {
          font-size: 13px;
          line-height: 1.9;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .attach { margin: 0; padding-right: 18px; font-size: 12px; line-height: 1.8; }
        .muted { color: #6b7280; font-size: 11px; }

        .paper-footer {
          margin-top: 16px;
          padding-top: 10px;
          border-top: 1px solid #e5e7eb;
          font-size: 11px;
          color: #6b7280;
        }

        @media print {
          .no-print { display: none !important; }
          .print-wrap { padding: 0 !important; }
          .paper { border: none !important; border-radius: 0 !important; }
          @page { margin: 14mm; }
        }
         
        .wm-img{
  opacity: 0.35 !important;
  width: min(75%, 560px);
  
  z-index: 2;
}

.paper-content{ z-index: 3; }

.wm-img{
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(87%, 810px);
  width: 215.9mm;
  height: 279.7mm;     /* غيرها بحرية */
  object-fit: fill;
  opacity: 15%;
  pointer-events: none;
  z-index: 0;
}
.paper{
  position: relative;
  overflow: hidden;

  width: 215.9mm;   /* 8.5in */
  height: 279.7mm;  /* 11.01in */
  margin: 0 auto;

  box-sizing: border-box;
  padding: 16mm;

  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}
.wm-img{
  left: 0; top: 0; transform: none;
  width: 100%; height: 90%;
  object-fit: contain; /* أو cover */
}


@media print{
  @page{ size: A4; margin: 0; }
  html, body{ margin: 0; padding: 0; }
  .no-print{ display:none !important; }
  .print-wrap{ padding: 0 !important; }
  .paper{
    border: none !important;
    border-radius: 0 !important;
  }
}

@media print{
  .no-print{ display: none !important; }
}

@media print{
  @page{ size: A4; margin: 0; }
  html, body{ margin: 0 !important; padding: 0 !important; }
  .print-wrap{ padding: 0 !important; margin: 0 !important; }
  .paper{ margin: 0 auto !important; }
}


@media print{
  .print-wrap { padding: 0 !important; margin: 0 !important; }
}
.print-wrap { direction: rtl; padding: 0; margin: 0; }

      `}</style>
    </div>
  );
}
