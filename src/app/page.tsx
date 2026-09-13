import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-galla-paper text-galla-ink">
      {/* Header */}
      <header className="h-16 border-b border-galla-line bg-galla-surface px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Galla Logo"
            width={32}
            height={32}
            className="h-8 w-auto object-contain"
            priority
          />
          <div className="flex flex-col">
            <span className="font-heading font-semibold text-[18px] tracking-tight leading-none text-galla-ink">
              Galla
            </span>
            <span className="font-heading text-[10px] tracking-widest uppercase text-galla-ink-soft font-medium mt-0.5">
              Salon &amp; Parlour Management
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-3">
          <Link
            href="/api/auth/signin"
            className="inline-flex items-center justify-center font-sans text-[14px] font-medium text-galla-ink-soft hover:text-galla-ink px-[13px] py-[8px] rounded-[5px] transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center font-sans text-[14px] font-medium text-white bg-galla-teal hover:opacity-95 px-[13px] py-[8px] rounded-[5px] shadow-sm transition-opacity"
          >
            Open Dashboard &rarr;
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-[13px] py-[5px] rounded-[5px] border border-galla-sidebar-border bg-galla-teal-soft text-galla-teal text-[12px] font-semibold tracking-wide uppercase mb-6">
          Clean Luxury Editorial System
        </div>

        <h1 className="font-heading font-semibold text-[34px] sm:text-[42px] leading-tight tracking-[-0.02em] text-galla-ink max-w-2xl">
          Elevated Salon &amp; Beauty Parlour Operations
        </h1>

        <p className="font-sans text-[15px] sm:text-[16px] text-galla-ink-soft max-w-xl mt-4 leading-relaxed">
          From retail split inventory and service lifecycles to advance bookings, deposit conversions, and owner-only financial intelligence.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center font-sans text-[14px] font-medium text-white bg-galla-teal hover:opacity-95 px-[21px] py-[10px] rounded-[5px] shadow-sm transition-opacity"
          >
            Launch Galla Counter &rarr;
          </Link>
        </div>

        {/* Minimal Editorial Architectural Pillars */}
        <div className="grid sm:grid-cols-3 gap-px bg-galla-line border border-galla-line rounded-[5px] overflow-hidden mt-16 text-left w-full">
          <div className="bg-galla-surface p-[21px] space-y-2">
            <span className="font-mono text-[11px] text-galla-ink-soft uppercase tracking-wider block">01 / Tenancy</span>
            <h3 className="font-heading font-semibold text-[16px] text-galla-ink">Document-Level Silos</h3>
            <p className="font-sans text-[13px] text-galla-ink-soft leading-normal">
              Zero-tolerance multi-tenant data boundaries with strict server-side session extraction.
            </p>
          </div>

          <div className="bg-galla-surface p-[21px] space-y-2">
            <span className="font-mono text-[11px] text-galla-ink-soft uppercase tracking-wider block">02 / Ledger</span>
            <h3 className="font-heading font-semibold text-[16px] text-galla-ink">Split Stock &amp; Life Cycle</h3>
            <p className="font-sans text-[13px] text-galla-ink-soft leading-normal">
              Pieces-only units, automatic internal transfer expenses, and advance backorder resolution.
            </p>
          </div>

          <div className="bg-galla-surface p-[21px] space-y-2">
            <span className="font-mono text-[11px] text-galla-ink-soft uppercase tracking-wider block">03 / Privacy</span>
            <h3 className="font-heading font-semibold text-[16px] text-galla-ink">PIN Role Separation</h3>
            <p className="font-sans text-[13px] text-galla-ink-soft leading-normal">
              Single tenant login with Owner vs Staff PIN gate protecting historical financial analytics.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-14 border-t border-galla-line bg-galla-surface px-6 flex items-center justify-between text-[12px] text-galla-ink-soft font-sans">
        <span>&copy; {new Date().getFullYear()} Galla Platform • FourierTech</span>
        <span className="font-mono text-[11px]">Design System: Luxury Editorial Rose</span>
      </footer>
    </div>
  );
}
