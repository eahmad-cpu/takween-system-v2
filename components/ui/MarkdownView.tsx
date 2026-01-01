"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownView({ value }: { value: string }) {
  const text = value?.trim() ? value : "لا يوجد وصف مكتوب.";

  return (
    <div className="prose prose-sm max-w-none prose-p:my-2 prose-li:my-1 prose-ul:my-2 prose-ol:my-2 prose-strong:font-extrabold">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
