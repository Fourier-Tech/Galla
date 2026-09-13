"use client";

import { useEffect, useRef } from "react";
import PusherClient from "pusher-js";

let clientInstance: PusherClient | null = null;

/**
 * Returns a cached browser-side Pusher client instance.
 */
export function getPusherClient(): PusherClient | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (clientInstance) {
    return clientInstance;
  }

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "mt1";

  if (!key) {
    return null;
  }

  clientInstance = new PusherClient(key, {
    cluster,
    authEndpoint: "/api/realtime/auth",
  });

  return clientInstance;
}

/**
 * React hook to subscribe to tenant-scoped realtime events.
 */
export function useTenantSubscription<T = unknown>({
  tenantId,
  event,
  onEvent,
  isPrivate = false,
}: {
  tenantId?: string | null;
  event: string;
  onEvent: (data: T) => void;
  isPrivate?: boolean;
}) {
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!tenantId) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const channelPrefix = isPrivate ? "private-tenant-" : "tenant-";
    const channelName = `${channelPrefix}${tenantId}`;
    const channel = pusher.subscribe(channelName);

    const handler = (data: unknown) => {
      onEventRef.current(data as T);
    };

    channel.bind(event, handler);

    return () => {
      channel.unbind(event, handler);
      pusher.unsubscribe(channelName);
    };
  }, [tenantId, event, isPrivate]);
}
