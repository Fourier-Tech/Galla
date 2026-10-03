"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { hqLoginAction } from "../actions";
import { Loader2, AlertTriangle } from "lucide-react";

export default function HqLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = React.useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await hqLoginAction(email, password);
      if (res.success) {
        router.replace("/hq");
        router.refresh();
      } else {
        setError(res.error ?? "Login failed.");
        isSubmittingRef.current = false;
        setLoading(false);
      }
    } catch {
      setError("Network error. Please try again.");
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-galla-paper flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-[360px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-[14px] bg-white shadow-sm border border-galla-line flex items-center justify-center mb-4 overflow-hidden p-1">
            <Image
              src="/logo.png"
              alt="Galla"
              width={56}
              height={56}
              className="object-contain w-full h-full"
            />
          </div>
          <h1 className="text-[22px] font-bold text-galla-ink tracking-tight">Galla HQ</h1>
          <p className="text-[13px] text-galla-ink-soft mt-1">Restricted Admin Portal</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-galla-line rounded-[10px] p-6 shadow-sm">
          {error && (
            <div className="mb-5 flex items-start gap-2.5 p-3 rounded-[6px] bg-red-50 border border-red-200 text-[13px] text-red-800">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1.5">
                Admin Email
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-galla-paper border border-galla-line rounded-[6px] px-3.5 py-2.5 text-[14px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-2 focus:ring-galla-teal/10 transition-all"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1.5">
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-galla-paper border border-galla-line rounded-[6px] px-3.5 py-2.5 text-[14px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-2 focus:ring-galla-teal/10 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full flex items-center justify-center gap-2 bg-galla-ink hover:bg-galla-ink/90 text-white text-[14px] font-semibold px-4 py-2.5 rounded-[6px] transition-all disabled:opacity-50 cursor-pointer mt-1"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-galla-ink-soft/60 mt-6">
          Galla HQ · FourierTech Internal
        </p>
      </div>
    </div>
  );
}
