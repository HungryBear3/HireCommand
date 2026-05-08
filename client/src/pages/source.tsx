import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  MapPin,
  Plus,
  CheckCircle2,
  ExternalLink,
  Copy,
  Loader2,
  Sparkles,
  Globe,
  Github,
  Users,
  X,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type SourceType = "linkedin_xray" | "github" | "web" | "pdl" | "perplexity";

interface SourcingCandidate {
  id: string;
  name: string;
  currentTitle: string;
  currentCompany: string;
  location: string;
  headline: string;
  summary: string;
  skills: string[];
  source: SourceType;
  sourceUrl: string;
  linkedinUrl?: string;
  githubUrl?: string;
  email?: string;
  fitScore: number;
  fitReasons: string[];
  addedToPipeline: boolean;
}

interface SourcingResult {
  briefParsed: {
    titles?: string[];
    industries?: string[];
    locations?: string[];
    skills?: string[];
    seniorityLevel?: string;
    yearsExperience?: string;
    companySizes?: string[];
  };
  booleanString: string;
  candidates: SourcingCandidate[];
  totalFound: number;
  sources: Record<SourceType, number>;
  searchedAt: string;
  perplexityCitations?: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const QUICK_SEARCHES = [
  "CFO with PE-backed healthcare experience, 10+ years, Chicago or NYC",
  "CTO at Series B SaaS company, engineering team 20-50, remote or SF",
  "VP Sales with SaaS background, 50-200 employee tech company, Boston or NYC",
  "CHRO at PE-backed portfolio company, 500-2000 employees, New York or Boston",
  "COO at growth-stage health tech company, operational scale-up experience",
  "General Counsel at PE-backed company, M&A experience, any major market",
];

const SOURCE_LABELS: Record<SourceType, { label: string; color: string; icon: React.ReactNode }> = {
  linkedin_xray: {
    label: "LinkedIn X-Ray",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    icon: <span className="text-[11px]">🔗</span>,
  },
  web: {
    label: "Open Web",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    icon: <Globe className="w-3 h-3" />,
  },
  github: {
    label: "GitHub",
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    icon: <Github className="w-3 h-3" />,
  },
  pdl: {
    label: "People Data Labs",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    icon: <span className="text-[11px]">📊</span>,
  },
  perplexity: {
    label: "Perplexity AI",
    color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
    icon: <Sparkles className="w-3 h-3" />,
  },
};

const AVATAR_COLORS: Record<SourceType, string> = {
  linkedin_xray: "bg-blue-500",
  web: "bg-slate-500",
  github: "bg-orange-500",
  pdl: "bg-purple-500",
  perplexity: "bg-teal-500",
};

function getFitScoreColor(score: number): string {
  if (score >= 80) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
  if (score >= 60) return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
  if (score >= 40) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <Card className="w-full">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
        <div className="mt-4 space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-4/6" />
        </div>
        <div className="mt-3 flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-18 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

interface CandidateCardProps {
  candidate: SourcingCandidate;
  isAdded: boolean;
  onAdd: (candidate: SourcingCandidate) => void;
  isAddPending: boolean;
  style?: React.CSSProperties;
}

function CandidateCard({ candidate, isAdded, onAdd, isAddPending, style }: CandidateCardProps) {
  const [expanded, setExpanded] = useState(false);
  const summaryTruncated = candidate.summary.length > 160 && !expanded;
  const displaySummary = summaryTruncated
    ? candidate.summary.slice(0, 160) + "…"
    : candidate.summary;

  const initial = candidate.name.charAt(0).toUpperCase();
  const avatarColor = AVATAR_COLORS[candidate.source];
  const sourceInfo = SOURCE_LABELS[candidate.source];
  const fitColor = getFitScoreColor(candidate.fitScore);
  const displaySkills = candidate.skills.slice(0, 6);

  return (
    <Card
      className="w-full transition-all duration-300 hover-elevate"
      style={style}
      data-testid={`candidate-card-${candidate.id}`}
    >
      <CardContent className="p-5">
        {/* Header row */}
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div
            className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0",
              avatarColor
            )}
            aria-label={candidate.name}
          >
            {initial}
          </div>

          {/* Name + title */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="font-semibold text-sm text-foreground"
                data-testid={`candidate-name-${candidate.id}`}
              >
                {candidate.name}
              </span>
              {/* Fit score */}
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                  fitColor
                )}
                data-testid={`candidate-fit-score-${candidate.id}`}
              >
                Fit: {candidate.fitScore}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {candidate.currentTitle}
              {candidate.currentCompany ? ` · ${candidate.currentCompany}` : ""}
            </p>
            {candidate.location && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <MapPin className="w-3 h-3 shrink-0" />
                {candidate.location}
              </p>
            )}
          </div>

          {/* Add to pipeline button */}
          <div className="shrink-0">
            {isAdded ? (
              <Button
                size="sm"
                variant="outline"
                disabled
                className="text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 text-xs"
                data-testid={`button-in-pipeline-${candidate.id}`}
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                In Pipeline
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAdd(candidate)}
                disabled={isAddPending}
                className="text-xs"
                data-testid={`button-add-pipeline-${candidate.id}`}
              >
                {isAddPending ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3 mr-1" />
                )}
                Add to Pipeline
              </Button>
            )}
          </div>
        </div>

        {/* Fit reasons */}
        {candidate.fitReasons && candidate.fitReasons.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {candidate.fitReasons.slice(0, 3).map((reason, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                {reason}
              </span>
            ))}
          </div>
        )}

        {/* AI Summary */}
        {candidate.summary && (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground/70">AI Summary: </span>
              {displaySummary}
              {candidate.summary.length > 160 && (
                <button
                  className="ml-1 text-primary text-xs underline-offset-2 hover:underline"
                  onClick={() => setExpanded(!expanded)}
                  data-testid={`button-expand-summary-${candidate.id}`}
                >
                  {expanded ? "Show less" : "Read more"}
                </button>
              )}
            </p>
          </div>
        )}

        {/* Skills */}
        {displaySkills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {displaySkills.map((skill) => (
              <Badge
                key={skill}
                variant="secondary"
                className="text-[10px] py-0"
              >
                {skill}
              </Badge>
            ))}
            {candidate.skills.length > 6 && (
              <span className="text-[10px] text-muted-foreground self-center">
                +{candidate.skills.length - 6} more
              </span>
            )}
          </div>
        )}

        {/* Source + View Profile */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
              sourceInfo.color
            )}
          >
            {sourceInfo.icon}
            {sourceInfo.label}
          </span>
          {(candidate.sourceUrl || candidate.linkedinUrl) && (
            <a
              href={candidate.sourceUrl || candidate.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline underline-offset-2"
              data-testid={`link-view-profile-${candidate.id}`}
            >
              View Profile
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface BriefAnalysisPanelProps {
  result: SourcingResult;
  onCopyBoolean: () => void;
  demoMode: boolean;
  googleAvailable: boolean;
  perplexityAvailable: boolean;
}

function BriefAnalysisPanel({ result, onCopyBoolean, demoMode, googleAvailable, perplexityAvailable }: BriefAnalysisPanelProps) {
  const { briefParsed, booleanString, sources } = result;
  const sourceEntries = Object.entries(sources).filter(([, count]) => count > 0) as [SourceType, number][];

  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Search Brief
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {briefParsed.titles && briefParsed.titles.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Titles</p>
            {briefParsed.titles.map((t) => (
              <p key={t} className="text-xs text-foreground">{t}</p>
            ))}
          </div>
        )}

        {briefParsed.industries && briefParsed.industries.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Industries</p>
            <p className="text-xs text-foreground">{briefParsed.industries.join(", ")}</p>
          </div>
        )}

        {briefParsed.locations && briefParsed.locations.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Locations</p>
            <p className="text-xs text-foreground">{briefParsed.locations.join(", ")}</p>
          </div>
        )}

        {briefParsed.skills && briefParsed.skills.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Skills</p>
            <p className="text-xs text-foreground">{briefParsed.skills.join(", ")}</p>
          </div>
        )}

        {briefParsed.seniorityLevel && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Seniority</p>
            <p className="text-xs text-foreground">{briefParsed.seniorityLevel}</p>
          </div>
        )}

        {briefParsed.yearsExperience && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Experience</p>
            <p className="text-xs text-foreground">{briefParsed.yearsExperience}</p>
          </div>
        )}

        {/* Boolean string */}
        {booleanString && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Boolean String</p>
            <div className="relative">
              <div className="bg-muted rounded-md p-2 pr-8 text-[10px] font-mono text-foreground/80 break-all leading-relaxed max-h-24 overflow-y-auto">
                {booleanString}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-1 right-1 h-6 w-6"
                    onClick={onCopyBoolean}
                    data-testid="button-copy-boolean"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy boolean string</TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        {/* Sources breakdown */}
        {sourceEntries.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Sources Hit</p>
            <div className="space-y-1.5">
              {sourceEntries.map(([source, count]) => (
                <div key={source} className="flex items-center justify-between">
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    SOURCE_LABELS[source].color
                  )}>
                    {SOURCE_LABELS[source].icon}
                    {SOURCE_LABELS[source].label}
                  </span>
                  <span className="text-xs font-semibold text-foreground">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Perplexity citations */}
        {result.perplexityCitations && result.perplexityCitations.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Perplexity Sources</p>
            <div className="space-y-1">
              {result.perplexityCitations.slice(0, 5).map((url, i) => {
                let host = url;
                try { host = new URL(url).hostname.replace("www.", ""); } catch { /* ignore */ }
                return (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-primary hover:underline truncate">
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    {host}
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Demo mode notice */}
        {demoMode && (
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">Demo Mode</p>
                <ul className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 leading-relaxed space-y-0.5">
                  {!googleAvailable && <li>→ Google CSE keys for X-Ray</li>}
                  {!perplexityAvailable && <li>→ Perplexity key for AI search</li>}
                </ul>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Source cycling message ────────────────────────────────────────────────────

const SEARCH_MESSAGES = [
  "Searching LinkedIn X-Ray...",
  "Scanning Open Web profiles...",
  "Analyzing candidate fit scores...",
  "Parsing search brief...",
  "Ranking by relevance...",
];

function useSearchMessage(isPending: boolean) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!isPending) { setIndex(0); return; }
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % SEARCH_MESSAGES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [isPending]);
  return SEARCH_MESSAGES[index];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Source() {
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [query, setQuery] = useState("");
  const [sources, setSources] = useState<SourceType[]>(["linkedin_xray", "web", "perplexity"]);
  const [limit, setLimit] = useState(20);
  const [result, setResult] = useState<SourcingResult | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);

  // Config query (for demo mode detection)
  const { data: config } = useQuery<{ demoMode?: boolean; pdl?: boolean; perplexity?: boolean; googleCse?: boolean }>({
    queryKey: ["/api/sourcing/config"],
  });

  const demoMode = config?.demoMode ?? true;
  const pdlAvailable = config?.pdl ?? false;
  const perplexityAvailable = config?.perplexity ?? false;
  const googleAvailable = config?.googleCse ?? false;

  const searchMessage = useSearchMessage(false);

  // Search mutation
  const searchMutation = useMutation({
    mutationFn: async (payload: { query: string; sources: SourceType[]; limit: number }) => {
      const r = await apiRequest("POST", "/api/sourcing/search", payload);
      return r.json() as Promise<SourcingResult>;
    },
    onSuccess: (data) => {
      setResult(data);
    },
    onError: (err: Error) => {
      toast({
        title: "Search failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const cycledMessage = useSearchMessage(searchMutation.isPending);

  // Add to pipeline mutation
  const addMutation = useMutation({
    mutationFn: async (candidate: SourcingCandidate) => {
      const r = await apiRequest("POST", "/api/sourcing/add-to-pipeline", { candidate });
      return r.json();
    },
    onSuccess: (_data, candidate) => {
      setAddedIds((prev) => { const next = new Set(Array.from(prev)); next.add(candidate.id); return next; });
      setAddingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      toast({
        title: "Added to pipeline",
        description: `${candidate.name} added as Sourced candidate`,
      });
    },
    onError: (err: Error) => {
      setAddingId(null);
      toast({
        title: "Failed to add candidate",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  function handleAdd(candidate: SourcingCandidate) {
    setAddingId(candidate.id);
    addMutation.mutate(candidate);
  }

  function handleSearch() {
    if (!query.trim()) return;
    searchMutation.mutate({ query: query.trim(), sources, limit });
  }

  function handleQuickSearch(qs: string) {
    setQuery(qs);
    setTimeout(() => {
      searchMutation.mutate({ query: qs, sources, limit });
    }, 50);
  }

  function handleNewSearch() {
    setResult(null);
    searchMutation.reset();
    setTimeout(() => textareaRef.current?.focus(), 100);
  }

  function handleCopyBoolean() {
    if (result?.booleanString) {
      navigator.clipboard.writeText(result.booleanString);
      toast({ title: "Copied", description: "Boolean string copied to clipboard" });
    }
  }

  function toggleSource(source: SourceType) {
    setSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  }

  // Auto-grow textarea
  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setQuery(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 144) + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSearch();
    }
  }

  // Sort candidates by fit score DESC
  const sortedCandidates = result
    ? [...result.candidates].sort((a, b) => b.fitScore - a.fitScore)
    : [];

  const showResults = result !== null || searchMutation.isPending;

  // ─── Render: Results State ─────────────────────────────────────────────────
  if (showResults) {
    return (
      <div className="flex flex-col gap-4">
        {/* Top bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold text-foreground">AI Sourcing</h1>
              {searchMutation.isPending && (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {searchMutation.isPending ? (
              <p className="text-sm text-muted-foreground mt-0.5 transition-all duration-500">
                {cycledMessage}
              </p>
            ) : result ? (
              <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-results-summary">
                Found{" "}
                <span className="font-semibold text-foreground">{result.totalFound} candidates</span>{" "}
                across{" "}
                <span className="font-semibold text-foreground">
                  {Object.values(result.sources).filter((v) => v > 0).length} sources
                </span>
              </p>
            ) : null}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewSearch}
            data-testid="button-new-search"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            New Search
          </Button>
        </div>

        {/* Demo mode banner */}
        {demoMode && result && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Running in demo mode — add your Google CSE API key in{" "}
              <span className="font-semibold">Settings → API Keys</span> to enable live search
            </p>
          </div>
        )}

        {/* Error state */}
        {searchMutation.isError && (
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-destructive" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-foreground">Search failed</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {searchMutation.error?.message || "An error occurred. Please try again."}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => searchMutation.mutate({ query, sources, limit })}
                data-testid="button-try-again"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Main content: cards + brief panel */}
        <div className="flex gap-5 items-start">
          {/* Candidate cards — 70% */}
          <div className="flex-[7] flex flex-col gap-3">
            {searchMutation.isPending ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : result && sortedCandidates.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 px-8 text-center">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Search className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-sm text-foreground mb-1">No candidates found</h3>
                  <p className="text-xs text-muted-foreground max-w-[32ch] leading-relaxed">
                    Try broadening your search — fewer filters, different titles, or wider location range.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleNewSearch}
                    className="mt-4"
                    data-testid="button-new-search-empty"
                  >
                    New Search
                  </Button>
                </CardContent>
              </Card>
            ) : (
              result &&
              sortedCandidates.map((candidate, i) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  isAdded={addedIds.has(candidate.id) || candidate.addedToPipeline}
                  onAdd={handleAdd}
                  isAddPending={addingId === candidate.id}
                  style={{
                    opacity: 0,
                    animation: `fadeSlideIn 0.3s ease forwards`,
                    animationDelay: `${i * 60}ms`,
                  }}
                />
              ))
            )}
          </div>

          {/* Brief analysis panel — 30% */}
          <div className="flex-[3] min-w-[240px]">
            {searchMutation.isPending ? (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/5" />
                  <Skeleton className="h-16 w-full rounded-md" />
                </CardContent>
              </Card>
            ) : result ? (
              <BriefAnalysisPanel
                result={result}
                onCopyBoolean={handleCopyBoolean}
                demoMode={demoMode}
                googleAvailable={googleAvailable}
                perplexityAvailable={perplexityAvailable}
              />
            ) : null}
          </div>
        </div>

        {/* CSS animation */}
        <style>{`
          @keyframes fadeSlideIn {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  // ─── Render: Search Input State ────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">AI Source</h1>
      </div>

      {/* Centered input card */}
      <div className="max-w-2xl mx-auto w-full mt-4">
        <Card>
          <CardContent className="p-6 space-y-5">
            {/* Subtitle */}
            <div>
              <p className="text-sm text-muted-foreground">
                Find candidates across the public web using natural language search
              </p>
            </div>

            {/* Textarea */}
            <div className="space-y-1.5">
              <Textarea
                ref={textareaRef}
                value={query}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder={`Describe who you're looking for...\ne.g. CFO with PE-backed healthcare experience, 10+ years, Chicago or NYC`}
                className="resize-none min-h-[80px] text-sm leading-relaxed"
                style={{ maxHeight: "144px" }}
                data-testid="textarea-search-query"
              />
              <p className="text-[10px] text-muted-foreground">
                Press <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">⌘ Enter</kbd> to search
              </p>
            </div>

            {/* Source checkboxes */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Source from:</p>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                {(
                  [
                    {
                      id: "linkedin_xray" as SourceType,
                      label: "LinkedIn X-Ray",
                      live: googleAvailable,
                      suffix: !googleAvailable ? "(Google CSE key required)" : "● Live",
                    },
                    {
                      id: "web" as SourceType,
                      label: "Open Web",
                      live: googleAvailable,
                      suffix: !googleAvailable ? "(Google CSE key required)" : "● Live",
                    },
                    {
                      id: "perplexity" as SourceType,
                      label: "Perplexity AI",
                      live: perplexityAvailable,
                      suffix: !perplexityAvailable ? "(API key required)" : "● Live",
                    },
                    {
                      id: "github" as SourceType,
                      label: "GitHub",
                      live: true,
                      suffix: "● Live",
                    },
                    {
                      id: "pdl" as SourceType,
                      label: "People Data Labs",
                      live: pdlAvailable,
                      suffix: !pdlAvailable ? "(API key required)" : "● Live",
                    },
                  ]
                ).map(({ id, label, live, suffix }) => (
                  <div key={id} className="flex items-center gap-2">
                    <Checkbox
                      id={`source-${id}`}
                      checked={sources.includes(id)}
                      onCheckedChange={() => toggleSource(id)}
                      data-testid={`checkbox-source-${id}`}
                    />
                    <Label
                      htmlFor={`source-${id}`}
                      className="text-xs cursor-pointer select-none leading-tight"
                    >
                      {label}
                      {suffix && (
                        <span className={cn("ml-1 font-normal text-[10px]", live ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}>
                          {suffix}
                        </span>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Limit + Search button */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="results-limit" className="text-xs whitespace-nowrap text-muted-foreground">
                  Results limit:
                </Label>
                <Select
                  value={String(limit)}
                  onValueChange={(v) => setLimit(Number(v))}
                >
                  <SelectTrigger
                    id="results-limit"
                    className="h-9 w-[80px] text-xs"
                    data-testid="select-results-limit"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleSearch}
                disabled={!query.trim() || searchMutation.isPending || sources.length === 0}
                className="ml-auto"
                data-testid="button-search"
              >
                {searchMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                Search
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick searches */}
        <div className="mt-5">
          <p className="text-xs font-medium text-muted-foreground mb-3">Quick searches:</p>
          <div className="flex flex-col gap-1.5">
            {QUICK_SEARCHES.map((qs) => (
              <button
                key={qs}
                onClick={() => handleQuickSearch(qs)}
                className="text-left text-xs text-muted-foreground hover:text-foreground transition-colors py-1 pl-3 rounded-md hover:bg-muted/60 border-l-2 border-transparent hover:border-primary/40"
                data-testid={`button-quick-search-${qs.slice(0, 20).replace(/\s+/g, "-").toLowerCase()}`}
              >
                <span className="text-muted-foreground/60 mr-1">•</span> {qs}
              </button>
            ))}
          </div>
        </div>

        {/* Sources indicator */}
        {sources.length === 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-3.5 h-3.5" />
            Select at least one source to search
          </div>
        )}

        {/* Demo mode notice in search state */}
        {demoMode && (
          <div className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                Demo mode — results are simulated
              </p>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 pl-6">
              Add API keys in <span className="font-semibold">Settings → Sourcing APIs</span> to enable live search:
            </p>
            <ul className="text-xs text-amber-600 dark:text-amber-400 pl-6 space-y-0.5 list-disc list-inside">
              <li><span className="font-medium">Google CSE</span> — powers LinkedIn X-Ray &amp; Open Web search</li>
              <li><span className="font-medium">Perplexity AI</span> — AI-powered web candidate discovery</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
