import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, Loader2, RefreshCw, User, Building2, Briefcase,
  TrendingUp, ArrowRight, Mail, Star, AlertCircle, CheckCircle2,
  Clock, ExternalLink,
} from "lucide-react";

interface JobMatch {
  candidateId: number;
  candidateName: string;
  candidateTitle: string;
  candidateCompany: string;
  candidateEmail: string;
  jobId: number;
  jobTitle: string;
  jobCompany: string;
  fitScore: number;
  fitReason: string;
  suggestedAction: string;
}

interface ChangeCandidate {
  candidateId: number;
  candidateName: string;
  candidateTitle: string;
  candidateCompany: string;
  candidateEmail: string;
  tenure: string;
  changeSignals: string[];
  changeScore: number;
  brief: string;
}

interface BDTarget {
  company: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  candidateCount: number;
  insight: string;
  bdScore: number;
}

interface RediscoveryResult {
  jobMatches: JobMatch[];
  openToChange: ChangeCandidate[];
  bdTargets: BDTarget[];
  generatedAt: string;
  candidatesAnalyzed: number;
}

interface StatusData {
  isRunning: boolean;
  hasResults: boolean;
  generatedAt: string | null;
  candidatesAnalyzed: number;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 85
    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    : score >= 70
    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  return (
    <Badge className={`text-xs border-0 font-bold ${color}`}>{score}</Badge>
  );
}

function JobMatchCard({ match }: { match: JobMatch }) {
  const { toast } = useToast();
  return (
    <div className="rounded-xl border border-border bg-background p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <User size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">{match.candidateName}</p>
            <ScoreBadge score={match.fitScore} />
          </div>
          <p className="text-xs text-muted-foreground">{match.candidateTitle} · {match.candidateCompany}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <ArrowRight size={12} className="text-primary flex-shrink-0" />
        <span className="font-medium">{match.jobTitle}</span>
        <span className="text-muted-foreground">at</span>
        <span className="font-medium">{match.jobCompany}</span>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed bg-muted/30 rounded-lg px-3 py-2">{match.fitReason}</p>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground italic">{match.suggestedAction}</p>
        <div className="flex gap-1.5">
          {match.candidateEmail && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => {
                navigator.clipboard.writeText(match.candidateEmail);
                toast({ title: "Email copied!" });
              }}
            >
              <Mail size={11} /> Copy Email
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChangeCandidateCard({ candidate }: { candidate: ChangeCandidate }) {
  const { toast } = useToast();
  return (
    <div className="rounded-xl border border-border bg-background p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
          <TrendingUp size={16} className="text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">{candidate.candidateName}</p>
            <ScoreBadge score={candidate.changeScore} />
          </div>
          <p className="text-xs text-muted-foreground">{candidate.candidateTitle} · {candidate.candidateCompany}</p>
          {candidate.tenure && candidate.tenure !== "Unknown" && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <Clock size={10} /> Tenure: {candidate.tenure}
            </p>
          )}
        </div>
      </div>

      {candidate.changeSignals.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {candidate.changeSignals.map((s, i) => (
            <span key={i} className="text-[10px] bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-full px-2 py-0.5">
              {s}
            </span>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground leading-relaxed bg-muted/30 rounded-lg px-3 py-2">{candidate.brief}</p>

      <div className="flex justify-end gap-1.5">
        {candidate.candidateEmail && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => {
              navigator.clipboard.writeText(candidate.candidateEmail);
              toast({ title: "Email copied!" });
            }}
          >
            <Mail size={11} /> Copy Email
          </Button>
        )}
      </div>
    </div>
  );
}

function BDTargetCard({ target }: { target: BDTarget }) {
  const { toast } = useToast();
  return (
    <div className="rounded-xl border border-border bg-background p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
          <Building2 size={16} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">{target.company}</p>
            <ScoreBadge score={target.bdScore} />
            <Badge variant="secondary" className="text-[10px]">{target.candidateCount} candidate{target.candidateCount !== 1 ? "s" : ""}</Badge>
          </div>
          {target.contactName && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Contact: <span className="font-medium">{target.contactName}</span>
              {target.contactTitle && ` · ${target.contactTitle}`}
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed bg-muted/30 rounded-lg px-3 py-2">{target.insight}</p>

      <div className="flex justify-end gap-1.5">
        {target.contactEmail && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => {
              navigator.clipboard.writeText(target.contactEmail);
              toast({ title: "Email copied!" });
            }}
          >
            <Mail size={11} /> Copy Email
          </Button>
        )}
      </div>
    </div>
  );
}

export default function TalentRediscovery() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: status, refetch: refetchStatus } = useQuery<StatusData>({
    queryKey: ["/api/rediscovery/status"],
    queryFn: async () => {
      const r = await fetch("/api/rediscovery/status", { credentials: "include" });
      return r.json();
    },
    refetchInterval: (data) => (data?.state.data?.isRunning ? 3000 : false),
  });

  const { data: results, refetch: refetchResults } = useQuery<RediscoveryResult | null>({
    queryKey: ["/api/rediscovery/results"],
    queryFn: async () => {
      const r = await fetch("/api/rediscovery/results", { credentials: "include" });
      const data = await r.json();
      return data;
    },
    enabled: status?.hasResults ?? false,
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/rediscovery/run", {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error);
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Analysis started", description: "AI is analyzing your candidate database. This takes 15–30 seconds." });
      // Poll until done
      const poll = setInterval(() => {
        refetchStatus().then(({ data }) => {
          if (!data?.isRunning) {
            clearInterval(poll);
            refetchResults();
            queryClient.invalidateQueries({ queryKey: ["/api/rediscovery/status"] });
          }
        });
      }, 3000);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isRunning = status?.isRunning || runMutation.isPending;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-xl flex items-center gap-2">
            <Sparkles size={18} className="text-primary" />
            AI Talent Rediscovery
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI scans your candidate database to surface hidden opportunities — job matches, change-ready candidates, and BD targets
          </p>
        </div>
      </div>

      {/* Hero action card */}
      <Card className="border border-border">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles size={22} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">AI Candidate Analysis</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {status?.hasResults && status?.generatedAt
                  ? `Last run: ${new Date(status.generatedAt).toLocaleString()} · ${status.candidatesAnalyzed} candidates analyzed`
                  : "Run the analysis to discover opportunities across your full candidate database"
                }
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5 text-xs flex-shrink-0"
              onClick={() => runMutation.mutate()}
              disabled={isRunning}
            >
              {isRunning
                ? <><Loader2 size={12} className="animate-spin" /> Analyzing…</>
                : <><RefreshCw size={12} /> {status?.hasResults ? "Re-run Analysis" : "Run Analysis"}</>
              }
            </Button>
          </div>

          {isRunning && (
            <div className="mt-4 rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 flex items-center gap-2.5 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin text-primary" />
              Claude is analyzing your candidate database for opportunities — usually takes 15–30 seconds…
            </div>
          )}

          {!process.env.ANTHROPIC_API_KEY && !status?.hasResults && !isRunning && (
            <div className="mt-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 px-4 py-3 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>
                <strong>ANTHROPIC_API_KEY required.</strong> Add it in your Render environment variables to enable AI analysis.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <Tabs defaultValue="job_matches">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="job_matches" className="text-xs gap-1.5">
              <Briefcase size={12} />
              Job Matches
              {results.jobMatches.length > 0 && (
                <Badge className="ml-1 text-[10px] border-0 bg-primary/10 text-primary h-4 px-1.5">{results.jobMatches.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="open_to_change" className="text-xs gap-1.5">
              <TrendingUp size={12} />
              Open to Change
              {results.openToChange.length > 0 && (
                <Badge className="ml-1 text-[10px] border-0 bg-primary/10 text-primary h-4 px-1.5">{results.openToChange.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="bd_targets" className="text-xs gap-1.5">
              <Building2 size={12} />
              BD Targets
              {results.bdTargets.length > 0 && (
                <Badge className="ml-1 text-[10px] border-0 bg-primary/10 text-primary h-4 px-1.5">{results.bdTargets.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="job_matches" className="mt-4 space-y-3">
            {results.jobMatches.length === 0 ? (
              <EmptyState icon={Briefcase} title="No strong job matches found" desc="Add more candidates or open jobs to see matches." />
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Candidates from your database who match current open roles — score reflects overall fit.
                </p>
                {results.jobMatches.map((m, i) => <JobMatchCard key={i} match={m} />)}
              </>
            )}
          </TabsContent>

          <TabsContent value="open_to_change" className="mt-4 space-y-3">
            {results.openToChange.length === 0 ? (
              <EmptyState icon={TrendingUp} title="No change-ready candidates detected" desc="Candidates with stale contact or career inflection signals will appear here." />
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Candidates who may be ready for their next move — score reflects likelihood of being open to outreach.
                </p>
                {results.openToChange.map((c, i) => <ChangeCandidateCard key={i} candidate={c} />)}
              </>
            )}
          </TabsContent>

          <TabsContent value="bd_targets" className="mt-4 space-y-3">
            {results.bdTargets.length === 0 ? (
              <EmptyState icon={Building2} title="No BD targets identified" desc="Companies with multiple senior candidates in your DB will appear here." />
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Companies where you have strong existing relationships — prime targets for business development outreach.
                </p>
                {results.bdTargets.map((t, i) => <BDTargetCard key={i} target={t} />)}
              </>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border py-12 text-center">
      <Icon size={28} className="mx-auto text-muted-foreground/30 mb-3" />
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">{desc}</p>
    </div>
  );
}
