import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPusherServer } from "@/lib/realtime/pusher-server";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pusher = getPusherServer();
  if (!pusher) {
    return NextResponse.json({ error: "Realtime service unavailable" }, { status: 503 });
  }

  try {
    const bodyText = await request.text();
    const params = new URLSearchParams(bodyText);
    const socketId = params.get("socket_id");
    const channelName = params.get("channel_name");

    if (!socketId || !channelName) {
      return NextResponse.json({ error: "Missing socket_id or channel_name" }, { status: 400 });
    }

    // Zero-Tolerance Tenancy: Validate that the requested channel matches the user's tenantId
    const expectedChannel = `private-tenant-${session.user.tenantId}`;
    if (channelName !== expectedChannel) {
      return NextResponse.json(
        { error: "Forbidden: Cannot subscribe to another tenant's channel" },
        { status: 403 }
      );
    }

    const authResponse = pusher.authorizeChannel(socketId, channelName, {
      user_id: session.user.id || session.user.tenantId,
      user_info: {
        role: session.user.role,
        tenantId: session.user.tenantId,
      },
    });

    return NextResponse.json(authResponse);
  } catch (error) {
    console.error("[Pusher Auth] Error authorizing channel:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
