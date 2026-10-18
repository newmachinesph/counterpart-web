"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Realtime, type TokenDetails } from "ably";
import { platform } from "@/lib/api/browser";

export function LiveNotifications() {
  const router = useRouter();
  useEffect(() => {
    let disposed = false;
    let client: Realtime | undefined;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(() => router.refresh(), 500); };
    const poll = setInterval(refresh, 60000);
    platform<{ token_details: TokenDetails; channels: string[] }>("realtime/token", {}).then(data => {
      if (disposed) return;
      client = new Realtime({ tokenDetails: data.token_details, authCallback: async (_, done) => {
        try { done(null, (await platform<{token_details: TokenDetails}>("realtime/token", {})).token_details); }
        catch { done("Live updates unavailable", null); }
      } });
      void client.channels.get(data.channels[0]).subscribe("notification.created", refresh);
      client.connection.on("connected", refresh);
    }).catch(() => { /* The inbox remains available through ordinary requests. */ });
    return () => { disposed = true; clearInterval(poll); clearTimeout(timer); client?.close(); };
  }, [router]);
  return null;
}
