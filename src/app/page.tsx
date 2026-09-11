import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sparkles,
  ShieldCheck,
  Boxes,
  CalendarCheck,
  ArrowRight,
  Layers,
} from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
          <Layers className="h-6 w-6" />
          <span>Vantly</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
            Sign In
          </Link>
          <Link href="/register" className={buttonVariants()}>
            Create Salon Workspace
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 bg-linear-to-b from-background via-muted/20 to-background">
        <div className="max-w-3xl space-y-6">
          <Badge variant="outline" className="px-3 py-1 text-xs font-normal">
            Multi-Tenant Salon &amp; Beauty Parlour Platform
          </Badge>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-foreground">
            Modern shop operations for salons &amp; parlours
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            From inventory intake and stock tracking to complete service lifecycles and advance bookings. A dedicated, subscription-ready workspace for every salon owner.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/register"
              className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}
            >
              Start Salon Workspace <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className={buttonVariants({
                size: "lg",
                variant: "outline",
                className: "w-full sm:w-auto",
              })}
            >
              Sign In to Dashboard
            </Link>
          </div>
        </div>

        {/* Feature Overview Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mt-20 text-left">
          <Card className="border bg-card/60">
            <CardHeader className="space-y-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <CardTitle className="text-base">Multi-Tenant Isolation</CardTitle>
              <CardDescription>
                Dedicated tenant data boundaries for every paying shop owner and parlour.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border bg-card/60">
            <CardHeader className="space-y-2">
              <Boxes className="h-6 w-6 text-primary" />
              <CardTitle className="text-base">Stock &amp; Inventory</CardTitle>
              <CardDescription>
                Intake tracking, usage monitoring, and stock alerts designed for beauty workflows.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border bg-card/60">
            <CardHeader className="space-y-2">
              <CalendarCheck className="h-6 w-6 text-primary" />
              <CardTitle className="text-base">Service &amp; Order Lifecycles</CardTitle>
              <CardDescription>
                Advance bookings, conversions, package management, and refund workflows.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border bg-card/60">
            <CardHeader className="space-y-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <CardTitle className="text-base">Role-Gated Access</CardTitle>
              <CardDescription>
                Role-based access controls separating shop owners from operational staff.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 px-6 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} Vantly SaaS. All rights reserved.
      </footer>
    </div>
  );
}
