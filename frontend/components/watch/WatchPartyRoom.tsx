"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Copy,
  Check,
  Loader2,
  MessageSquare,
  PlugZap,
  Send,
  Users,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "offline";

interface ChatMessage {
  id: number;
  author: string;
  text: string;
  own?: boolean;
}

/**
 * Shell phòng Watch Party.
 * Kết nối Socket.IO namespace /watch-party qua lib/socket-client.
 * Trước khi Backend sẵn sàng: hiển thị trạng thái "offline" trung thực kèm nút thử lại.
 */
export function WatchPartyRoom({ roomCode }: { roomCode: string }) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);

  const attemptConnect = useCallback(() => {
    setStatus("connecting");
    // TODO(backend): getSocket().connect() + join_room; hiện chưa có WS server
    const timer = setTimeout(() => setStatus("offline"), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const cleanup = attemptConnect();
    return cleanup;
  }, [attemptConnect]);

  const handleCopy = useCallback(async () => {
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: `Phòng xem CineSync ${roomCode}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user hủy — bỏ qua */
    }
  }, [roomCode]);

  const handleSend = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = draft.trim();
      if (!text || status !== "connected") return;
      setMessages((m) => [...m, { id: Date.now(), author: "Bạn", text, own: true }]);
      setDraft("");
      // TODO(backend): socket.emit("chat_message", { text })
    },
    [draft, status],
  );

  const statusConfig: Record<
    ConnectionStatus,
    { label: string; className: string; icon: React.ReactNode }
  > = {
    connecting: {
      label: "Đang kết nối...",
      className: "bg-yellow-500/15 text-yellow-500",
      icon: <Loader2 className="size-3.5 animate-spin" aria-hidden />,
    },
    connected: {
      label: "Đã kết nối",
      className: "bg-emerald-500/15 text-emerald-500",
      icon: <PlugZap className="size-3.5" aria-hidden />,
    },
    reconnecting: {
      label: "Đang kết nối lại...",
      className: "bg-yellow-500/15 text-yellow-500",
      icon: <Loader2 className="size-3.5 animate-spin" aria-hidden />,
    },
    offline: {
      label: "Mất kết nối",
      className: "bg-destructive/15 text-destructive",
      icon: <WifiOff className="size-3.5" aria-hidden />,
    },
  };
  const statusInfo = statusConfig[status];

  return (
    <div className="space-y-4 pt-4 md:pt-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button variant="ghost" size="sm" className="-ml-2 h-7" asChild>
          <Link href="/">
            <ArrowLeft aria-hidden /> Rời phòng
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-muted px-3 py-1 font-mono text-base font-semibold tracking-[0.25em] text-foreground">
            {roomCode.toUpperCase()}
          </span>
          <Button variant="ghost" size="icon-xs" onClick={handleCopy} aria-label="Sao chép link mời">
            {copied ? <Check className="text-emerald-500" aria-hidden /> : <Copy aria-hidden />}
          </Button>
        </div>

        <Badge variant="secondary" className={cn("gap-1.5 border-none", statusInfo.className)}>
          {statusInfo.icon}
          {statusInfo.label}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Player area */}
        <div className="space-y-3">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black ring-1 ring-border/60">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
              {status === "offline" ? (
                <>
                  <WifiOff className="size-8 text-muted-foreground" aria-hidden />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      Không thể kết nối tới phòng
                    </p>
                    <p className="max-w-xs text-xs text-muted-foreground">
                      Máy chủ xem chung chưa khả dụng. Vui lòng thử lại sau.
                    </p>
                  </div>
                  <Button size="sm" onClick={attemptConnect}>
                    Thử kết nối lại
                  </Button>
                </>
              ) : (
                <>
                  <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
                  <p className="text-sm text-muted-foreground">Đang tham gia phòng...</p>
                </>
              )}
            </div>
          </div>

          <div
            className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground"
            role="status"
          >
            <Users className="size-4 shrink-0" aria-hidden />
            Chia sẻ mã phòng trên cùng bạn bè để cùng xem. Phòng hỗ trợ tối đa 20 thành viên.
          </div>
        </div>

        {/* Chat panel */}
        <aside
          aria-label="Trò chuyện trong phòng"
          className="flex h-[420px] flex-col rounded-xl border border-border bg-card/50 lg:h-auto lg:max-h-[calc(min(56.25vw,42rem))]"
        >
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <MessageSquare className="size-4 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-semibold">Trò chuyện</h2>
            {messages.length > 0 ? (
              <span className="ml-auto text-xs text-muted-foreground">{messages.length} tin</span>
            ) : null}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.length === 0 ? (
              <p className="pt-8 text-center text-xs text-muted-foreground">
                {status === "connected"
                  ? "Chưa có tin nhắn nào. Hãy chào mọi người!"
                  : "Tin nhắn sẽ khả dụng khi phòng được kết nối."}
              </p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={cn("flex", m.own && "justify-end")}>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                      m.own
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm bg-muted text-foreground",
                    )}
                  >
                    {!m.own ? <p className="mb-0.5 text-[10px] opacity-60">{m.author}</p> : null}
                    <p className="break-words">{m.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <Separator />

          <form onSubmit={handleSend} className="flex items-center gap-2 p-3">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                status === "connected" ? "Nhập tin nhắn..." : "Chat khả dụng khi đã kết nối"
              }
              aria-label="Tin nhắn"
              maxLength={500}
              disabled={status !== "connected"}
            />
            <Button type="submit" size="icon" disabled={status !== "connected" || !draft.trim()} aria-label="Gửi">
              <Send aria-hidden />
            </Button>
          </form>
        </aside>
      </div>
    </div>
  );
}
