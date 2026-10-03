"use client";

import React, { useState } from "react";
import { ShieldCheck, Loader2, Eye, EyeOff } from "lucide-react";

export default function HqSettingsPage() {
  const [current, setCurrent] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const isSubmittingRef = React.useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    if (newPwd !== confirm) { setMsg({ type: "error", text: "New passwords do not match." }); return; }
    if (newPwd.length < 8) { setMsg({ type: "error", text: "Password must be at least 8 characters." }); return; }
    if (newPwd === current) { setMsg({ type: "error", text: "New password must differ from current password." }); return; }

    isSubmittingRef.current = true;
    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch("/api/hq/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: newPwd }),
      });
      const data = await res.json();

      if (data.success) {
        setMsg({ type: "success", text: "Password updated successfully." });
        setCurrent(""); setNewPwd(""); setConfirm("");
      } else {
        setMsg({ type: "error", text: data.error ?? "Failed to update password." });
      }
    } catch {
      setMsg({ type: "error", text: "Network error. Please try again." });
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const InputWithToggle = ({
    label, value, onChange, show, setShow, autoComplete,
  }: {
    label: string; value: string; onChange: (v: string) => void;
    show: boolean; setShow: (v: boolean) => void; autoComplete?: string;
  }) => (
    <div>
      <label className="block text-[12px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          required
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-galla-paper border border-galla-line rounded-[6px] px-3.5 py-2.5 pr-10 text-[14px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-2 focus:ring-galla-teal/10 transition-all"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-galla-ink-soft hover:text-galla-ink transition-colors cursor-pointer"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-6">
        <h1 className="text-[24px] font-bold text-galla-ink">Settings</h1>
        <p className="text-[13px] text-galla-ink-soft mt-0.5">Manage your admin account credentials.</p>
      </div>

      <div className="bg-white border border-galla-line rounded-[10px] overflow-hidden">
        {/* Section header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-galla-line">
          <div className="h-8 w-8 rounded-[8px] bg-galla-teal/10 flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-galla-teal" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-galla-ink">Change Password</p>
            <p className="text-[11px] text-galla-ink-soft">Requires current password to confirm</p>
          </div>
        </div>

        <div className="px-6 py-5">
          {msg && (
            <div className={["mb-5 p-3 rounded-[6px] text-[13px] border", msg.type === "success" ? "bg-galla-sage-soft text-galla-sage border-galla-sage/20" : "bg-red-50 text-red-700 border-red-200"].join(" ")}>
              {msg.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <InputWithToggle
              label="Current Password"
              value={current}
              onChange={setCurrent}
              show={showCurrent}
              setShow={setShowCurrent}
              autoComplete="current-password"
            />
            <InputWithToggle
              label="New Password"
              value={newPwd}
              onChange={setNewPwd}
              show={showNew}
              setShow={setShowNew}
              autoComplete="new-password"
            />
            <div>
              <label className="block text-[12px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={["w-full bg-galla-paper border rounded-[6px] px-3.5 py-2.5 text-[14px] text-galla-ink focus:outline-none focus:ring-2 transition-all", confirm && newPwd && confirm !== newPwd ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-galla-line focus:border-galla-teal focus:ring-galla-teal/10"].join(" ")}
              />
              {confirm && newPwd && confirm !== newPwd && (
                <p className="text-[11px] text-red-500 mt-1">Passwords don&apos;t match</p>
              )}
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={loading || !current || !newPwd || !confirm}
                className="flex items-center gap-2 bg-galla-ink hover:bg-galla-ink/90 text-white px-5 py-2.5 rounded-[6px] text-[13px] font-semibold transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
