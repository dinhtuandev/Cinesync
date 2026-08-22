"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShareButtonProps {
  /** Nội dung hiển thị trong Web Share API */
  title: string;
  className?: string;
}

export function ShareButton({ title, className }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    setShareUrl(window.location.href);
  }, []);

  const handleShare = useCallback(async () => {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: `${title} — CineSync`, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user hủy share — bỏ qua */
    }
  }, [title, shareUrl]);

  return (
    <Button variant="outline" onClick={handleShare} className={className}>
      {copied ? <Check aria-hidden /> : <Share2 aria-hidden />}
      {copied ? "Đã sao chép link" : "Chia sẻ"}
    </Button>
  );
}
