import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Brain,
  Network,
  Building2,
  TrendingUp,
  ArrowRightLeft,
  Zap,
  Search,
  Send,
  Filter,
  Users,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Clock,
  MapPin,
  Briefcase,
  Target,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  User,
  Link2,
  Mail,
  Calendar,
  Globe,
  BarChart3,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import type { Candidate, Job, LoxoClient } from "@shared/schema";

const titleCaseStage = (value: string) => value
  .split(/[ _-]+/)
  .filter(Boolean)
  .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
  .join(" ");

// ═══════════════════════════════════════════════════════════════
// DATA LAYER — All intelligence data used across tabs
// ═══════════════════════════════════════════════════════════════

// ─── Talent Flow Data ──────────────────────────────────────

interface FlowNode { id: string; label: string; value: number; side: "left" | "right"; color: string }
interface FlowLink { source: string; target: string; value: number }

// ─── Company Intelligence Data ──────────────────────────────────────

interface CompanyIntel {
  id: string;
  name: string;
  sector: string;
  peSponsor: string;
  revenue: string;
  headcount: number;
  headcountChange: number;
  leadershipGaps: string[];
  recentHires: { name: string; title: string; from: string; date: string }[];
  recentDepartures: { name: string; title: string; to: string; date: string }[];
  fundingStage: string;
  lastFunding: string;
  signals: string[];
  momentum: "accelerating" | "stable" | "decelerating";
  location: string;
  openJobs?: number;
  candidateCount?: number;
  website?: string;
  syncedAt?: string;
}

// ─── Connection Map Data ──────────────────────────────────────

interface TeamMember {
  name: string;
  role: string;
  connections: { entity: string; type: "candidate" | "company" | "pe_firm" | "exec"; strength: "strong" | "warm" | "cold"; lastContact: string; notes: string }[];
}

// ─── Signal Feed Data ──────────────────────────────────────

interface Signal {
  id: string;
  type: "leadership_move" | "funding" | "hiring_surge" | "departure" | "acquisition" | "ipo_signal";
  headline: string;
  detail: string;
  company: string;
  timestamp: string;
  relevance: "high" | "medium" | "low";
  actionable: boolean;
  suggestedAction?: string;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT: Sankey Diagram (SVG-based Talent Flow)
// ═══════════════════════════════════════════════════════════════

function SankeyDiagram({ nodes, links }: { nodes: FlowNode[]; links: FlowLink[] }) {
  const width = 900;
  const height = 420;
  const nodeWidth = 18;
  const padding = 40;
  const leftX = padding;
  const rightX = width - padding - nodeWidth;

  const leftNodes = nodes.filter((n) => n.side === "left");
  const rightNodes = nodes.filter((n) => n.side === "right");

  const totalLeft = leftNodes.reduce((s, n) => s + n.value, 0);
  const totalRight = rightNodes.reduce((s, n) => s + n.value, 0);

  const usableHeight = height - 40;
  const nodeGap = 8;

  function layoutNodes(list: FlowNode[], total: number): (FlowNode & { y: number; h: number })[] {
    const totalGap = (list.length - 1) * nodeGap;
    const scale = (usableHeight - totalGap) / total;
    let y = 20;
    return list.map((n) => {
      const h = Math.max(n.value * scale, 4);
      const result = { ...n, y, h };
      y += h + nodeGap;
      return result;
    });
  }

  const leftLayout = layoutNodes(leftNodes, totalLeft);
  const rightLayout = layoutNodes(rightNodes, totalRight);

  // Track cumulative offsets for link positioning
  const leftOffsets: Record<string, number> = {};
  const rightOffsets: Record<string, number> = {};
  leftLayout.forEach((n) => (leftOffsets[n.id] = 0));
  rightLayout.forEach((n) => (rightOffsets[n.id] = 0));

  const maxLinkVal = Math.max(...links.map(l => l.value));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 420 }}>
      {/* Links */}
      {links.map((link, i) => {
        const src = leftLayout.find((n) => n.id === link.source);
        const tgt = rightLayout.find((n) => n.id === link.target);
        if (!src || !tgt) return null;

        const srcScale = src.h / src.value;
        const tgtScale = tgt.h / tgt.value;
        const linkH_src = link.value * srcScale;
        const linkH_tgt = link.value * tgtScale;

        const sy = src.y + leftOffsets[link.source];
        const ty = tgt.y + rightOffsets[link.target];
        leftOffsets[link.source] += linkH_src;
        rightOffsets[link.target] += linkH_tgt;

        const x0 = leftX + nodeWidth;
        const x1 = rightX;
        const mx = (x0 + x1) / 2;

        const opacity = 0.12 + (link.value / maxLinkVal) * 0.22;

        return (
          <path
            key={i}
            d={`M${x0},${sy} C${mx},${sy} ${mx},${ty} ${x1},${ty} L${x1},${ty + linkH_tgt} C${mx},${ty + linkH_tgt} ${mx},${sy + linkH_src} ${x0},${sy + linkH_src} Z`}
            fill={src.color}
            opacity={opacity}
            className="transition-opacity hover:opacity-60"
          />
        );
      })}
      {/* Left nodes */}
      {leftLayout.map((n) => (
        <g key={n.id}>
          <rect x={leftX} y={n.y} width={nodeWidth} height={n.h} rx={3} fill={n.color} />
          <text x={leftX + nodeWidth + 8} y={n.y + n.h / 2} dominantBaseline="middle" className="text-[11px] fill-current" style={{ fill: "var(--foreground, #374151)" }}>
            {n.label}
          </text>
          <text x={leftX - 6} y={n.y + n.h / 2} dominantBaseline="middle" textAnchor="end" className="text-[10px]" style={{ fill: "var(--muted-foreground, #9ca3af)" }}>
            {n.value}
          </text>
        </g>
      ))}
      {/* Right nodes */}
      {rightLayout.map((n) => (
        <g key={n.id}>
          <rect x={rightX} y={n.y} width={nodeWidth} height={n.h} rx={3} fill={n.color} />
          <text x={rightX - 8} y={n.y + n.h / 2} dominantBaseline="middle" textAnchor="end" className="text-[11px] fill-current" style={{ fill: "var(--foreground, #374151)" }}>
            {n.label}
          </text>
          <text x={rightX + nodeWidth + 6} y={n.y + n.h / 2} dominantBaseline="middle" className="text-[10px]" style={{ fill: "var(--muted-foreground, #9ca3af)" }}>
            {n.value}
          </text>
        </g>
      ))}
      {/* Column headers */}
      <text x={leftX + nodeWidth / 2} y={10} textAnchor="middle" className="text-[10px] font-semibold uppercase tracking-wider" style={{ fill: "var(--muted-foreground, #9ca3af)" }}>
        Source
      </text>
      <text x={rightX + nodeWidth / 2} y={10} textAnchor="middle" className="text-[10px] font-semibold uppercase tracking-wider" style={{ fill: "var(--muted-foreground, #9ca3af)" }}>
        Destination
      </text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 1: TALENT FLOWS
// ═══════════════════════════════════════════════════════════════

function TalentFlowsTab() {
  const [selectedFunction, setSelectedFunction] = useState("finance");
  const { data: candidates = [], isLoading: candidatesLoading } = useQuery<Candidate[]>({ queryKey: ["/api/candidates"] });
  const { data: jobs = [], isLoading: jobsLoading } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });

  const data = useMemo(() => {
    const functionLabels: Record<string, string[]> = {
      finance: ["cfo", "finance", "controller", "accounting", "fp&a", "treasury"],
      technology: ["cto", "technology", "engineering", "software", "data", "product"],
      operations: ["coo", "operations", "supply", "manufacturing", "logistics", "general manager"],
    };
    const terms = functionLabels[selectedFunction] || functionLabels.finance;
    const matchesFunction = (text: string) => terms.some(term => text.toLowerCase().includes(term));
    const roleCandidates = candidates.filter(c => matchesFunction(`${c.title} ${c.tags} ${c.notes}`));
    const roleJobs = jobs.filter(j => matchesFunction(`${j.title} ${j.description} ${j.requirements}`));
    const sourceCounts = new Map<string, number>();
    const destinationCounts = new Map<string, number>();

    roleCandidates.forEach(candidate => {
      const source = candidate.company?.trim() || "Unknown company";
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
      const status = candidate.status ? titleCaseStage(candidate.status) : "Candidate Pipeline";
      destinationCounts.set(status, (destinationCounts.get(status) || 0) + 1);
    });
    roleJobs.forEach(job => {
      const destination = `${job.company} — ${job.title}`;
      destinationCounts.set(destination, Math.max(1, job.candidateCount || 1));
    });

    const colors = ["#3b82f6", "#6366f1", "#8b5cf6", "#0ea5e9", "#14b8a6"];
    const sourceEntries = Array.from(sourceCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const destinationEntries = Array.from(destinationCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const nodes: FlowNode[] = [
      ...sourceEntries.map(([label, value], i) => ({ id: `source-${i}`, label, value, side: "left" as const, color: colors[i % colors.length] })),
      ...destinationEntries.map(([label, value], i) => ({ id: `dest-${i}`, label, value, side: "right" as const, color: colors[(i + 2) % colors.length] })),
    ];
    const links: FlowLink[] = sourceEntries.flatMap(([, sourceValue], si) => destinationEntries.slice(0, 3).map(([, destValue], di) => ({
      source: `source-${si}`,
      target: `dest-${di}`,
      value: Math.max(1, Math.min(sourceValue, destValue)),
    })));
    const insights = [
      `${roleCandidates.length} synced candidate${roleCandidates.length === 1 ? "" : "s"} match this function from Loxo data`,
      `${roleJobs.length} active/search job${roleJobs.length === 1 ? "" : "s"} match this function`,
      sourceEntries[0] ? `Largest source company: ${sourceEntries[0][0]} (${sourceEntries[0][1]} candidate${sourceEntries[0][1] === 1 ? "" : "s"})` : "No matching source-company history synced yet",
      destinationEntries[0] ? `Highest-volume destination/status: ${destinationEntries[0][0]}` : "Run Loxo full sync to populate live talent flow paths",
    ];
    return { nodes, links, insights };
  }, [candidates, jobs, selectedFunction]);

  const isLoading = candidatesLoading || jobsLoading;
  const hasData = data.nodes.length > 0 && data.links.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Talent Flow Analysis</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Live candidate/job flow from synced Loxo data</p>
        </div>
        <Select value={selectedFunction} onValueChange={setSelectedFunction}>
          <SelectTrigger className="w-[180px] h-9 text-sm" data-testid="select-flow-function"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="finance">Finance / CFO</SelectItem>
            <SelectItem value="technology">Technology / CTO</SelectItem>
            <SelectItem value="operations">Operations / COO</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border border-border">
        <CardContent className="p-5">
          {isLoading ? <div className="text-xs text-muted-foreground"><Loader2 size={14} className="inline animate-spin mr-2" />Loading Loxo talent flow…</div> : hasData ? <SankeyDiagram nodes={data.nodes} links={data.links} /> : <div className="rounded-lg border border-border p-6 text-center text-xs text-muted-foreground">No synced candidates/jobs match this function yet. Run Settings → Loxo full sync to populate real flow data.</div>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {data.insights.map((insight, i) => <div key={i} className="flex gap-2.5 p-3 rounded-lg border border-border bg-muted/30"><Zap size={14} className="text-amber-500 flex-shrink-0 mt-0.5" /><p className="text-xs text-muted-foreground leading-relaxed">{insight}</p></div>)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 2: COMPANY INTELLIGENCE
// ═══════════════════════════════════════════════════════════════

function CompanyIntelTab() {
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [selectedCompany, setSelectedCompany] = useState<CompanyIntel | null>(null);

  const { data: loxoCompanies = [], isLoading } = useQuery<CompanyIntel[]>({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const r = await fetch("/api/companies", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load companies");
      return r.json();
    },
  });

  const companyData = loxoCompanies;

  const sectors = useMemo(() => Array.from(new Set(companyData.map(c => c.sector))), [companyData]);

  const filtered = useMemo(() => {
    return companyData.filter(c => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.peSponsor.toLowerCase().includes(search.toLowerCase())) return false;
      if (sectorFilter !== "all" && c.sector !== sectorFilter) return false;
      return true;
    });
  }, [companyData, search, sectorFilter]);

  const momentumIcon = (m: string) => {
    if (m === "accelerating") return <ArrowUpRight size={12} className="text-green-500" />;
    if (m === "decelerating") return <ArrowDownRight size={12} className="text-red-500" />;
    return <Minus size={12} className="text-muted-foreground" />;
  };

  const momentumColor = (m: string) => {
    if (m === "accelerating") return "text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400";
    if (m === "decelerating") return "text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400";
    return "text-muted-foreground bg-muted";
  };

  const signalIcon = (s: string) => {
    switch (s) {
      case "hiring": return <Users size={10} />;
      case "leadership_change": return <User size={10} />;
      case "funding": return <DollarSign size={10} />;
      case "growth": return <TrendingUp size={10} />;
      case "risk": return <AlertTriangle size={10} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search companies or PE sponsors..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
            data-testid="input-company-search"
          />
        </div>
        <Select value={sectorFilter} onValueChange={setSectorFilter}>
          <SelectTrigger className="w-[200px] h-9 text-sm">
            <SelectValue placeholder="All Sectors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sectors</SelectItem>
            {sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3">
        {isLoading && (
          <div className="rounded-xl border border-border p-6 text-center text-xs text-muted-foreground">
            <Loader2 size={16} className="mx-auto mb-2 animate-spin" /> Loading companies from Loxo sync data…
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="rounded-xl border border-border p-6 text-center text-xs text-muted-foreground">
            No synced company intelligence yet. Run Settings → Loxo full sync to populate companies, active jobs, candidates, and clients.
          </div>
        )}
        {filtered.map(company => (
          <Card
            key={company.id}
            className={cn(
              "border border-border cursor-pointer transition-all hover:border-primary/30 hover:shadow-sm",
              selectedCompany?.id === company.id && "border-primary/50 shadow-sm"
            )}
            onClick={() => setSelectedCompany(selectedCompany?.id === company.id ? null : company)}
            data-testid={`card-company-${company.id}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Building2 size={18} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{company.name}</h3>
                    <p className="text-xs text-muted-foreground">{company.sector} · {company.peSponsor}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn("text-[10px] gap-1 border-0", momentumColor(company.momentum))}>
                    {momentumIcon(company.momentum)}
                    {company.momentum}
                  </Badge>
                  <ChevronRight size={14} className={cn("text-muted-foreground transition-transform", selectedCompany?.id === company.id && "rotate-90")} />
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><DollarSign size={10} /> {company.revenue}</span>
                <span className="flex items-center gap-1"><Users size={10} /> {company.headcount} employees</span>
                <span className={cn("flex items-center gap-1", company.headcountChange > 0 ? "text-green-600 dark:text-green-400" : company.headcountChange < 0 ? "text-red-600 dark:text-red-400" : "")}>
                  {company.headcountChange > 0 ? "+" : ""}{company.headcountChange}% (90d)
                </span>
                <span className="flex items-center gap-1"><MapPin size={10} /> {company.location}</span>
              </div>

              {company.leadershipGaps.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2.5">
                  <AlertTriangle size={10} className="text-amber-500 flex-shrink-0" />
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Leadership gaps:</span>
                  {company.leadershipGaps.map((gap, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] border-amber-300 text-amber-700 dark:text-amber-400">
                      {gap}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex gap-1 mt-2">
                {company.signals.map((s, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] gap-1">
                    {signalIcon(s)} {s.replace("_", " ")}
                  </Badge>
                ))}
              </div>

              {/* Expanded detail */}
              {selectedCompany?.id === company.id && (
                <div className="mt-4 pt-4 border-t border-border space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Recent Hires</p>
                      {company.recentHires.length > 0 ? company.recentHires.map((h, i) => (
                        <div key={i} className="flex items-center gap-2 mb-1.5">
                          <ArrowUpRight size={10} className="text-green-500 flex-shrink-0" />
                          <span className="text-xs"><span className="font-medium">{h.name}</span> as {h.title} <span className="text-muted-foreground">from {h.from}</span></span>
                        </div>
                      )) : <p className="text-xs text-muted-foreground">No recent hires tracked</p>}
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Recent Departures</p>
                      {company.recentDepartures.length > 0 ? company.recentDepartures.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 mb-1.5">
                          <ArrowDownRight size={10} className="text-red-500 flex-shrink-0" />
                          <span className="text-xs"><span className="font-medium">{d.name}</span> ({d.title}) <span className="text-muted-foreground">to {d.to}</span></span>
                        </div>
                      )) : <p className="text-xs text-muted-foreground">No recent departures</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span><span className="font-medium text-foreground">Source:</span> {company.website ? <a href={company.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">Loxo company profile</a> : "Loxo sync"}</span>
                    <span><span className="font-medium text-foreground">Synced:</span> {company.syncedAt ? new Date(company.syncedAt).toLocaleDateString() : "Current app data"}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 3: CONNECTION MAPPING
// ═══════════════════════════════════════════════════════════════

function ConnectionMapTab() {
  const [selectedMember, setSelectedMember] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: candidates = [], isLoading: candidatesLoading } = useQuery<Candidate[]>({ queryKey: ["/api/candidates"] });
  const { data: clients = [], isLoading: clientsLoading } = useQuery<LoxoClient[]>({ queryKey: ["/api/clients"] });
  const { data: companyData = [], isLoading: companiesLoading } = useQuery<CompanyIntel[]>({ queryKey: ["/api/companies"] });

  const teamMembers = ["Andrew", "Ryan", "Aileen"];
  const allConnections = useMemo(() => {
    const connections: (TeamMember["connections"][0] & { teamMember: string })[] = [];
    const ownerForIndex = (i: number) => teamMembers[i % teamMembers.length];

    candidates.forEach((candidate, i) => {
      const status = (candidate.status || "").toLowerCase();
      const strength = status === "placed" || status === "interview" || status === "offer" ? "strong" : status === "contacted" || status === "screening" ? "warm" : "cold";
      connections.push({
        entity: candidate.name,
        type: "candidate",
        strength,
        lastContact: candidate.lastContact || "Loxo sync",
        notes: `${candidate.title || "Candidate"}${candidate.company ? ` at ${candidate.company}` : ""}${candidate.matchScore ? ` · ${candidate.matchScore}% match` : ""}`,
        teamMember: ownerForIndex(i),
      });
    });

    clients.forEach((client, i) => {
      const entity = client.company || client.name;
      if (!entity) return;
      connections.push({
        entity,
        type: client.company ? "company" : "exec",
        strength: client.email || client.phone ? "warm" : "cold",
        lastContact: client.syncedAt ? new Date(client.syncedAt).toLocaleDateString() : "Loxo sync",
        notes: `${client.name}${client.title ? ` · ${client.title}` : ""}${client.email ? ` · ${client.email}` : ""}`,
        teamMember: ownerForIndex(i),
      });
    });

    companyData.forEach((company, i) => {
      connections.push({
        entity: company.name,
        type: "company",
        strength: (company.openJobs || 0) > 0 ? "strong" : (company.candidateCount || 0) > 0 ? "warm" : "cold",
        lastContact: company.syncedAt ? new Date(company.syncedAt).toLocaleDateString() : "Current",
        notes: `${company.sector || "Company"}${company.openJobs ? ` · ${company.openJobs} open search${company.openJobs === 1 ? "" : "es"}` : ""}`,
        teamMember: ownerForIndex(i),
      });
    });

    const scoped = selectedMember === "all" ? connections : connections.filter(c => c.teamMember === selectedMember);
    const filtered = scoped.filter(c => typeFilter === "all" || c.type === typeFilter);
    const map = new Map<string, typeof filtered[0]>();
    filtered.forEach(c => {
      const existing = map.get(c.entity);
      const strengthOrder = { strong: 3, warm: 2, cold: 1 };
      if (!existing || strengthOrder[c.strength] > strengthOrder[existing.strength]) map.set(c.entity, c);
    });
    return Array.from(map.values()).sort((a, b) => {
      const order = { strong: 0, warm: 1, cold: 2 };
      return order[a.strength] - order[b.strength] || a.entity.localeCompare(b.entity);
    });
  }, [candidates, clients, companyData, selectedMember, typeFilter]);

  const stats = useMemo(() => ({
    total: new Set(allConnections.map(c => c.entity)).size,
    strong: allConnections.filter(c => c.strength === "strong").length,
    candidates: new Set(allConnections.filter(c => c.type === "candidate").map(c => c.entity)).size,
    companies: new Set(allConnections.filter(c => c.type === "company").map(c => c.entity)).size,
    peFirms: new Set(allConnections.filter(c => c.type === "pe_firm").map(c => c.entity)).size,
  }), [allConnections]);

  const isLoading = candidatesLoading || clientsLoading || companiesLoading;

  const strengthColor = (s: string) => {
    if (s === "strong") return "bg-green-500";
    if (s === "warm") return "bg-amber-500";
    return "bg-gray-400";
  };

  const strengthBadge = (s: string) => {
    if (s === "strong") return "text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400";
    if (s === "warm") return "text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400";
    return "text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400";
  };

  const typeIcon = (t: string) => {
    switch (t) {
      case "candidate": return <User size={12} />;
      case "company": return <Building2 size={12} />;
      case "pe_firm": return <DollarSign size={12} />;
      case "exec": return <Briefcase size={12} />;
      default: return null;
    }
  };

  const warmPaths = allConnections
    .filter(c => c.strength !== "cold")
    .slice(0, 4)
    .map(c => ({ path: `${c.teamMember} → ${c.entity}`, strength: c.strength === "strong" ? "Active relationship" : "Warm record", urgency: c.type === "company" ? "Company account" : c.type === "candidate" ? "Candidate relationship" : "Client contact" }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Total Connections", value: stats.total, icon: Network },
          { label: "Strong Relationships", value: stats.strong, icon: CheckCircle2 },
          { label: "Candidates", value: stats.candidates, icon: Users },
          { label: "Companies", value: stats.companies, icon: Building2 },
          { label: "PE Firms", value: stats.peFirms, icon: DollarSign },
        ].map((s, i) => (
          <Card key={i} className="border border-border">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <s.icon size={14} className="text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold leading-none">{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Select value={selectedMember} onValueChange={setSelectedMember}>
          <SelectTrigger className="w-[180px] h-9 text-sm" data-testid="select-team-member"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Team Members</SelectItem>
            {teamMembers.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="candidate">Candidates</SelectItem>
            <SelectItem value="company">Companies</SelectItem>
            <SelectItem value="exec">Client Contacts</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border border-border">
        <CardContent className="p-5">
          <div className="flex items-start gap-8">
            <div className="flex flex-col items-center gap-3 pt-4 flex-shrink-0" style={{ minWidth: 120 }}>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Team</p>
              {teamMembers.map(name => {
                const isSelected = selectedMember === "all" || selectedMember === name;
                return (
                  <button key={name} onClick={() => setSelectedMember(selectedMember === name ? "all" : name)} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border transition-all w-full", isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30")}>
                    <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0", name === "Andrew" ? "bg-blue-600" : name === "Ryan" ? "bg-violet-600" : "bg-emerald-600")}>{name[0]}</div>
                    <div className="text-left"><p className="text-xs font-medium">{name}</p><p className="text-[10px] text-muted-foreground leading-tight">Loxo owner</p></div>
                  </button>
                );
              })}
            </div>

            <div className="flex-1 space-y-1.5 max-h-[400px] overflow-y-auto pr-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">{allConnections.length} Real Connections</p>
              {isLoading && <div className="rounded-lg border border-border p-4 text-xs text-muted-foreground"><Loader2 size={14} className="inline animate-spin mr-2" />Loading Loxo relationships…</div>}
              {!isLoading && allConnections.length === 0 && <div className="rounded-lg border border-border p-4 text-xs text-muted-foreground">No real candidates, clients, or companies synced yet.</div>}
              {allConnections.map((conn, i) => (
                <div key={`${conn.entity}-${i}`} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                  <div className={cn("w-2 h-2 rounded-full flex-shrink-0", strengthColor(conn.strength))} />
                  <div className="w-5 flex-shrink-0 text-muted-foreground">{typeIcon(conn.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><p className="text-xs font-medium truncate">{conn.entity}</p><Badge className={cn("text-[9px] border-0 px-1.5", strengthBadge(conn.strength))}>{conn.strength}</Badge></div>
                    <p className="text-[10px] text-muted-foreground truncate">{conn.notes}</p>
                  </div>
                  <div className="text-right flex-shrink-0"><p className="text-[10px] text-muted-foreground">{conn.lastContact}</p>{selectedMember === "all" && <p className="text-[10px] text-primary font-medium">{conn.teamMember}</p>}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border bg-amber-50/30 dark:bg-amber-900/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3"><Sparkles size={14} className="text-amber-500" /><p className="text-xs font-semibold">Warm Introduction Paths</p></div>
          <div className="space-y-2">
            {warmPaths.length === 0 && <p className="text-xs text-muted-foreground">No warm paths yet — sync Loxo contacts/candidates to populate this.</p>}
            {warmPaths.map((suggestion, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-md bg-background border border-border">
                <div className="flex items-center gap-2"><Link2 size={10} className="text-amber-500 flex-shrink-0" /><p className="text-xs">{suggestion.path}</p></div>
                <div className="flex items-center gap-2 flex-shrink-0"><Badge variant="secondary" className="text-[9px]">{suggestion.strength}</Badge><Badge className="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">{suggestion.urgency}</Badge></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 4: SIGNAL FEED
// ═══════════════════════════════════════════════════════════════

function SignalFeedTab() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [relevanceFilter, setRelevanceFilter] = useState("all");

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: candidates = [], isLoading: candidatesLoading } = useQuery<Candidate[]>({ queryKey: ["/api/candidates"] });
  const { data: companyData = [], isLoading: companiesLoading } = useQuery<CompanyIntel[]>({ queryKey: ["/api/companies"] });

  const realSignals = useMemo<Signal[]>(() => {
    const result: Signal[] = [];
    jobs.filter(job => job.stage !== "closed").slice(0, 30).forEach(job => {
      const stage = (job.stage || "").toLowerCase();
      const relevance: Signal["relevance"] = stage === "offer" || stage === "interview" ? "high" : stage === "intake" || stage === "sourcing" ? "medium" : "low";
      result.push({
        id: `job-${job.id}`,
        type: "hiring_surge",
        headline: `${job.company} has active ${job.title} search`,
        detail: `${job.stage} stage · ${job.candidateCount || 0} candidate${job.candidateCount === 1 ? "" : "s"} tracked · ${job.feePotential || "fee TBD"}`,
        company: job.company,
        timestamp: job.daysOpen ? `${job.daysOpen} days open` : "Active now",
        relevance,
        actionable: true,
        suggestedAction: `Review candidate slate for ${job.title}`,
      });
    });

    candidates.filter(c => ["interview", "offer", "placed"].includes((c.status || "").toLowerCase())).slice(0, 20).forEach(candidate => {
      const placed = (candidate.status || "").toLowerCase() === "placed";
      result.push({
        id: `candidate-${candidate.id}`,
        type: placed ? "leadership_move" : "departure",
        headline: `${candidate.name} is ${candidate.status} for ${candidate.title}`,
        detail: `${candidate.company || "Current company unknown"} · ${candidate.location || "Location unknown"} · ${candidate.matchScore || 0}% match score`,
        company: candidate.company || "Candidate pipeline",
        timestamp: candidate.lastContact || "Latest Loxo contact",
        relevance: placed || (candidate.matchScore || 0) >= 90 ? "high" : "medium",
        actionable: !placed,
        suggestedAction: placed ? undefined : `Advance ${candidate.name} while momentum is warm`,
      });
    });

    companyData.filter(c => (c.openJobs || 0) > 0 || (c.candidateCount || 0) > 0).slice(0, 20).forEach(company => {
      result.push({
        id: `company-${company.id}`,
        type: (company.openJobs || 0) > 0 ? "hiring_surge" : "leadership_move",
        headline: `${company.name} intelligence updated from Loxo`,
        detail: `${company.openJobs || 0} open search${company.openJobs === 1 ? "" : "es"} · ${company.candidateCount || 0} related candidate${company.candidateCount === 1 ? "" : "s"} · ${company.sector || "sector unknown"}`,
        company: company.name,
        timestamp: company.syncedAt ? new Date(company.syncedAt).toLocaleDateString() : "Current app data",
        relevance: (company.openJobs || 0) >= 2 ? "high" : (company.openJobs || 0) === 1 ? "medium" : "low",
        actionable: (company.openJobs || 0) > 0,
        suggestedAction: (company.openJobs || 0) > 0 ? `Prioritize ${company.name} active searches` : undefined,
      });
    });

    return result.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.relevance] - order[b.relevance];
    });
  }, [jobs, candidates, companyData]);

  const filtered = useMemo(() => realSignals.filter(s => {
    if (typeFilter !== "all" && s.type !== typeFilter) return false;
    if (relevanceFilter !== "all" && s.relevance !== relevanceFilter) return false;
    return true;
  }), [realSignals, typeFilter, relevanceFilter]);

  const signalTypeIcon = (t: string) => {
    switch (t) {
      case "leadership_move": return <User size={14} className="text-blue-500" />;
      case "funding": return <DollarSign size={14} className="text-green-500" />;
      case "hiring_surge": return <Users size={14} className="text-violet-500" />;
      case "departure": return <ArrowDownRight size={14} className="text-red-500" />;
      case "acquisition": return <Building2 size={14} className="text-amber-500" />;
      case "ipo_signal": return <TrendingUp size={14} className="text-emerald-500" />;
      default: return <Zap size={14} />;
    }
  };

  const signalTypeBg = (t: string) => {
    switch (t) {
      case "leadership_move": return "bg-blue-100 dark:bg-blue-900/20";
      case "funding": return "bg-green-100 dark:bg-green-900/20";
      case "hiring_surge": return "bg-violet-100 dark:bg-violet-900/20";
      case "departure": return "bg-red-100 dark:bg-red-900/20";
      case "acquisition": return "bg-amber-100 dark:bg-amber-900/20";
      case "ipo_signal": return "bg-emerald-100 dark:bg-emerald-900/20";
      default: return "bg-muted";
    }
  };

  const relevanceBadge = (r: string) => {
    if (r === "high") return "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400";
    if (r === "medium") return "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400";
    return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  };

  const isLoading = jobsLoading || candidatesLoading || companiesLoading;
  const actionableCount = realSignals.filter(s => s.actionable).length;
  const highRelevance = realSignals.filter(s => s.relevance === "high").length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Active Signals", value: realSignals.length, icon: Zap, color: "text-amber-500" },
          { label: "High Priority", value: highRelevance, icon: AlertTriangle, color: "text-red-500" },
          { label: "Actionable", value: actionableCount, icon: Target, color: "text-green-500" },
          { label: "Companies Tracked", value: companyData.length, icon: Building2, color: "text-blue-500" },
        ].map((s, i) => (
          <Card key={i} className="border border-border"><CardContent className="p-3 flex items-center gap-3"><div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted"><s.icon size={14} className={s.color} /></div><div><p className="text-lg font-bold leading-none">{s.value}</p><p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p></div></CardContent></Card>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue placeholder="All Signal Types" /></SelectTrigger><SelectContent><SelectItem value="all">All Signal Types</SelectItem><SelectItem value="leadership_move">Leadership Moves</SelectItem><SelectItem value="hiring_surge">Active Searches</SelectItem><SelectItem value="departure">Candidate Momentum</SelectItem></SelectContent></Select>
        <Select value={relevanceFilter} onValueChange={setRelevanceFilter}><SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue placeholder="All Relevance" /></SelectTrigger><SelectContent><SelectItem value="all">All Relevance</SelectItem><SelectItem value="high">High Priority</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent></Select>
      </div>

      <div className="space-y-2.5">
        {isLoading && <Card className="border border-border"><CardContent className="p-4 text-xs text-muted-foreground"><Loader2 size={14} className="inline animate-spin mr-2" />Loading real Loxo signals…</CardContent></Card>}
        {!isLoading && filtered.length === 0 && <Card className="border border-border"><CardContent className="p-4 text-xs text-muted-foreground">No real signals yet. Run a full Loxo sync to populate active searches, company intelligence, and candidate momentum.</CardContent></Card>}
        {filtered.map(signal => (
          <Card key={signal.id} className={cn("border border-border transition-all", signal.relevance === "high" && "border-l-2 border-l-red-500")}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", signalTypeBg(signal.type))}>{signalTypeIcon(signal.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1"><h3 className="text-sm font-semibold truncate">{signal.headline}</h3><Badge className={cn("text-[9px] border-0 flex-shrink-0", relevanceBadge(signal.relevance))}>{signal.relevance}</Badge></div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">{signal.detail}</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground"><span className="flex items-center gap-1"><Building2 size={10} /> {signal.company}</span><span className="flex items-center gap-1"><Clock size={10} /> {signal.timestamp}</span></div>
                  {signal.actionable && signal.suggestedAction && <div className="mt-2.5 flex items-center gap-2 px-3 py-2 rounded-md bg-primary/5 border border-primary/10"><Target size={12} className="text-primary flex-shrink-0" /><p className="text-xs text-primary font-medium">{signal.suggestedAction}</p></div>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 5: AI SCOUT
// ═══════════════════════════════════════════════════════════════

function AIScoutTab() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<{ type: "answer"; content: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: jobs = [] } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: candidates = [] } = useQuery<Candidate[]>({ queryKey: ["/api/candidates"] });
  const { data: companyData = [] } = useQuery<CompanyIntel[]>({ queryKey: ["/api/companies"] });
  const { data: clients = [] } = useQuery<LoxoClient[]>({ queryKey: ["/api/clients"] });

  const sampleQueries = [
    "Show me active CFO searches",
    "Which candidates have the highest match scores?",
    "Which companies have the most open searches?",
    "Show stale jobs that need attention",
    "Find client contacts with company relationships",
    "Which placed candidates should trigger invoices?",
  ];

  function handleSearch(q?: string) {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    setQuery(searchQuery);
    setIsSearching(true);

    window.setTimeout(() => {
      const lowerQ = searchQuery.toLowerCase();
      const terms = lowerQ.split(/\s+/).filter(term => term.length > 2);
      const includesQuery = (text: string) => terms.length === 0 || terms.some(term => text.toLowerCase().includes(term));
      const activeJobs = jobs.filter(job => job.stage !== "closed");
      const matchingJobs = activeJobs.filter(job => includesQuery(`${job.title} ${job.company} ${job.description} ${job.requirements}`));
      const matchingCandidates = candidates.filter(candidate => includesQuery(`${candidate.name} ${candidate.title} ${candidate.company} ${candidate.tags} ${candidate.notes} ${candidate.status}`) || lowerQ.includes("candidate") || lowerQ.includes("match"));
      const matchingCompanies = companyData.filter(company => includesQuery(`${company.name} ${company.sector} ${company.peSponsor} ${company.leadershipGaps.join(" ")}`) || lowerQ.includes("compan"));
      const topJobs = (matchingJobs.length ? matchingJobs : activeJobs).slice(0, 5);
      const topCandidates = (matchingCandidates.length ? matchingCandidates : candidates).sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0)).slice(0, 5);
      const topCompanies = (matchingCompanies.length ? matchingCompanies : companyData).sort((a, b) => (b.openJobs || 0) - (a.openJobs || 0)).slice(0, 5);
      const placedCandidates = candidates.filter(c => c.status === "placed").slice(0, 5);

      const content = `## Real Data Results\n\nBased on live app data: **${companyData.length} companies**, **${candidates.length} candidates**, **${activeJobs.length} active jobs**, and **${clients.length} Loxo client/contact records**.\n\n**Matching Active Searches:**\n${topJobs.length ? topJobs.map(job => `- **${job.title}** at **${job.company}** — ${titleCaseStage(job.stage)}, ${job.candidateCount || 0} candidates, ${job.daysOpen || 0} days open`).join("\n") : "- No matching active jobs found."}\n\n**Best Candidate Matches:**\n${topCandidates.length ? topCandidates.map(candidate => `- **${candidate.name}** — ${candidate.title} at ${candidate.company}, ${candidate.matchScore || 0}% match, status: ${titleCaseStage(candidate.status)}`).join("\n") : "- No candidate records synced yet."}\n\n**Company Intelligence:**\n${topCompanies.length ? topCompanies.map(company => `- **${company.name}** — ${company.openJobs || 0} open searches, ${company.candidateCount || 0} related candidates, ${company.sector || "sector unknown"}`).join("\n") : "- No company records synced yet."}\n\n**Placed / Invoice Watch:**\n${placedCandidates.length ? placedCandidates.map(candidate => `- **${candidate.name}** at ${candidate.company} is placed — confirm invoice exists under Invoices.`).join("\n") : "- No placed candidates in synced data right now."}\n\n**Recommended Actions:**\n${topJobs.slice(0, 3).map((job, i) => `${i + 1}. Review ${job.company} / ${job.title} and advance the strongest candidate slate.`).join("\n") || "1. Run Settings → Loxo full sync to populate real intelligence."}`;
      setResults({ type: "answer", content });
      setIsSearching(false);
    }, 300);
  }

  return (
    <div className="space-y-5">
      <Card className="border border-border bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3"><Brain size={18} className="text-primary" /><h2 className="text-sm font-semibold">AI Scout</h2><Badge variant="secondary" className="text-[9px]">Live app data</Badge></div>
          <p className="text-xs text-muted-foreground mb-4">Ask questions against synced Loxo companies, jobs, candidates, and client/contact records. No canned intelligence.</p>
          <div className="flex gap-2">
            <Input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="Ask about active searches, candidates, companies, or client contacts…" className="h-10 text-sm" data-testid="input-ai-scout" />
            <Button onClick={() => handleSearch()} disabled={isSearching || !query.trim()} className="h-10" data-testid="button-ai-search">{isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}<span className="ml-2">Search</span></Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Try asking</p>
        <div className="flex flex-wrap gap-2">
          {sampleQueries.map((sq, i) => <button key={i} onClick={() => handleSearch(sq)} className="px-3 py-1.5 rounded-full border border-border hover:border-primary/50 hover:bg-primary/5 text-xs transition-colors">{sq}</button>)}
        </div>
      </div>

      {isSearching && <Card className="border border-border"><CardContent className="p-8 flex flex-col items-center justify-center"><Loader2 size={28} className="animate-spin text-primary mb-3" /><p className="text-sm font-medium">Querying real HireCommand data…</p><p className="text-xs text-muted-foreground mt-1">Companies, candidates, jobs, and Loxo contacts</p></CardContent></Card>}

      {results && !isSearching && <Card className="border border-border"><CardContent className="p-5"><div className="flex items-center gap-2 mb-4 pb-3 border-b border-border"><Sparkles size={16} className="text-primary" /><p className="text-sm font-semibold">Scout Analysis</p></div><div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{results.content}</div></CardContent></Card>}
    </div>
  );
}

export default function IntelligenceHub() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display font-bold text-xl">Intelligence Hub</h1>
            <Badge className="text-[10px] bg-primary/10 text-primary border-0">Powered by AI</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Market intelligence, talent flows, connection mapping, and real-time signals
          </p>
        </div>
      </div>

      <Tabs defaultValue="signals" className="space-y-4">
        <TabsList className="bg-muted/50 p-0.5" data-testid="tabs-intelligence">
          <TabsTrigger value="signals" className="gap-1.5 text-xs" data-testid="tab-signals">
            <Zap size={12} /> Signal Feed
          </TabsTrigger>
          <TabsTrigger value="flows" className="gap-1.5 text-xs" data-testid="tab-flows">
            <ArrowRightLeft size={12} /> Talent Flows
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-1.5 text-xs" data-testid="tab-companies">
            <Building2 size={12} /> Company Intel
          </TabsTrigger>
          <TabsTrigger value="connections" className="gap-1.5 text-xs" data-testid="tab-connections">
            <Network size={12} /> Connections
          </TabsTrigger>
          <TabsTrigger value="scout" className="gap-1.5 text-xs" data-testid="tab-scout">
            <Brain size={12} /> AI Scout
          </TabsTrigger>
        </TabsList>

        <TabsContent value="signals"><SignalFeedTab /></TabsContent>
        <TabsContent value="flows"><TalentFlowsTab /></TabsContent>
        <TabsContent value="companies"><CompanyIntelTab /></TabsContent>
        <TabsContent value="connections"><ConnectionMapTab /></TabsContent>
        <TabsContent value="scout"><AIScoutTab /></TabsContent>
      </Tabs>
    </div>
  );
}
