import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  TrendingUp,
  Send,
  Bot,
  ClipboardList,
  BarChart3,
  Building2,
  DollarSign,
  Globe,
  Radar,
  Settings,
  Sun,
  Moon,
  Zap,
  FileText,
  LogOut,
  CalendarDays,
  Sparkles,
  BrainCircuit,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/utils";
import { useCurrentUser, useLogout } from "@/lib/auth";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/source", icon: Zap, label: "Source" },
  { href: "/candidates", icon: Users, label: "Candidates" },
  { href: "/jobs", icon: Briefcase, label: "Jobs" },
  { href: "/opportunities", icon: TrendingUp, label: "Opportunities" },
  { href: "/clients", icon: Building2, label: "Client Portal" },
  { href: "/outreach", icon: Send, label: "Outreach" },
  { href: "/ai", icon: Bot, label: "AI Assistant" },
  { href: "/scheduling", icon: CalendarDays, label: "Scheduling" },
  { href: "/rediscovery", icon: Sparkles, label: "Rediscovery" },
  { href: "/candidate-evaluation", icon: BrainCircuit, label: "AI Candidate Evaluation" },
  { href: "/interviews", icon: ClipboardList, label: "Interviews" },
  { href: "/revenue", icon: DollarSign, label: "Revenue" },
  { href: "/invoices", icon: FileText, label: "Invoices" },
  { href: "/reports", icon: BarChart3, label: "Reports" },
  { href: "/intelligence", icon: Radar, label: "Intelligence Hub" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

function HireCommandLogo() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 32 32"
      fill="none"
      aria-label="HireCommand"
    >
      <rect width="32" height="32" rx="6" fill="hsl(217, 91%, 60%)" />
      <path
        d="M8 8v16M24 8v16M8 16h16"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function AppSidebar() {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { data: currentUser } = useCurrentUser();
  const logout = useLogout();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[220px] bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col z-50">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-sidebar-border">
        <HireCommandLogo />
        <span className="font-display font-bold text-sm tracking-tight text-white">
          HireCommand
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? location === "/" || location === ""
              : location.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <div
                data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                  isActive
                    ? "bg-sidebar-accent text-white"
                    : "text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon size={16} strokeWidth={1.8} />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle + footer */}
      <div className="px-3 pb-4 space-y-2">
        <button
          onClick={toggleTheme}
          data-testid="button-theme-toggle"
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent/50 transition-colors w-full"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
        {currentUser && (
          <div className="border-t border-sidebar-border pt-2 space-y-1">
            <div className="px-3 py-1">
              <p className="text-xs font-medium text-white/80 truncate">
                {currentUser.recruiterName ?? currentUser.username}
              </p>
              <p className="text-[11px] text-sidebar-foreground/40 truncate">
                {currentUser.email ?? ""}
              </p>
            </div>
            <button
              onClick={() => logout.mutate()}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent/50 transition-colors w-full"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
