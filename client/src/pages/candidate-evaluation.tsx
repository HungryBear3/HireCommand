import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Copy,
  HelpCircle,
  Loader2,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

const SYSTEM_PROMPT = `You are a senior executive talent evaluator with 20+ years placing C-suite and VP-level leaders. Evaluate the candidate against the job spec using rigorous, evidence-based criteria.

Score across these 6 dimensions (0–100 each):
1. Performance & Track Record: quantified outcomes, P&L managed, tenure-to-impact, promotion velocity, consistency across cycles
2. Leadership Quality: team retention, internal talent development, inferred 360-feedback patterns, span of control growth
3. Strategic Fit: stage match (builder/scaler/turnaround), problem pattern match, board/investor fluency
4. Cultural & Behavioral: decision-making style match, how they describe failure, learning agility, values evidence
5. Market Signals: inbound vs outbound career moves, employer brand patterns, network depth inference
6. Modern Leadership Readiness: AI/data fluency, remote leadership, cross-functional credibility, speed under ambiguity, capital efficiency mindset

Respond ONLY with valid JSON. No markdown fences, no preamble. Exact schema:
{"overall_score":85,"verdict":"Strong Hire","executive_summary":"2-3 sentences covering the top fit signal and top risk.","stage_match_note":"One sentence on builder vs scaler vs turnaround fit.","dimensions":[{"name":"Performance & Track Record","score":80,"note":"25-40 word specific observation"},{"name":"Leadership Quality","score":75,"note":"25-40 word observation"},{"name":"Strategic Fit","score":85,"note":"25-40 word observation"},{"name":"Cultural & Behavioral","score":70,"note":"25-40 word observation"},{"name":"Market Signals","score":65,"note":"25-40 word observation"},{"name":"Modern Readiness","score":80,"note":"25-40 word observation"}],"strengths":["Specific strength with evidence","Specific strength","Specific strength"],"risks":["Specific risk with reasoning","Specific risk","Specific risk"],"green_flags":["flag","flag"],"red_flags":["flag"],"reference_check_targets":["Who to call and what to probe","Second target"],"interview_probes":["[Gap label] Behavioral question","[Gap label] Second probe","[Gap label] Third probe"]}`;

const loadingSteps = [
  "Parsing job requirements and candidate background",
  "Mapping career trajectory and executive scope",
  "Scoring performance, leadership, and strategy dimensions",
  "Analyzing behavioral and market signals",
  "Generating verdict and interview recommendations",
];

type Dimension = {
  name: string;
  score: number;
  note: string;
};

type EvaluationResult = {
  overall_score: number;
  verdict: string;
  executive_summary: string;
  stage_match_note?: string;
  dimensions: Dimension[];
  strengths: string[];
  risks: string[];
  green_flags: string[];
  red_flags: string[];
  reference_check_targets: string[];
  interview_probes: string[];
};

function scoreColor(score: number) {
  if (score >= 75) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

function scoreBarColor(score: number) {
  if (score >= 75) return "bg-emerald-600";
  if (score >= 50) return "bg-amber-600";
  return "bg-red-600";
}

function verdictTone(verdict: string) {
  if (["Strong Hire", "Lean Hire"].includes(verdict)) return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
  if (["Strong Pass", "Lean Pass"].includes(verdict)) return "bg-red-500/10 text-red-600 border-red-500/20";
  return "bg-amber-500/10 text-amber-600 border-amber-500/20";
}

function extractModelText(data: any) {
  const blocks = data?.content;
  if (Array.isArray(blocks)) {
    return blocks
      .map((block) => (typeof block?.text === "string" ? block.text : ""))
      .filter(Boolean)
      .join("\n\n");
  }
  return "";
}

function parseEvaluation(data: any): EvaluationResult {
  const raw = extractModelText(data) || JSON.stringify(data);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in model response");
  return JSON.parse(jsonMatch[0]);
}

function candidateNameFromResume(candidateResume: string) {
  return candidateResume.split("\n")[0]?.trim().slice(0, 60) || "Candidate";
}

function ScoreRing({ score }: { score: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const stroke = score >= 75 ? "#059669" : score >= 50 ? "#d97706" : "#dc2626";

  return (
    <div className="relative h-20 w-20 flex-shrink-0">
      <svg viewBox="0 0 80 80" className="h-20 w-20">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="6"
          strokeDasharray={circumference.toFixed(2)}
          strokeDashoffset={offset.toFixed(2)}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
        />
      </svg>
      <div className={cn("absolute inset-0 flex items-center justify-center text-xl font-semibold", scoreColor(score))}>
        {score}
      </div>
    </div>
  );
}

function BulletList({ items }: { items?: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-muted-foreground">
      {(items || []).map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary/60 flex-shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function TagList({ items, tone }: { items?: string[]; tone: "green" | "red" }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(items || []).map((item, index) => (
        <Badge
          key={`${item}-${index}`}
          variant="outline"
          className={cn(
            "text-xs",
            tone === "green"
              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
              : "bg-red-500/10 text-red-600 border-red-500/20"
          )}
        >
          {item}
        </Badge>
      ))}
    </div>
  );
}

function EvaluationResults({ result, candidateName }: { result: EvaluationResult; candidateName: string }) {
  return (
    <Card className="border-card-border">
      <CardContent className="p-5 space-y-5">
        <div className="rounded-xl bg-muted/40 p-5 flex gap-5 items-center">
          <ScoreRing score={result.overall_score} />
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={verdictTone(result.verdict)}>
                {result.verdict}
              </Badge>
              <span className="text-sm text-muted-foreground">{candidateName}</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{result.executive_summary}</p>
            {result.stage_match_note && <p className="text-xs text-muted-foreground/80">{result.stage_match_note}</p>}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {(result.dimensions || []).map((dimension) => (
            <div key={dimension.name} className="rounded-lg border border-card-border p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{dimension.name}</span>
                <span className={cn("text-sm font-semibold", scoreColor(dimension.score))}>{dimension.score}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className={cn("h-full rounded-full", scoreBarColor(dimension.score))} style={{ width: `${dimension.score}%` }} />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{dimension.note}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-600" /> Green flags
            </h2>
            <TagList items={result.green_flags} tone="green" />
          </section>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle size={15} className="text-red-600" /> Red flags
            </h2>
            <TagList items={result.red_flags} tone="red" />
          </section>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp size={15} /> Key strengths
            </h2>
            <BulletList items={result.strengths} />
          </section>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <TrendingDown size={15} /> Key risks
            </h2>
            <BulletList items={result.risks} />
          </section>
        </div>

        <section className="space-y-3 border-t border-card-border pt-5">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Users size={15} /> Reference check strategy
          </h2>
          <BulletList items={result.reference_check_targets} />
        </section>

        <section className="space-y-3 border-t border-card-border pt-5">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <HelpCircle size={15} /> Interview probes for gaps
          </h2>
          <div className="space-y-2">
            {(result.interview_probes || []).map((probe, index) => {
              const match = probe.match(/^\[([^\]]+)]\s*([\s\S]*)/);
              return (
                <div key={`${probe}-${index}`} className="rounded-lg border border-card-border p-3">
                  {match ? <div className="text-xs font-semibold text-primary mb-1">{match[1]}</div> : null}
                  <div className="text-sm text-muted-foreground">{match ? match[2] : probe}</div>
                </div>
              );
            })}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

export default function CandidateEvaluation() {
  const [jobSpec, setJobSpec] = useState("");
  const [candidateResume, setCandidateResume] = useState("");
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const evaluation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/evaluate", {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `JOB SPECIFICATION:\n${jobSpec}\n\n---\n\nCANDIDATE RESUME:\n${candidateResume}`,
          },
        ],
      });
      return response.json();
    },
    onMutate: () => {
      setResult(null);
      setActiveStep(0);
      let step = 0;
      const timer = window.setInterval(() => {
        step = Math.min(step + 1, loadingSteps.length - 1);
        setActiveStep(step);
        if (step >= loadingSteps.length - 1) window.clearInterval(timer);
      }, 2600);
      return { timer };
    },
    onSuccess: (data) => setResult(parseEvaluation(data)),
    onSettled: (_data, _error, _variables, context) => {
      if (context?.timer) window.clearInterval(context.timer);
    },
  });

  const canEvaluate = jobSpec.trim().length > 0 && candidateResume.trim().length > 0;
  const candidateName = candidateNameFromResume(candidateResume);

  const handleEvaluate = () => {
    if (!canEvaluate) return;
    evaluation.mutate();
  };

  const copyResult = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-xl flex items-center gap-2">
            <BrainCircuit size={20} className="text-primary" />
            Executive Talent Evaluator
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Paste a job specification and candidate resume to generate a scored executive evaluation.
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <Sparkles size={12} /> Anthropic proxy
        </Badge>
      </div>

      <Card className="border-card-border">
        <CardHeader>
          <CardTitle className="text-base">Evaluation inputs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="job-spec">Job specification</Label>
              <Textarea
                id="job-spec"
                value={jobSpec}
                onChange={(event) => setJobSpec(event.target.value)}
                placeholder="Paste role requirements, company stage, must-haves, reporting line, compensation, success profile…"
                className="min-h-[260px] resize-y font-mono text-xs leading-relaxed"
                data-testid="textarea-evaluation-job-spec"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="candidate-resume">Candidate resume / profile</Label>
              <Textarea
                id="candidate-resume"
                value={candidateResume}
                onChange={(event) => setCandidateResume(event.target.value)}
                placeholder="Paste resume, LinkedIn profile, recruiter notes, compensation context, interview notes…"
                className="min-h-[260px] resize-y font-mono text-xs leading-relaxed"
                data-testid="textarea-evaluation-candidate-resume"
              />
            </div>
          </div>

          <Button
            onClick={handleEvaluate}
            disabled={!canEvaluate || evaluation.isPending}
            className="w-full gap-2"
            data-testid="button-run-candidate-evaluation"
          >
            {evaluation.isPending ? <Loader2 size={15} className="animate-spin" /> : <BrainCircuit size={15} />}
            Evaluate Executive Fit
          </Button>

          {evaluation.isPending && (
            <div className="space-y-2 pt-1">
              {loadingSteps.map((step, index) => (
                <div
                  key={step}
                  className={cn(
                    "flex items-center gap-2 text-xs transition-opacity",
                    index === activeStep ? "text-foreground opacity-100" : index < activeStep ? "text-muted-foreground opacity-70" : "text-muted-foreground opacity-35"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      index === activeStep ? "bg-primary" : index < activeStep ? "bg-emerald-600" : "bg-muted-foreground/40"
                    )}
                  />
                  {step}
                </div>
              ))}
            </div>
          )}

          {evaluation.isError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive flex gap-2">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{evaluation.error instanceof Error ? evaluation.error.message : "Evaluation failed."}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-emerald-600 flex items-center gap-2">
              <CheckCircle2 size={14} /> Evaluation complete
            </div>
            <Button variant="outline" size="sm" onClick={copyResult} className="gap-1.5">
              <Copy size={13} /> Copy JSON
            </Button>
          </div>
          <EvaluationResults result={result} candidateName={candidateName} />
        </div>
      )}
    </div>
  );
}
