"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Store, User } from "lucide-react";

interface DashboardHeaderProps {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
    tenantId?: string | null;
  };
  tenantName?: string;
}

export function DashboardHeader({ user, tenantName }: DashboardHeaderProps) {
  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Store className="h-4 w-4 text-primary" />
          <span>{tenantName || "Salon Workspace"}</span>
        </div>
        <Badge variant="outline" className="text-xs bg-muted/50">
          Tenant: {user.tenantId ? user.tenantId.slice(-6) : "Active"}
        </Badge>
        {user.role && (
          <Badge variant="secondary" className="text-xs capitalize">
            {user.role}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span className="font-medium text-foreground">{user.name || user.email}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4 mr-1.5" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
