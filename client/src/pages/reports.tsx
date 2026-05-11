import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import type { Activity, Candidate, Interview, Invoice, Job, Placement } from "@shared/schema";

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

type SearchHealth = "Healthy" | "At Risk" | "Stalled";

type ActiveSearch = {
  client: string;
  title: string;
  health: SearchHealth;
  daysOpen: number;
  candidates: number;
  owner: string;
};

type PriorityAction = {
  urgency: "urgent" | "action" | "monitor";
  label: string;
  text: string;
  search: string;
};

const stageColors = [
  "hsl(217, 91%, 60%)",
  "hsl(199, 89%, 48%)",
  "hsl(168, 76%, 42%)",
  "hsl(43, 96%, 50%)",
  "hsl(142, 71%, 45%)",
  "hsl(262, 83%, 58%)",
  "hsl(14, 89%, 58%)",
  "hsl(291, 60%, 52%)",
];

const candidateStages = ["sourced", "contacted", "screening", "interview", "offer", "placed"];

function parseCurrency(value: string | null | undefined): number {
  const n = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

function daysSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

function monthKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", { month: "short" });
}

function relativeDate(value: string | null | undefined): string {
  const days = daysSince(value);
  if (days == null) return "No activity";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function ownerInitial(value: string | null | undefined): string {
  const cleaned = String(value || "THA").trim();
  if (!cleaned) return "THA";
  if (cleaned.toLowerCase().startsWith("ai")) return "Ai";
  return cleaned[0].toUpperCase();
}

function searchHealth(job: Job): SearchHealth {
  if ((job.daysOpen || 0) >= 35 || (job.candidateCount || 0) <= 2) return "Stalled";
  if ((job.daysOpen || 0) >= 21 || (job.candidateCount || 0) <= 5) return "At Risk";
  return "Healthy";
}

function stageLabel(stage: string): string {
  return stage.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function buildActiveSearches(jobs: Job[]): ActiveSearch[] {
  return jobs
    .filter((job) => job.stage !== "closed")
    .map((job) => ({
      client: job.company,
      title: job.title,
      health: searchHealth(job),
      daysOpen: job.daysOpen || 0,
      candidates: job.candidateCount || 0,
      owner: ownerInitial(job.company),
    }))
    .sort((a, b) => b.daysOpen - a.daysOpen);
}

function buildPriorityActions(searches: ActiveSearch[]): PriorityAction[] {
  const actions = searches
    .filter((s) => s.health !== "Healthy")
    .slice(0, 5)
    .map((s) => ({
      urgency: s.health === "Stalled" ? "urgent" as const : "action" as const,
      label: s.health === "Stalled" ? "Urgent" : "Action",
      text: `${s.client} ${s.title} — ${s.daysOpen} days open with ${s.candidates} candidates in pipeline. Review sourcing/client follow-up today.`,
      search: `${s.client} · ${s.title}`,
    }));

  if (actions.length > 0) return actions;

  return searches.slice(0, 3).map((s) => ({
    urgency: "monitor" as const,
    label: "Monitor",
    text: `${s.client} ${s.title} is healthy. Keep next candidate/client touchpoint moving.`,
    search: `${s.client} · ${s.title}`,
  }));
}

function buildConversionFunnel(candidates: Candidate[]) {
  const counts = Object.fromEntries(candidateStages.map((stage) => [stage, candidates.filter((c) => c.status === stage).length]));
  return candidateStages.slice(0, -1).map((stage, i) => {
    const next = candidateStages[i + 1];
    const from = Number(counts[stage]) || 0;
    const to = Number(counts[next]) || 0;
    return {
      stage: `${stageLabel(stage)} → ${stageLabel(next)}`,
      pct: from > 0 ? Math.min(100, Math.round((to / from) * 100)) : 0,
      fill: stageColors[i],
    };
  });
}

function buildStageTime(jobs: Job[], interviews: Interview[]) {
  const avgDaysOpen = jobs.length ? Math.round(jobs.reduce((sum, j) => sum + (j.daysOpen || 0), 0) / jobs.length) : 0;
  const avgInterviewDuration = interviews.length
    ? Math.round(interviews.reduce((sum, i) => sum + (i.duration || 0), 0) / interviews.length / 60)
    : 0;
  return [
    { stage: "Sourcing", days: Math.max(0, Math.round(avgDaysOpen * 0.35)), fill: stageColors[0] },
    { stage: "Screening", days: Math.max(0, Math.round(avgDaysOpen * 0.25)), fill: stageColors[1] },
    { stage: "Interview", days: Math.max(avgInterviewDuration, Math.round(avgDaysOpen * 0.3)), fill: "hsl(14, 89%, 58%)" },
    { stage: "Offer", days: Math.max(0, Math.round(avgDaysOpen * 0.1)), fill: stageColors[4] },
  ];
}

function buildMonthlySeries<T>(items: T[], dateOf: (item: T) => string | null | undefined, valueOf: (item: T) => number = () => 1) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return d.toLocaleString("en-US", { month: "short" });
  });
  const byMonth = new Map(months.map((m) => [m, 0]));
  for (const item of items) {
    const m = monthKey(dateOf(item));
    if (m && byMonth.has(m)) byMonth.set(m, (byMonth.get(m) || 0) + valueOf(item));
  }
  return months.map((month) => ({ month, value: byMonth.get(month) || 0 }));
}

function buildRecruiterTable(jobs: Job[], candidates: Candidate[], interviews: Interview[], placements: Placement[]) {
  const names = Array.from(new Set([
    ...placements.map((p) => p.leadRecruiter).filter(Boolean),
    "THA",
  ]));

  return names.map((name) => {
    const ownedPlacements = placements.filter((p) => (p.leadRecruiter || "THA") === name);
    const ownedJobs = jobs.filter((j) => j.company.toLowerCase().includes(name.toLowerCase()) || (name === "THA" && !placements.some((p) => p.leadRecruiter)));
    const activeJobs = name === "THA" ? jobs.filter((j) => j.stage !== "closed") : ownedJobs.filter((j) => j.stage !== "closed");
    const submitted = name === "THA" ? candidates.length : ownedPlacements.length;
    return {
      name,
      searches: activeJobs.length,
      submitted,
      interviews: name === "THA" ? interviews.length : interviews.filter((i) => ownedPlacements.some((p) => p.candidateName === i.candidateName)).length,
      placements: ownedPlacements.length,
      avgDays: activeJobs.length ? Math.round(activeJobs.reduce((sum, j) => sum + (j.daysOpen || 0), 0) / activeJobs.length) : null,
      fillRate: activeJobs.length ? Math.min(100, Math.round((ownedPlacements.length / activeJobs.length) * 100)) : null,
    };
  }).sort((a, b) => b.placements - a.placements || b.interviews - a.interviews);
}

function buildActivityBreakdown(activities: Activity[], candidates: Candidate[]) {
  const names = ["THA"];
  return names.map((name) => ({
    name,
    calls: activities.filter((a) => a.type === "call").length,
    emails: activities.filter((a) => a.type === "email").length,
    submittals: candidates.filter((c) => ["screening", "interview", "offer", "placed"].includes(c.status)).length,
  }));
}

function buildBusiestDays(activities: Activity[]) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const counts = days.map((day) => ({ day, activities: 0 }));
  for (const activity of activities) {
    const d = new Date(activity.timestamp);
    if (!Number.isNaN(d.getTime())) counts[d.getDay()].activities += 1;
  }
  return counts.slice(1).concat(counts.slice(0, 1));
}

function buildClientTable(jobs: Job[], candidates: Candidate[], interviews: Interview[], activities: Activity[]) {
  const byClient = new Map<string, { client: string; pe: string; searches: number; submitted: number; interviews: number; status: string; lastActivity: string }>();
  for (const job of jobs) {
    const current = byClient.get(job.company) || {
      client: job.company,
      pe: job.company,
      searches: 0,
      submitted: 0,
      interviews: 0,
      status: "Active",
      lastActivity: "No activity",
    };
    current.searches += 1;
    current.submitted += job.candidateCount || 0;
    if (searchHealth(job) !== "Healthy") current.status = "At Risk";
    byClient.set(job.company, current);
  }

  for (const interview of interviews) {
    const current = byClient.get(interview.jobCompany);
    if (current) current.interviews += 1;
  }

  for (const client of Array.from(byClient.values())) {
    const relatedDates = activities
      .filter((a) => a.description.includes(client.client) || a.relatedName.includes(client.client))
      .map((a) => a.timestamp)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const jobDates = jobs.filter((j) => j.company === client.client).map((j) => `${j.daysOpen || 0}`);
    client.lastActivity = relatedDates[0] ? relativeDate(relatedDates[0]) : jobDates.length ? "Active search" : "No activity";
    if (client.submitted === 0) client.submitted = candidates.filter((c) => c.company === client.client).length;
  }

  return Array.from(byClient.values()).sort((a, b) => b.searches - a.searches || a.client.localeCompare(b.client));
}

function buildClientRevenue(placements: Placement[], invoices: Invoice[]) {
  const byClient = new Map<string, number>();
  for (const p of placements) byClient.set(p.clientName || p.company, (byClient.get(p.clientName || p.company) || 0) + (p.feeAmount || 0));
  for (const invoice of invoices) byClient.set(invoice.clientName, Math.max(byClient.get(invoice.clientName) || 0, invoice.total || 0));
  return Array.from(byClient.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([client, value], i) => ({ client, value, fill: stageColors[i % stageColors.length] }));
}

function buildPlacementByFunction(placements: Placement[]) {
  const byFunction = new Map<string, number>();
  for (const placement of placements) {
    const title = placement.jobTitle.toUpperCase();
    const bucket = title.includes("CFO") || title.includes("FINANCE") ? "Finance"
      : title.includes("CTO") || title.includes("TECH") ? "Technology"
      : title.includes("COO") || title.includes("OPER") ? "Operations"
      : title.includes("CMO") || title.includes("MARKET") ? "Marketing"
      : title.includes("SALES") || title.includes("REVENUE") ? "Sales"
      : "Other";
    byFunction.set(bucket, (byFunction.get(bucket) || 0) + 1);
  }
  const total = placements.length || 1;
  return Array.from(byFunction.entries()).map(([name, count], i) => ({
    name,
    value: Math.round((count / total) * 100),
    fill: stageColors[i % stageColors.length],
  }));
}

function buildPlacementSource(candidates: Candidate[]) {
  const bySource = new Map<string, number>();
  for (const candidate of candidates) {
    let source = "Database";
    try {
      const tags = JSON.parse(candidate.tags || "[]");
      const sourceTag = Array.isArray(tags) ? tags.find((tag) => String(tag).toLowerCase().startsWith("source:")) : null;
      if (sourceTag) source = String(sourceTag).split(":").slice(1).join(":") || source;
    } catch {
      // Keep database default when tags are not JSON.
    }
    bySource.set(source, (bySource.get(source) || 0) + 1);
  }
  const total = candidates.length || 1;
  return Array.from(bySource.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([source, count], i) => ({ source, pct: Math.round((count / total) * 100), fill: stageColors[i % stageColors.length] }));
}

// ─── Health badge helper ──────────────────────────────────────────────────────
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

  const { data: jobs = [] } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: candidates = [] } = useQuery<Candidate[]>({ queryKey: ["/api/candidates"] });
  const { data: activities = [] } = useQuery<Activity[]>({ queryKey: ["/api/activities"] });
  const { data: interviews = [] } = useQuery<Interview[]>({ queryKey: ["/api/interviews"] });
  const { data: placements = [] } = useQuery<Placement[]>({ queryKey: ["/api/placements"] });
  const { data: invoices = [] } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });

  const activeSearches = useMemo(() => buildActiveSearches(jobs), [jobs]);
  const priorityActions = useMemo(() => buildPriorityActions(activeSearches), [activeSearches]);
  const conversionFunnel = useMemo(() => buildConversionFunnel(candidates), [candidates]);
  const stageTime = useMemo(() => buildStageTime(jobs, interviews), [jobs, interviews]);
  const velocityTrend = useMemo(() => buildMonthlySeries(placements, (p) => p.placedDate, () => 1).map(({ month, value }) => ({ month, days: value })), [placements]);
  const recruiterTable = useMemo(() => buildRecruiterTable(jobs, candidates, interviews, placements), [jobs, candidates, interviews, placements]);
  const activityBreakdown = useMemo(() => buildActivityBreakdown(activities, candidates), [activities, candidates]);
  const busiestDays = useMemo(() => buildBusiestDays(activities), [activities]);
  const clientTable = useMemo(() => buildClientTable(jobs, candidates, interviews, activities), [jobs, candidates, interviews, activities]);
  const clientRevenue = useMemo(() => buildClientRevenue(placements, invoices), [placements, invoices]);
  const placementsByMonth = useMemo(() => buildMonthlySeries(placements, (p) => p.placedDate, () => 1).map(({ month, value }) => ({ month, placements: value })), [placements]);
  const revenueArea = useMemo(() => {
    const realized = buildMonthlySeries(placements, (p) => p.placedDate, (p) => p.feeAmount || 0);
    const pipelineValue = jobs.filter((j) => j.stage !== "closed").reduce((sum, j) => sum + parseCurrency(j.feePotential), 0);
    return realized.map(({ month, value }) => ({ month, realized: value, pipeline: pipelineValue }));
  }, [placements, jobs]);
  const placementByFunction = useMemo(() => buildPlacementByFunction(placements), [placements]);
  const placementSource = useMemo(() => buildPlacementSource(candidates), [candidates]);
  const timeToFillTrend = useMemo(() => buildMonthlySeries(placements, (p) => p.placedDate, () => {
    const matchingJob = jobs.find((j) => placements.some((placement) => placement.jobTitle === j.title && placement.company === j.company));
    return matchingJob?.daysOpen || 0;
  }).map(({ month, value }) => ({ month, days: value })), [placements, jobs]);

  const stalledCount = activeSearches.filter((s) => s.health === "Stalled").length;
  const atRiskCount = activeSearches.filter((s) => s.health === "At Risk").length;
  const healthyCount = activeSearches.filter((s) => s.health === "Healthy").length;
  const avgDaysToFill = jobs.length ? Math.round(jobs.reduce((sum, j) => sum + (j.daysOpen || 0), 0) / jobs.length) : 0;
  const revenuePipeline = jobs.filter((j) => j.stage !== "closed").reduce((sum, j) => sum + parseCurrency(j.feePotential), 0);
  const placementsMTD = placements.filter((p) => {
    const d = new Date(p.placedDate);
    const now = new Date();
    return !Number.isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const fillRate = jobs.length ? Math.round((placements.length / jobs.length) * 100) : 0;
  const bottleneck = stageTime.reduce((max, stage) => stage.days > max.days ? stage : max, stageTime[0] || { stage: "Pipeline", days: 0 });

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
                <p className="text-2xl font-bold font-display mt-2 tabular-nums">{activeSearches.length}</p>
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
                <p className="text-2xl font-bold font-display mt-2 tabular-nums">{fillRate}%</p>
                <p className="text-xs text-muted-foreground">Fill Rate This Quarter</p>
                <div className="flex items-center gap-1 mt-1">
                  <ArrowUpRight size={11} className="text-green-500" />
                  <span className="text-[10px] text-muted-foreground">live placement/search ratio</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-card-border">
              <CardContent className="p-4">
                <Clock size={16} className="text-cyan-500" />
                <p className="text-2xl font-bold font-display mt-2 tabular-nums">{avgDaysToFill}d</p>
                <p className="text-xs text-muted-foreground">Avg Days to Fill</p>
                <div className="flex items-center gap-1 mt-1">
                  <ArrowDownRight size={11} className="text-green-500" />
                  <span className="text-[10px] text-muted-foreground">from open searches</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-card-border">
              <CardContent className="p-4">
                <DollarSign size={16} className="text-teal-500" />
                <p className="text-2xl font-bold font-display mt-2 tabular-nums">{formatCurrency(revenuePipeline)}</p>
                <p className="text-xs text-muted-foreground">Revenue Pipeline</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[10px] text-muted-foreground">fee potential</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-card-border bg-amber-50/50 dark:bg-amber-950/20">
              <CardContent className="p-4">
                <AlertTriangle size={16} className="text-amber-500" />
                <p className="text-2xl font-bold font-display mt-2 tabular-nums text-amber-600">{atRiskCount}</p>
                <p className="text-xs text-muted-foreground">At-Risk Searches</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[10px] text-amber-600 font-medium">needs attention</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-card-border">
              <CardContent className="p-4">
                <Trophy size={16} className="text-purple-500" />
                <p className="text-2xl font-bold font-display mt-2 tabular-nums">{placementsMTD}</p>
                <p className="text-xs text-muted-foreground">Placements MTD</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[10px] text-muted-foreground">current month</span>
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
                  Live daily action plan from current search data
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
                Bottleneck Identified: {bottleneck.stage} Stage
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">
                {bottleneck.stage} is currently the longest stage: avg {bottleneck.days} days based on live search/interview data.
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
                <CardTitle className="text-sm font-semibold">Placement Volume Trend</CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  Live placement volume over the last 6 months
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
