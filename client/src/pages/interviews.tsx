import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Interview } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardList,
  Star,
  DollarSign,
  TrendingUp,
  Plus,
  Clock,
  User,
  Building2,
  MessageSquare,
  CalendarDays,
  ThumbsUp,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── helpers ──────────────────────────────────────────────────────────────────

const typeColors: Record<string, string> = {
  phone_screen:
    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  first_round:
    "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  technical:
    "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  final:
    "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  pe_partner:
    "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
};

const typeLabels: Record<string, string> = {
  phone_screen: "Phone Screen",
  first_round: "First Round",
  technical: "Technical",
  final: "Final",
  pe_partner: "PE Partner",
};

const recommendationColors: Record<string, string> = {
  advance:
    "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  hold: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  pass: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function StarRating({
  rating,
  max = 5,
  size = 14,
  interactive = false,
  onChange,
}: {
  rating: number;
  max?: number;
  size?: number;
  interactive?: boolean;
  onChange?: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => {
        const filled = interactive ? i < (hovered || rating) : i < rating;
        return (
          <Star
            key={i}
            size={size}
            className={cn(
              "transition-colors",
              filled
                ? "fill-amber-400 text-amber-400"
                : "fill-none text-muted-foreground/40",
              interactive && "cursor-pointer hover:scale-110"
            )}
            onMouseEnter={() => interactive && setHovered(i + 1)}
            onMouseLeave={() => interactive && setHovered(0)}
            onClick={() => interactive && onChange?.(i + 1)}
            data-testid={interactive ? `star-rating-${i + 1}` : undefined}
          />
        );
      })}
    </div>
  );
}

function safeParseArray(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// ── KPI Cards ────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  iconClass,
  "data-testid": testId,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  iconClass?: string;
  "data-testid"?: string;
}) {
  return (
    <Card className="border border-card-border" data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {label}
          </span>
          <div
            className={cn(
              "w-7 h-7 rounded-md flex items-center justify-center",
              iconClass ?? "bg-primary/10"
            )}
          >
            <Icon size={14} className={iconClass ? "text-white" : "text-primary"} />
          </div>
        </div>
        <p className="text-xl font-bold font-display leading-none">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Log Interview Dialog ─────────────────────────────────────────────────────

function LogInterviewDialog({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [form, setForm] = useState({
    candidateId: "",
    candidateName: "",
    candidateTitle: "",
    jobTitle: "",
    jobCompany: "",
    interviewType: "",
    interviewDate: "",
    interviewer: "",
    duration: "",
    notes: "",
    strengths: "",
    concerns: "",
    salaryDiscussed: "",
    nextSteps: "",
    recommendation: "",
  });

  const mutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/interviews", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/interviews"] });
      setOpen(false);
      setRating(0);
      setForm({
        candidateId: "",
        candidateName: "",
        candidateTitle: "",
        jobTitle: "",
        jobCompany: "",
        interviewType: "",
        interviewDate: "",
        interviewer: "",
        duration: "",
        notes: "",
        strengths: "",
        concerns: "",
        salaryDiscussed: "",
        nextSteps: "",
        recommendation: "",
      });
      toast({ title: "Interview logged", description: "Interview record saved successfully." });
      onSuccess();
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to log interview",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({
      candidateId: parseInt(form.candidateId, 10) || 0,
      candidateName: form.candidateName,
      candidateTitle: form.candidateTitle,
      jobTitle: form.jobTitle,
      jobCompany: form.jobCompany,
      interviewType: form.interviewType,
      interviewDate: form.interviewDate,
      interviewer: form.interviewer,
      duration: parseInt(form.duration, 10) || 0,
      overallRating: rating,
      notes: form.notes,
      strengths: JSON.stringify(
        form.strengths
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      ),
      concerns: JSON.stringify(
        form.concerns
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      ),
      salaryDiscussed: form.salaryDiscussed || null,
      nextSteps: form.nextSteps,
      recommendation: form.recommendation,
    });
  }

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5" data-testid="button-log-interview">
          <Plus size={14} />
          Log Interview
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="font-display">Log Interview</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Candidate row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="li-candidateName" className="text-xs">
                Candidate Name
              </Label>
              <Input
                id="li-candidateName"
                value={form.candidateName}
                onChange={(e) => set("candidateName", e.target.value)}
                placeholder="Jane Smith"
                required
                data-testid="input-candidate-name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="li-candidateTitle" className="text-xs">
                Candidate Title
              </Label>
              <Input
                id="li-candidateTitle"
                value={form.candidateTitle}
                onChange={(e) => set("candidateTitle", e.target.value)}
                placeholder="VP of Engineering"
                required
                data-testid="input-candidate-title"
              />
            </div>
          </div>

          {/* Job row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="li-jobTitle" className="text-xs">
                Job Title
              </Label>
              <Input
                id="li-jobTitle"
                value={form.jobTitle}
                onChange={(e) => set("jobTitle", e.target.value)}
                placeholder="CTO"
                required
                data-testid="input-job-title"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="li-jobCompany" className="text-xs">
                Company
              </Label>
              <Input
                id="li-jobCompany"
                value={form.jobCompany}
                onChange={(e) => set("jobCompany", e.target.value)}
                placeholder="Acme Corp"
                required
                data-testid="input-job-company"
              />
            </div>
          </div>

          {/* Type + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Interview Type</Label>
              <Select
                value={form.interviewType}
                onValueChange={(v) => set("interviewType", v)}
                required
              >
                <SelectTrigger data-testid="select-interview-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone_screen">Phone Screen</SelectItem>
                  <SelectItem value="first_round">First Round</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="final">Final</SelectItem>
                  <SelectItem value="pe_partner">PE Partner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="li-interviewDate" className="text-xs">
                Date
              </Label>
              <Input
                id="li-interviewDate"
                type="date"
                value={form.interviewDate}
                onChange={(e) => set("interviewDate", e.target.value)}
                required
                data-testid="input-interview-date"
              />
            </div>
          </div>

          {/* Interviewer + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="li-interviewer" className="text-xs">
                Interviewer
              </Label>
              <Input
                id="li-interviewer"
                value={form.interviewer}
                onChange={(e) => set("interviewer", e.target.value)}
                placeholder="John Doe"
                required
                data-testid="input-interviewer"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="li-duration" className="text-xs">
                Duration (minutes)
              </Label>
              <Input
                id="li-duration"
                type="number"
                min={1}
                value={form.duration}
                onChange={(e) => set("duration", e.target.value)}
                placeholder="45"
                required
                data-testid="input-duration"
              />
            </div>
          </div>

          {/* CandidateId (hidden-ish) */}
          <div className="space-y-1">
            <Label htmlFor="li-candidateId" className="text-xs">
              Candidate ID (optional)
            </Label>
            <Input
              id="li-candidateId"
              type="number"
              value={form.candidateId}
              onChange={(e) => set("candidateId", e.target.value)}
              placeholder="1"
              data-testid="input-candidate-id"
            />
          </div>

          {/* Rating */}
          <div className="space-y-1">
            <Label className="text-xs">Overall Rating</Label>
            <div className="flex items-center gap-2">
              <StarRating
                rating={rating}
                interactive
                onChange={setRating}
                size={20}
              />
              <span className="text-xs text-muted-foreground">
                {rating > 0 ? `${rating} / 5` : "Click to rate"}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label htmlFor="li-notes" className="text-xs">
              Notes
            </Label>
            <Textarea
              id="li-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Interview observations..."
              required
              data-testid="textarea-notes"
            />
          </div>

          {/* Strengths + Concerns */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="li-strengths" className="text-xs">
                Strengths (comma-separated)
              </Label>
              <Input
                id="li-strengths"
                value={form.strengths}
                onChange={(e) => set("strengths", e.target.value)}
                placeholder="Leadership, Communication"
                data-testid="input-strengths"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="li-concerns" className="text-xs">
                Concerns (comma-separated)
              </Label>
              <Input
                id="li-concerns"
                value={form.concerns}
                onChange={(e) => set("concerns", e.target.value)}
                placeholder="Compensation gap"
                data-testid="input-concerns"
              />
            </div>
          </div>

          {/* Salary Discussed */}
          <div className="space-y-1">
            <Label htmlFor="li-salaryDiscussed" className="text-xs">
              Salary Discussed (optional)
            </Label>
            <Input
              id="li-salaryDiscussed"
              value={form.salaryDiscussed}
              onChange={(e) => set("salaryDiscussed", e.target.value)}
              placeholder="$250k base + equity"
              data-testid="input-salary-discussed"
            />
          </div>

          {/* Next Steps */}
          <div className="space-y-1">
            <Label htmlFor="li-nextSteps" className="text-xs">
              Next Steps
            </Label>
            <Input
              id="li-nextSteps"
              value={form.nextSteps}
              onChange={(e) => set("nextSteps", e.target.value)}
              placeholder="Schedule final round by Friday"
              required
              data-testid="input-next-steps"
            />
          </div>

          {/* Recommendation */}
          <div className="space-y-1">
            <Label className="text-xs">Recommendation</Label>
            <Select
              value={form.recommendation}
              onValueChange={(v) => set("recommendation", v)}
              required
            >
              <SelectTrigger data-testid="select-recommendation">
                <SelectValue placeholder="Select recommendation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="advance">Advance</SelectItem>
                <SelectItem value="hold">Hold</SelectItem>
                <SelectItem value="pass">Pass</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              data-testid="button-cancel-log"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={mutation.isPending}
              data-testid="button-submit-log"
            >
              {mutation.isPending ? "Saving..." : "Log Interview"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Detail Sheet ─────────────────────────────────────────────────────────────

function InterviewDetail({ interview }: { interview: Interview }) {
  const strengths = safeParseArray(interview.strengths);
  const concerns = safeParseArray(interview.concerns);

  return (
    <div className="space-y-6">
      <SheetHeader>
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User size={18} className="text-primary" />
          </div>
          <div>
            <SheetTitle className="text-lg font-display leading-tight">
              {interview.candidateName}
            </SheetTitle>
            <p className="text-sm text-muted-foreground">{interview.candidateTitle}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {interview.jobTitle} · {interview.jobCompany}
            </p>
          </div>
        </div>
      </SheetHeader>

      {/* Rating + type + date */}
      <div className="flex flex-wrap items-center gap-3">
        <StarRating rating={interview.overallRating} size={16} />
        <Badge
          variant="secondary"
          className={cn(
            "text-[10px] font-medium",
            typeColors[interview.interviewType]
          )}
        >
          {typeLabels[interview.interviewType] ?? interview.interviewType}
        </Badge>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays size={11} />
          <span>{formatDate(interview.interviewDate)}</span>
        </div>
      </div>

      {/* Meta row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock size={13} />
          <span>{interview.duration} min</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User size={13} />
          <span>{interview.interviewer}</span>
        </div>
      </div>

      {/* Notes */}
      {interview.notes && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <MessageSquare size={13} className="text-muted-foreground" />
            Notes
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {interview.notes}
          </p>
        </div>
      )}

      {/* Strengths */}
      {strengths.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <ThumbsUp size={13} className="text-green-500" />
            Strengths
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {strengths.map((s) => (
              <Badge
                key={s}
                variant="secondary"
                className="text-xs bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              >
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Concerns */}
      {concerns.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <AlertTriangle size={13} className="text-amber-500" />
            Concerns
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {concerns.map((c) => (
              <Badge
                key={c}
                variant="secondary"
                className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              >
                {c}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Salary */}
      {interview.salaryDiscussed && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-blue-500 flex items-center justify-center flex-shrink-0">
            <DollarSign size={14} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">
              Salary Discussed
            </p>
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
              {interview.salaryDiscussed}
            </p>
          </div>
        </div>
      )}

      {/* Next Steps */}
      {interview.nextSteps && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <ChevronRight size={13} className="text-primary" />
            Next Steps
          </h3>
          <p className="text-sm text-muted-foreground">{interview.nextSteps}</p>
        </div>
      )}

      {/* Recommendation */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Recommendation:</span>
        <Badge
          variant="secondary"
          className={cn(
            "text-xs font-semibold capitalize",
            recommendationColors[interview.recommendation]
          )}
        >
          {interview.recommendation}
        </Badge>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function Interviews() {
  const [selected, setSelected] = useState<Interview | null>(null);

  const { data: interviews = [], isLoading } = useQuery<Interview[]>({
    queryKey: ["/api/interviews"],
  });

  // KPI calculations
  const total = interviews.length;
  const avgRating =
    total > 0
      ? (interviews.reduce((sum, i) => sum + i.overallRating, 0) / total).toFixed(1)
      : "0.0";
  const salaryIntelCount = interviews.filter(
    (i) => i.salaryDiscussed && i.salaryDiscussed.trim() !== ""
  ).length;
  const advanceRate =
    total > 0
      ? Math.round(
          (interviews.filter((i) => i.recommendation === "advance").length / total) * 100
        )
      : 0;

  const salaryInterviews = interviews.filter(
    (i) => i.salaryDiscussed && i.salaryDiscussed.trim() !== ""
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-xl">
            Interview Intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track interviews, capture insights, and build candidate knowledge
          </p>
        </div>
        <LogInterviewDialog onSuccess={() => {}} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="kpi-row">
        <KpiCard
          icon={ClipboardList}
          label="Total Interviews"
          value={total}
          sub={total === 1 ? "1 interview logged" : `${total} interviews logged`}
          data-testid="kpi-total-interviews"
        />
        <KpiCard
          icon={Star}
          label="Avg Rating"
          value={`${avgRating} / 5`}
          sub="Overall candidate quality"
          iconClass="bg-amber-400"
          data-testid="kpi-avg-rating"
        />
        <KpiCard
          icon={DollarSign}
          label="Salary Intel"
          value={salaryIntelCount}
          sub="Compensation data points"
          iconClass="bg-blue-500"
          data-testid="kpi-salary-intel"
        />
        <KpiCard
          icon={TrendingUp}
          label="Advance Rate"
          value={`${advanceRate}%`}
          sub="Of interviews recommended"
          iconClass="bg-green-500"
          data-testid="kpi-advance-rate"
        />
      </div>

      {/* Table */}
      <Card className="border border-card-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">
                  Candidate
                </th>
                <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5 hidden md:table-cell">
                  Role / Company
                </th>
                <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">
                  Type
                </th>
                <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5 hidden lg:table-cell">
                  Date
                </th>
                <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">
                  Rating
                </th>
                <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5 hidden md:table-cell">
                  Recommendation
                </th>
                <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5 hidden lg:table-cell">
                  Duration
                </th>
                <th className="px-4 py-2.5 w-8" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    Loading interviews...
                  </td>
                </tr>
              )}
              {!isLoading && interviews.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ClipboardList size={28} className="opacity-40" />
                      <p className="text-sm">No interviews logged yet</p>
                      <p className="text-xs">Click "Log Interview" to get started</p>
                    </div>
                  </td>
                </tr>
              )}
              {interviews.map((interview) => (
                <tr
                  key={interview.id}
                  onClick={() => setSelected(interview)}
                  className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                  data-testid={`row-interview-${interview.id}`}
                >
                  {/* Candidate */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <User size={12} className="text-primary" />
                      </div>
                      <div>
                        <p className="font-medium leading-tight">
                          {interview.candidateName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {interview.candidateTitle}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Role / Company */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="leading-tight">{interview.jobTitle}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Building2 size={10} />
                      <span>{interview.jobCompany}</span>
                    </div>
                  </td>

                  {/* Type */}
                  <td className="px-4 py-3">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] font-medium whitespace-nowrap",
                        typeColors[interview.interviewType]
                      )}
                    >
                      {typeLabels[interview.interviewType] ?? interview.interviewType}
                    </Badge>
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                    {formatDate(interview.interviewDate)}
                  </td>

                  {/* Rating */}
                  <td className="px-4 py-3">
                    <StarRating rating={interview.overallRating} size={12} />
                  </td>

                  {/* Recommendation */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] font-semibold capitalize",
                        recommendationColors[interview.recommendation]
                      )}
                    >
                      {interview.recommendation}
                    </Badge>
                  </td>

                  {/* Duration */}
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock size={11} />
                      <span>{interview.duration}min</span>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Salary Intelligence Panel */}
      {salaryInterviews.length > 0 && (
        <Card className="border border-card-border" data-testid="salary-intelligence-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-blue-500 flex items-center justify-center">
                <DollarSign size={13} className="text-white" />
              </div>
              Salary Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {salaryInterviews.map((interview) => (
                <div
                  key={interview.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  data-testid={`salary-item-${interview.id}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User size={11} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium leading-tight">
                        {interview.candidateName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {interview.jobTitle} · {interview.jobCompany}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold text-blue-600 dark:text-blue-400">
                    <DollarSign size={12} />
                    <span>{interview.salaryDiscussed}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && <InterviewDetail interview={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
