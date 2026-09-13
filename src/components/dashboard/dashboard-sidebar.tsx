import Link from "next/link";
import {
  LayoutDashboard,
  Boxes,
  CalendarClock,
  Sparkles,
  Settings,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const navItems = [
  {
    title: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    active: true,
  },
  {
    title: "Inventory",
    href: "#",
    icon: Boxes,
    badge: "PRD",
  },
  {
    title: "Orders & Services",
    href: "#",
    icon: CalendarClock,
    badge: "PRD",
  },
  {
    title: "Packages",
    href: "#",
    icon: Sparkles,
    badge: "PRD",
  },
  {
    title: "Settings",
    href: "#",
    icon: Settings,
    badge: "PRD",
  },
];

export function DashboardSidebar() {
  return (
    <aside className="w-64 border-r bg-card flex flex-col justify-between p-4 min-h-[calc(100vh-4rem)]">
      <div className="space-y-6">
        <div className="px-2">
          <div className="flex items-center gap-2 font-bold text-lg text-primary tracking-tight">
            <Layers className="h-5 w-5" />
            <span>Galla</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">SaaS Management</p>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  item.active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </div>
                {item.badge && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-3 rounded-lg border bg-muted/40 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Scaffold Mode</p>
        <p className="mt-1">Awaiting full PRD to implement domain models and operations.</p>
      </div>
    </aside>
  );
}
