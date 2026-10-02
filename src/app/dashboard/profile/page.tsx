"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDashboard } from "@/context/dashboard-context";
import { ProfileTab } from "@/components/dashboard/tabs/profile-tab";

export default function ProfilePage() {
  const router = useRouter();
  const { role, isRoleLocked, salonProfile, setSalonProfile } = useDashboard();

  useEffect(() => {
    if (!isRoleLocked && role === "staff") {
      router.replace("/dashboard/orders");
    }
  }, [role, isRoleLocked, router]);

  if (role !== "owner") {
    return (
      <div className="flex items-center justify-center h-64 text-galla-ink-soft">
        <p className="text-sm font-medium">Restricted access. Owner role required.</p>
      </div>
    );
  }

  return (
    <ProfileTab
      salonProfile={salonProfile}
      onUpdateProfile={setSalonProfile}
    />
  );
}
