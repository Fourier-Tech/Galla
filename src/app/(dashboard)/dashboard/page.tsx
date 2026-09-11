import { auth } from "@/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ShieldCheck, Database, LayoutGrid } from "lucide-react";

export const metadata = {
  title: "Dashboard - Vantly",
  description: "Salon management workspace dashboard",
};

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Salon Dashboard</h2>
        <p className="text-muted-foreground text-sm">
          Welcome back, {user?.name || "Salon Owner"}. Your multi-tenant space is active.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Tenant Workspace</CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">
              {user?.tenantId ? `Tenant #${user.tenantId.slice(-6)}` : "Connected"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Multi-tenant isolated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Database Layer</CardTitle>
            <Database className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">MongoDB Atlas</div>
            <p className="text-xs text-muted-foreground mt-1">Mongoose cached connection</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Authentication</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">NextAuth.js</div>
            <p className="text-xs text-muted-foreground mt-1">JWT session credentials</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Domain Features</CardTitle>
            <LayoutGrid className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-normal">
                PRD Pending
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ready for feature work</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scaffold Status & Next Steps</CardTitle>
          <CardDescription>
            Core infrastructure is configured and ready for business requirements.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="p-4 rounded-lg border bg-muted/20 space-y-2">
              <div className="font-semibold text-sm">Configured Infrastructure</div>
              <ul className="text-xs space-y-1.5 text-muted-foreground">
                <li>• Next.js App Router (TypeScript) with Tailwind &amp; shadcn/ui</li>
                <li>• Serverless Mongoose connection handler with global connection pooling</li>
                <li>• NextAuth credentials provider with password hashing via bcrypt</li>
                <li>• Multi-tenant Tenant and User domain schema boundaries</li>
                <li>• Zod input validation on API boundary</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg border bg-muted/20 space-y-2">
              <div className="font-semibold text-sm">Awaiting Product Requirements</div>
              <ul className="text-xs space-y-1.5 text-muted-foreground">
                <li>• Inventory intake &amp; stock tracking lifecycles</li>
                <li>• Orders, appointments, services &amp; packages models</li>
                <li>• Conversions, refunds &amp; advance bookings</li>
                <li>• Role-gated analytics &amp; permissions (owner vs. staff)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
