import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  AlertTriangle,
  Trophy,
  Zap,
  Users,
  BarChart2,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ─── Period selector ──────────────────────────────────────────────────────────
const periods = ["This Week", "This Month", "This Quarter", "This Year"];

// ─── Shared tooltip style ─────────────────────────────────────────────────────
const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "6px",
    fontSize: "12px",
  },
};

// ─── Overview data ────────────────────────────────────────────────────────────
const activeSearches = [
  {
    client: "Meridian Capital",
    title: "Chief Financial Officer",
    health: "Stalled",
    daysOpen: 52,
    candidates: 3,
    owner: "A",
  },
  {
    client: "Summit Ventures",
    title: "Chief Technology Officer",
    health: "Stalled",
    daysOpen: 41,
    candidates: 5,
    owner: "R",
  },
  {
    client: "Harborview PE",
    title: "VP Operations",
    health: "Stalled",
    daysOpen: 38,
    candidates: 2,
    owner: "A",
  },
  {
    client: "CarePoint Health",
    title: "Chief Operating Officer",
    health: "At Risk",
    daysOpen: 29,
    candidates: 7,
    owner: "R",
  },
  {
    client: "TalentForge",
    title: "VP Sales",
    health: "At Risk",
    daysOpen: 22,
    candidates: 9,
    owner: "A",
  },
  {
    client: "Westfield Capital",
    title: "General Counsel",
    health: "At Risk",
    daysOpen: 18,
    candidates: 4,
    owner: "Ai",
  },
  {
    client: "DataPulse",
    title: "Chief Technology Officer",
    health: "Healthy",
    daysOpen: 14,
    candidates: 11,
    owner: "R",
  },
  {
    client: "Elevate Partners",
    title: "Chief Marketing Officer",
    health: "Healthy",
    daysOpen: 11,
    candidates: 8,
    owner: "A",
  },
  {
    client: "Riviera Health",
    title: "Chief Revenue Officer",
    health: "Healthy",
    daysOpen: 9,
    candidates: 6,
    owner: "Ai",
  },
  {
    client: "NorthStar Equity",
    title: "Head of Finance",
    health: "Healthy",
    daysOpen: 7,
    candidates: 5,
    owner: "R",
  },
  {
    client: "Polaris Group",
    title: "Chief People Officer",
    health: "Healthy",
    daysOpen: 5,
    candidates: 3,
    owner: "A",
  },
];

const priorityActions = [
  {
    urgency: "urgent",
    label: "Urgent",
    text: 'Meridian CFO — 0 candidate movement in 12 days. Send status update to Warburg Pincus contact.',
    search: "Meridian Capital · CFO",
  },
  {
    urgency: "urgent",
    label: "Urgent",
    text: "Summit CTO — Client hasn't responded to shortlist sent 9 days ago. Follow up today.",
    search: "Summit Ventures · CTO",
  },
  {
    urgency: "action",
    label: "Action",
    text: "CarePoint COO — Interview feedback from client overdue 3 days.",
    search: "CarePoint Health · COO",
  },
  {
    urgency: "action",
    label: "Action",
    text: "TalentForge VP Sales — Present 2 new candidates sourced this week.",
    search: "TalentForge · VP Sales",
  },
  {
    urgency: "monitor",
    label: "Monitor",
    text: "DataPulse CTO — Sarah Chen 2nd round scheduled. Confirm prep call.",
    search: "DataPulse · CTO",
  },
];

// ─── Pipeline Velocity data ───────────────────────────────────────────────────
const conversionFunnel = [
  { stage: "Sourced → Contacted", pct: 72, fill: "hsl(217, 91%, 60%)" },
  { stage: "Contacted → Screening", pct: 48, fill: "hsl(199, 89%, 48%)" },
  { stage: "Screening → Interview", pct: 61, fill: "hsl(168, 76%, 42%)" },
  { stage: "Interview → Offer", pct: 38, fill: "hsl(43, 96%, 50%)" },
  { stage: "Offer → Placed", pct: 82, fill: "hsl(142, 71%, 45%)" },
];

const stageTime = [
  { stage: "Sourcing", days: 8, fill: "hsl(217, 91%, 60%)" },
  { stage: "Screening", days: 12, fill: "hsl(199, 89%, 48%)" },
  { stage: "Interview", days: 18, fill: "hsl(14, 89%, 58%)" },
  { stage: "Offer", days: 6, fill: "hsl(142, 71%, 45%)" },
];

const velocityTrend = [
  { month: "Aug", days: 51 },
  { month: "Sep", days: 47 },
  { month: "Oct", days: 44 },
  { month: "Nov", days: 41 },
  { month: "Dec", days: 39 },
  { month: "Jan", days: 38 },
];

// ─── Recruiter Performance data ───────────────────────────────────────────────
const recruiterTable = [
  {
    name: "Andrew",
    searches: 5,
    submitted: 34,
    interviews: 18,
    placements: 2,
    avgDays: 35,
    fillRate: 72,
  },
  {
    name: "Ryan",
    searches: 4,
    submitted: 28,
    interviews: 14,
    placements: 1,
    avgDays: 41,
    fillRate: 58,
  },
  {
    name: "Aileen",
    searches: 2,
    submitted: 19,
    interviews: 8,
    placements: 0,
    avgDays: null,
    fillRate: null,
  },
];

const activityBreakdown = [
  { name: "Andrew", calls: 32, emails: 87, submittals: 34 },
  { name: "Ryan", calls: 26, emails: 71, submittals: 28 },
  { name: "Aileen", calls: 18, emails: 54, submittals: 19 },
];

const busiestDays = [
  { day: "Mon", activities: 42 },
  { day: "Tue", activities: 58 },
  { day: "Wed", activities: 61 },
  { day: "Thu", activities: 53 },
  { day: "Fri", activities: 37 },
];

// ─── Client Analytics data ────────────────────────────────────────────────────
const clientTable = [
  {
    client: "Meridian Capital",
    pe: "Warburg Pincus",
    searches: 2,
    submitted: 18,
    interviews: 9,
    status: "At Risk",
    lastActivity: "12 days ago",
  },
  {
    client: "Summit Ventures",
    pe: "Summit Partners",
    searches: 1,
    submitted: 12,
    interviews: 6,
    status: "At Risk",
    lastActivity: "9 days ago",
  },
  {
    client: "CarePoint Health",
    pe: "Blackstone",
    searches: 1,
    submitted: 15,
    interviews: 7,
    status: "Active",
    lastActivity: "3 days ago",
  },
  {
    client: "DataPulse",
    pe: "General Atlantic",
    searches: 1,
    submitted: 14,
    interviews: 8,
    status: "Active",
    lastActivity: "Today",
  },
  {
    client: "TalentForge",
    pe: "KKR",
    searches: 1,
    submitted: 11,
    interviews: 5,
    status: "Active",
    lastActivity: "2 days ago",
  },
  {
    client: "Elevate Partners",
    pe: "Bain Capital",
    searches: 1,
    submitted: 10,
    interviews: 4,
    status: "Active",
    lastActivity: "Yesterday",
  },
  {
    client: "Riviera Health",
    pe: "Apollo",
    searches: 2,
    submitted: 16,
    interviews: 8,
    status: "Active",
    lastActivity: "Today",
  },
  {
    client: "NorthStar Equity",
    pe: "TPG",
    searches: 2,
    submitted: 22,
    interviews: 11,
    status: "Active",
    lastActivity: "Yesterday",
  },
];

const clientRevenue = [
  { client: "NorthStar Equity", value: 480000, fill: "hsl(217, 91%, 60%)" },
  { client: "Riviera Health", value: 420000, fill: "hsl(199, 89%, 48%)" },
  { client: "Meridian Capital", value: 380000, fill: "hsl(168, 76%, 42%)" },
  { client: "CarePoint Health", value: 310000, fill: "hsl(43, 96%, 50%)" },
  { client: "DataPulse", value: 290000, fill: "hsl(262, 83%, 58%)" },
  { client: "TalentForge", value: 240000, fill: "hsl(142, 71%, 45%)" },
  { client: "Elevate Partners", value: 210000, fill: "hsl(14, 89%, 58%)" },
  { client: "Summit Ventures", value: 185000, fill: "hsl(291, 60%, 52%)" },
];

// ─── Placement Trends data ────────────────────────────────────────────────────
const placementsByMonth = [
  { month: "Feb", placements: 2 },
  { month: "Mar", placements: 3 },
  { month: "Apr", placements: 2 },
  { month: "May", placements: 4 },
  { month: "Jun", placements: 3 },
  { month: "Jul", placements: 5 },
  { month: "Aug", placements: 3 },
  { month: "Sep", placements: 4 },
  { month: "Oct", placements: 3 },
  { month: "Nov", placements: 5 },
  { month: "Dec", placements: 4 },
  { month: "Jan", placements: 3 },
];

const revenueArea = [
  { month: "Aug", realized: 185000, pipeline: 620000 },
  { month: "Sep", realized: 240000, pipeline: 710000 },
  { month: "Oct", realized: 195000, pipeline: 780000 },
  { month: "Nov", realized: 310000, pipeline: 850000 },
  { month: "Dec", realized: 280000, pipeline: 920000 },
  { month: "Jan", realized: 215000, pipeline: 2400000 },
];

const placementByFunction = [
  { name: "CFO", value: 30, fill: "hsl(217, 91%, 60%)" },
  { name: "CTO", value: 20, fill: "hsl(199, 89%, 48%)" },
  { name: "COO", value: 15, fill: "hsl(168, 76%, 42%)" },
  { name: "CMO", value: 10, fill: "hsl(43, 96%, 50%)" },
  { name: "VP Sales", value: 10, fill: "hsl(262, 83%, 58%)" },
  { name: "Other", value: 15, fill: "hsl(142, 71%, 45%)" },
];

const placementSource = [
  { source: "LinkedIn", pct: 35, fill: "hsl(217, 91%, 60%)" },
  { source: "Referral", pct: 28, fill: "hsl(199, 89%, 48%)" },
  { source: "Database", pct: 22, fill: "hsl(168, 76%, 42%)" },
  { source: "Conference", pct: 10, fill: "hsl(43, 96%, 50%)" },
  { source: "Other", pct: 5, fill: "hsl(142, 71%, 45%)" },
];

const timeToFillTrend = [
  { month: "Aug", days: 51 },
  { month: "Sep", days: 47 },
  { month: "Oct", days: 44 },
  { month: "Nov", days: 41 },
  { month: "Dec", days: 39 },
  { month: "Jan", days: 38 },
];

// ─── Health badge helper ──────────────────────────────────────────────────────
function HealthBadge({ health }: { health: string }) {
  if (health === "Healthy")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 text-[11px] font-semibold px-2 py-0.5">
        <CheckCircle2 size={10} />
        Healthy
      </span>
    );
  if (health === "At Risk")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-semibold px-2 py-0.5">
        <AlertTriangle size={10} />
        At Risk
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 text-[11px] font-semibold px-2 py-0.5">
      <AlertCircle size={10} />
      Stalled
    </span>
  );
}

// ─── Urgency badge helper ─────────────────────────────────────────────────────
function UrgencyDot({ urgency }: { urgency: string }) {
  if (urgency === "urgent")
    return <span className="text-base leading-none">🔴</span>;
  if (urgency === "action")
    return <span className="text-base leading-none">🟡</span>;
  return <span className="text-base leading-none">🟢</span>;
}

// ─── Owner badge helper ───────────────────────────────────────────────────────
function OwnerBadge({ initials }: { initials: string }) {
  const colors: Record<string, string> = {
    A: "bg-blue-100 text-blue-700",
    R: "bg-teal-100 text-teal-700",
    Ai: "bg-purple-100 text-purple-700",
  };
  return (
    <span
      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
        colors[initials] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {initials}
    </span>
  );
}

// ─── Client status badge ──────────────────────────────────────────────────────
function ClientStatusBadge({ status }: { status: string }) {
  if (status === "At Risk")
    return (
      <span className="rounded-full bg-amber-100 text-amber-700 text-[11px] font-semibold px-2 py-0.5">
        At Risk
      </span>
    );
  return (
    <span className="rounded-full bg-green-100 text-green-700 text-[11px] font-semibold px-2 py-0.5">
      Active
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Reports() {
  const [period, setPeriod] = useState("This Quarter");

  const stalledCount = activeSearches.filter((s) => s.health === "Stalled").length;
  const atRiskCount = activeSearches.filter((s) => s.health === "At Risk").length;
  const healthyCount = activeSearches.filter((s) => s.health === "Healthy").length;

  const sortedSearches = [
    ...activeSearches.filter((s) => s.health === "Stalled"),
    ...activeSearches.filter((s) => s.health === "At Risk"),
    ...activeSearches.filter((s) => s.health === "Healthy"),
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-xl">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Millee-style analytics · search health · pipeline velocity · recruiter performance
          </p>
        </div>
        <div className="flex gap-1 bg-muted p-1 rounded-lg">
          {periods.map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "ghost"}
              size="sm"
              className="text-xs h-7 px-3"
              onClick={() => setPeriod(p)}
            >
              {p}
            </Button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-9">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="velocity" className="text-xs">Pipeline Velocity</TabsTrigger>
          <TabsTrigger value="recruiters" className="text-xs">Recruiter Performance</TabsTrigger>
          <TabsTrigger value="clients" className="text-xs">Client Analytics</TabsTrigger>
          <TabsTrigger value="placements" className="text-xs">Placement Trends</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Overview ── */}
        <TabsContent value="overview" className="space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="border border-card-border">
              <CardContent className="p-4">
                <Briefcase size={16} className="text-blue-500" />
                <p className="text-2xl font-bold font-display mt-2 tabular-nums">11</p>
                <p className="text-xs text-muted-foreground">Active Searches</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {stalledCount} stalled · {atRiskCount} at risk
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-card-border">
              <CardContent className="p-4">
                <TrendingUp size={16} className="text-green-500" />
                <p className="text-2xl font-bold font-display mt-2 tabular-nums">67%</p>
                <p className="text-xs text-muted-foreground">Fill Rate This Quarter</p>
                <div className="flex items-center gap-1 mt-1">
                  <ArrowUpRight size={11} className="text-green-500" />
                  <span className="text-[10px] text-green-600 font-medium">from 42% last qtr</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-card-border">
              <CardContent className="p-4">
                <Clock size={16} className="text-cyan-500" />
                <p className="text-2xl font-bold font-display mt-2 tabular-nums">38d</p>
                <p className="text-xs text-muted-foreground">Avg Days to Fill</p>
                <div className="flex items-center gap-1 mt-1">
                  <ArrowDownRight size={11} className="text-green-500" />
                  <span className="text-[10px] text-green-600 font-medium">from 51d last qtr</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-card-border">
              <CardContent className="p-4">
                <DollarSign size={16} className="text-teal-500" />
                <p className="text-2xl font-bold font-display mt-2 tabular-nums">$2.4M</p>
                <p className="text-xs text-muted-foreground">Revenue Pipeline</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[10px] text-muted-foreground">fee potential</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-card-border bg-amber-50/50 dark:bg-amber-950/20">
              <CardContent className="p-4">
                <AlertTriangle size={16} className="text-amber-500" />
                <p className="text-2xl font-bold font-display mt-2 tabular-nums text-amber-600">3</p>
                <p className="text-xs text-muted-foreground">At-Risk Searches</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[10px] text-amber-600 font-medium">needs attention</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-card-border">
              <CardContent className="p-4">
                <Trophy size={16} className="text-purple-500" />
                <p className="text-2xl font-bold font-display mt-2 tabular-nums">3</p>
                <p className="text-xs text-muted-foreground">Placements MTD</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[10px] text-muted-foreground">Jan 2025</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search Health Board + Priority Actions */}
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Search Health Board */}
            <Card className="border border-card-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart2 size={14} className="text-muted-foreground" />
                    Search Health Board
                  </CardTitle>
                  <div className="flex gap-2 text-[10px]">
                    <span className="bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-semibold">
                      {stalledCount} Stalled
                    </span>
                    <span className="bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-semibold">
                      {atRiskCount} At Risk
                    </span>
                    <span className="bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-semibold">
                      {healthyCount} Healthy
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {sortedSearches.map((search, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors"
                    >
                      <OwnerBadge initials={search.owner} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{search.client}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{search.title}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-[11px] font-medium tabular-nums">{search.daysOpen}d</p>
                          <p className="text-[10px] text-muted-foreground">open</p>
                        </div>
                        <div className="text-right hidden sm:block">
                          <p className="text-[11px] font-medium tabular-nums">{search.candidates}</p>
                          <p className="text-[10px] text-muted-foreground">in pipe</p>
                        </div>
                        <HealthBadge health={search.health} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Today's Priority Actions */}
            <Card className="border border-card-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Zap size={14} className="text-amber-500" />
                  Today's Priority Actions
                </CardTitle>
                <p className="text-[11px] text-muted-foreground -mt-1">
                  Millee-generated daily action plan
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {priorityActions.map((action, i) => (
                  <div
                    key={i}
                    className={`rounded-lg p-3 border ${
                      action.urgency === "urgent"
                        ? "bg-red-50/60 border-red-200 dark:bg-red-950/20 dark:border-red-900"
                        : action.urgency === "action"
                        ? "bg-amber-50/60 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900"
                        : "bg-green-50/60 border-green-200 dark:bg-green-950/20 dark:border-green-900"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <UrgencyDot urgency={action.urgency} />
                      <div className="min-w-0">
                        <p className="text-xs leading-snug">{action.text}</p>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">
                          {action.search}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Tab 2: Pipeline Velocity ── */}
        <TabsContent value="velocity" className="space-y-4">
          {/* Bottleneck highlight */}
          <div className="rounded-lg border border-orange-200 bg-orange-50/60 dark:bg-orange-950/20 dark:border-orange-900 p-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                Bottleneck Identified: Interview Stage
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">
                Interview stage is your biggest bottleneck: avg 18 days. Industry benchmark: 12 days.
                Closing this gap could reduce overall time-to-fill by ~35%.
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Stage Conversion Funnel */}
            <Card className="border border-card-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Stage Conversion Rates</CardTitle>
                <p className="text-[11px] text-muted-foreground">% of candidates advancing to next stage</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={conversionFunnel}
                    layout="vertical"
                    margin={{ left: 10, right: 30, top: 5, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis
                      dataKey="stage"
                      type="category"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      width={130}
                    />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(v: number) => [`${v}%`, "Conversion"]}
                    />
                    <Bar dataKey="pct" radius={[0, 4, 4, 0]} barSize={20}>
                      {conversionFunnel.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Time at Each Stage */}
            <Card className="border border-card-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Avg Days at Each Stage</CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  Where time is being spent in the process
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={stageTime}
                    layout="vertical"
                    margin={{ left: 10, right: 30, top: 5, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v) => `${v}d`}
                    />
                    <YAxis
                      dataKey="stage"
                      type="category"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      width={70}
                    />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(v: number) => [`${v} days`, "Avg Duration"]}
                    />
                    <Bar dataKey="days" radius={[0, 4, 4, 0]} barSize={28}>
                      {stageTime.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Velocity Trend */}
            <Card className="border border-card-border lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Avg Days-to-Fill Trend</CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  Improving velocity over the last 6 months
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart
                    data={velocityTrend}
                    margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      domain={[30, 60]}
                      tickFormatter={(v) => `${v}d`}
                    />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(v: number) => [`${v} days`, "Avg to Fill"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="days"
                      stroke="hsl(199, 89%, 48%)"
                      strokeWidth={2.5}
                      dot={{ fill: "hsl(199, 89%, 48%)", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Tab 3: Recruiter Performance ── */}
        <TabsContent value="recruiters" className="space-y-4">
          {/* Leaderboard table */}
          <Card className="border border-card-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users size={14} className="text-muted-foreground" />
                Recruiter Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left text-[11px] font-semibold text-muted-foreground px-4 py-2.5">
                        Recruiter
                      </th>
                      <th className="text-center text-[11px] font-semibold text-muted-foreground px-3 py-2.5">
                        Active Searches
                      </th>
                      <th className="text-center text-[11px] font-semibold text-muted-foreground px-3 py-2.5">
                        Submitted
                      </th>
                      <th className="text-center text-[11px] font-semibold text-muted-foreground px-3 py-2.5">
                        Interviews
                      </th>
                      <th className="text-center text-[11px] font-semibold text-muted-foreground px-3 py-2.5">
                        Placements
                      </th>
                      <th className="text-center text-[11px] font-semibold text-muted-foreground px-3 py-2.5">
                        Avg Days
                      </th>
                      <th className="text-center text-[11px] font-semibold text-muted-foreground px-3 py-2.5">
                        Fill Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recruiterTable.map((r, i) => (
                      <tr
                        key={r.name}
                        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {i === 0 && (
                              <Trophy size={12} className="text-amber-500 flex-shrink-0" />
                            )}
                            <span className="font-medium text-sm">{r.name}</span>
                          </div>
                        </td>
                        <td className="text-center px-3 py-3 tabular-nums text-sm">{r.searches}</td>
                        <td className="text-center px-3 py-3 tabular-nums text-sm">{r.submitted}</td>
                        <td className="text-center px-3 py-3 tabular-nums text-sm">{r.interviews}</td>
                        <td className="text-center px-3 py-3">
                          <span
                            className={`tabular-nums text-sm font-semibold ${
                              r.placements > 0 ? "text-green-600" : "text-muted-foreground"
                            }`}
                          >
                            {r.placements}
                          </span>
                        </td>
                        <td className="text-center px-3 py-3 tabular-nums text-sm">
                          {r.avgDays != null ? `${r.avgDays}d` : "—"}
                        </td>
                        <td className="text-center px-3 py-3">
                          {r.fillRate != null ? (
                            <div className="flex items-center gap-2 justify-center">
                              <Progress
                                value={r.fillRate}
                                className="h-1.5 w-16"
                              />
                              <span className="text-xs tabular-nums font-medium">{r.fillRate}%</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Activity Breakdown */}
            <Card className="border border-card-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Activity Breakdown (Last 30 Days)</CardTitle>
                <p className="text-[11px] text-muted-foreground">Calls, emails, and submittals per recruiter</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={activityBreakdown}
                    margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip {...tooltipStyle} />
                    <Legend
                      verticalAlign="bottom"
                      height={28}
                      formatter={(v) => <span className="text-xs">{v}</span>}
                    />
                    <Bar dataKey="calls" name="Calls" fill="hsl(217, 91%, 60%)" radius={[3, 3, 0, 0]} barSize={18} />
                    <Bar dataKey="emails" name="Emails" fill="hsl(199, 89%, 48%)" radius={[3, 3, 0, 0]} barSize={18} />
                    <Bar dataKey="submittals" name="Submittals" fill="hsl(168, 76%, 42%)" radius={[3, 3, 0, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Busiest Day of Week */}
            <Card className="border border-card-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Busiest Day of Week</CardTitle>
                <p className="text-[11px] text-muted-foreground">Total activities Mon–Fri (last 30 days)</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={busiestDays}
                    margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip {...tooltipStyle} formatter={(v: number) => [v, "Activities"]} />
                    <Bar
                      dataKey="activities"
                      radius={[4, 4, 0, 0]}
                      barSize={36}
                    >
                      {busiestDays.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={
                            entry.activities === Math.max(...busiestDays.map((d) => d.activities))
                              ? "hsl(199, 89%, 48%)"
                              : "hsl(217, 91%, 60%)"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Tab 4: Client Analytics ── */}
        <TabsContent value="clients" className="space-y-4">
          {/* Retention card */}
          <div className="rounded-lg border border-teal-200 bg-teal-50/60 dark:bg-teal-950/20 dark:border-teal-900 p-4 flex items-center gap-3">
            <CheckCircle2 size={16} className="text-teal-500 flex-shrink-0" />
            <p className="text-sm text-teal-800 dark:text-teal-300 font-medium">
              Client Retention: 7 of 8 clients are repeat engagements — indicating strong relationship quality and delivery track record.
            </p>
          </div>

          {/* Client table */}
          <Card className="border border-card-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Client Overview</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left text-[11px] font-semibold text-muted-foreground px-4 py-2.5">Client</th>
                      <th className="text-left text-[11px] font-semibold text-muted-foreground px-3 py-2.5">PE Firm</th>
                      <th className="text-center text-[11px] font-semibold text-muted-foreground px-3 py-2.5">Searches</th>
                      <th className="text-center text-[11px] font-semibold text-muted-foreground px-3 py-2.5">Submitted</th>
                      <th className="text-center text-[11px] font-semibold text-muted-foreground px-3 py-2.5">Interviews</th>
                      <th className="text-center text-[11px] font-semibold text-muted-foreground px-3 py-2.5">Status</th>
                      <th className="text-right text-[11px] font-semibold text-muted-foreground px-4 py-2.5">Last Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientTable.map((c, i) => (
                      <tr
                        key={i}
                        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-2.5 font-medium text-sm">{c.client}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{c.pe}</td>
                        <td className="text-center px-3 py-2.5 tabular-nums text-sm">{c.searches}</td>
                        <td className="text-center px-3 py-2.5 tabular-nums text-sm">{c.submitted}</td>
                        <td className="text-center px-3 py-2.5 tabular-nums text-sm">{c.interviews}</td>
                        <td className="text-center px-3 py-2.5">
                          <ClientStatusBadge status={c.status} />
                        </td>
                        <td className="text-right px-4 py-2.5 text-xs text-muted-foreground">{c.lastActivity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Revenue by client */}
          <Card className="border border-card-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Revenue by Client (Fee Potential)</CardTitle>
              <p className="text-[11px] text-muted-foreground">Estimated fee potential across all active searches</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={clientRevenue}
                  layout="vertical"
                  margin={{ left: 10, right: 50, top: 5, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                  />
                  <YAxis
                    dataKey="client"
                    type="category"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    width={110}
                  />
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(v: number) => [
                      `$${(v / 1000).toFixed(0)}K`,
                      "Fee Potential",
                    ]}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={22}>
                    {clientRevenue.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 5: Placement Trends ── */}
        <TabsContent value="placements" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Placements by Month */}
            <Card className="border border-card-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Placements by Month</CardTitle>
                <p className="text-[11px] text-muted-foreground">12-month placement history</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={placementsByMonth}
                    margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip {...tooltipStyle} formatter={(v: number) => [v, "Placements"]} />
                    <Bar
                      dataKey="placements"
                      fill="hsl(217, 91%, 60%)"
                      radius={[4, 4, 0, 0]}
                      barSize={28}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Revenue Realized vs Pipeline */}
            <Card className="border border-card-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Revenue: Realized vs Pipeline</CardTitle>
                <p className="text-[11px] text-muted-foreground">Fees closed vs total fee potential</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart
                    data={revenueArea}
                    margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="gradPipeline" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradRealized" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                    />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(v: number) => [`$${(v / 1000).toFixed(0)}K`]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={28}
                      formatter={(v) => <span className="text-xs">{v}</span>}
                    />
                    <Area
                      type="monotone"
                      dataKey="pipeline"
                      name="Pipeline"
                      stroke="hsl(199, 89%, 48%)"
                      strokeWidth={2}
                      fill="url(#gradPipeline)"
                    />
                    <Area
                      type="monotone"
                      dataKey="realized"
                      name="Realized"
                      stroke="hsl(142, 71%, 45%)"
                      strokeWidth={2}
                      fill="url(#gradRealized)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Placement by Function */}
            <Card className="border border-card-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Placement by Function</CardTitle>
                <p className="text-[11px] text-muted-foreground">Distribution across executive functions</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={placementByFunction}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      dataKey="value"
                      stroke="none"
                    >
                      {placementByFunction.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(v: number) => [`${v}%`, "Share"]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(v) => <span className="text-xs">{v}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Time-to-Fill Trend */}
            <Card className="border border-card-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Time-to-Fill Trend (Days)</CardTitle>
                <p className="text-[11px] text-muted-foreground">Improving — down 13 days over 6 months</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart
                    data={timeToFillTrend}
                    margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      domain={[30, 60]}
                      tickFormatter={(v) => `${v}d`}
                    />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(v: number) => [`${v} days`, "Avg to Fill"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="days"
                      stroke="hsl(217, 91%, 60%)"
                      strokeWidth={2.5}
                      dot={{ fill: "hsl(217, 91%, 60%)", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Source of Placements */}
          <Card className="border border-card-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Source of Placements</CardTitle>
              <p className="text-[11px] text-muted-foreground">Where placed candidates originated</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {placementSource.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-20 text-xs text-right text-muted-foreground flex-shrink-0">
                    {s.source}
                  </div>
                  <div className="flex-1">
                    <Progress
                      value={s.pct}
                      className="h-2"
                      style={{ "--progress-fill": s.fill } as React.CSSProperties}
                    />
                  </div>
                  <div className="w-10 text-xs tabular-nums font-semibold text-right">
                    {s.pct}%
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
