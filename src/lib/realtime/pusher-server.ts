import Pusher from "pusher";

let pusherServerInstance: Pusher | null = null;

/**
 * Returns a cached server-side Pusher client instance.
 */
export function getPusherServer(): Pusher | null {
  if (pusherServerInstance) {
    return pusherServerInstance;
  }

  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "mt1";

  if (!appId || !key || !secret) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Pusher Server] Pusher credentials missing in environment variables. Realtime events will be skipped."
      );
    }
    return null;
  }

  pusherServerInstance = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });

  return pusherServerInstance;
}

/**
 * Triggers a tenant-scoped realtime event.
 * Enforces strict multi-tenancy channel isolation: channel is always `tenant-${tenantId}` or `private-tenant-${tenantId}`.
 */
export async function triggerTenantEvent({
  tenantId,
  event,
  data,
  isPrivate = false,
}: {
  tenantId: string;
  event: string;
  data: Record<string, unknown>;
  isPrivate?: boolean;
}): Promise<boolean> {
  const pusher = getPusherServer();
  if (!pusher) return false;

  const channelPrefix = isPrivate ? "private-tenant-" : "tenant-";
  const channel = `${channelPrefix}${tenantId}`;

  try {
    await pusher.trigger(channel, event, data);
    return true;
  } catch (error) {
    console.error(`[Pusher Server] Failed to trigger event "${event}" on channel "${channel}":`, error);
    return false;
  }
}
