import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Candidate, Job } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/components/ui/dialog";
import {
  Search,
  Sparkles,
  Mail,
  Phone,
  Linkedin,
  X,
  ChevronRight,
  Columns3,
  User,
  FileText,
  Plus,
  Filter,
  RefreshCw,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  History,
  Upload,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import CandidateBrief from "@/components/CandidateBrief";

const statusColors: Record<string, string> = {
  sourced: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  contacted: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  screening: "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400",
  interview: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  offer: "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  placed: "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400",
};

type CandidateJobFile = Job & {
  assignmentStatus?: string;
  evaluationScore?: number | null;
  evaluationVerdict?: string | null;
  evaluationSummary?: string | null;
  evaluatedAt?: string | null;
};

function evaluationBadgeTone(score?: number | null) {
  if (typeof score !== "number") return "bg-muted text-muted-foreground border-border";
  if (score >= 75) return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
  if (score >= 50) return "bg-amber-500/10 text-amber-600 border-amber-500/20";
  return "bg-red-500/10 text-red-600 border-red-500/20";
}

const FUNCTION_OPTIONS = [
  { label: "All Functions", value: "all" },
  { label: "CFO / Finance", value: "CFO / Finance", keywords: ["CFO", "VP Finance", "Finance", "Chief Financial"] },
  { label: "CAO / Accounting", value: "CAO / Accounting", keywords: ["CAO", "Chief Accounting Officer", "Chief Accounting", "Chief Accountant", "Controller", "Accounting", "Accountant", "SEC Reporting", "Technical Accounting", "Corporate Controller", "VP Accounting"] },
  { label: "CTO / Technology", value: "CTO / Technology", keywords: ["CTO", "VP Engineering", "Technology", "Chief Technology", "Engineering"] },
  { label: "COO / Operations", value: "COO / Operations", keywords: ["COO", "VP Operations", "Operations", "Chief Operating"] },
  { label: "CHRO / People", value: "CHRO / People", keywords: ["CHRO", "VP People", "People", "HR", "Human Resources", "Chief People"] },
  { label: "CMO / Marketing", value: "CMO / Marketing", keywords: ["CMO", "VP Marketing", "Marketing", "Chief Marketing"] },
  { label: "General Counsel", value: "General Counsel", keywords: ["General Counsel", "CLO", "Legal", "Chief Legal"] },
  { label: "CEO / President", value: "CEO / President", keywords: ["CEO", "President", "Chief Executive"] },
];

function matchesFunction(title: string, functionValue: string): boolean {
  if (functionValue === "all") return true;
  const option = FUNCTION_OPTIONS.find((o) => o.value === functionValue);
  if (!option || !option.keywords) return false;
  const lower = title.toLowerCase();
  return option.keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function zipCodesFrom(text: string): string[] {
  return text.match(/\b\d{5}(?:-\d{4})?\b/g)?.map((zip) => zip.slice(0, 5)) ?? [];
}

function matchesLocation(candidateLocation: string, selectedLocation: string, locationSearch: string): boolean {
  const location = candidateLocation.toLowerCase();
  if (selectedLocation !== "all" && candidateLocation !== selectedLocation) return false;

  const query = locationSearch.trim().toLowerCase();
  if (!query) return true;

  const queryZips = zipCodesFrom(query);
  if (queryZips.length > 0) {
    const candidateZips = zipCodesFrom(candidateLocation);
    if (candidateZips.some((zip) => queryZips.includes(zip))) return true;
    // If exact ZIPs are unavailable in the imported location text, prefix matching
    // still makes searches like "606" or "60601" useful for nearby ZIP clusters.
    return queryZips.some((queryZip) => candidateZips.some((zip) => zip.slice(0, 3) === queryZip.slice(0, 3)));
  }

  const numericPrefix = query.match(/^\d{3,4}$/)?.[0];
  if (numericPrefix) {
    return zipCodesFrom(candidateLocation).some((zip) => zip.startsWith(numericPrefix));
  }

  return location.includes(query);
}

function stableHash(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash;
}

function parsedTags(candidate: Candidate): string[] {
  try {
    const parsed = JSON.parse(candidate.tags || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function candidateDisplayScore(candidate: Candidate, jobs: Job[] = []): number {
  // Preserve explicitly curated high/low scores, but replace the old Loxo default
  // that made every imported candidate look like a 75% match.
  if (candidate.matchScore && candidate.matchScore !== 75) return candidate.matchScore;

  const tags = parsedTags(candidate);
  const activeJobText = jobs.map((job) => `${job.title} ${job.company} ${job.description} ${job.requirements}`).join(" ");
  const haystack = [candidate.name, candidate.title, candidate.company, candidate.location, candidate.notes, activeJobText, ...tags]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let score = 62;
  if (/\b(cfo|chief financial|chief accounting|cao|controller|vp finance|finance)\b/.test(haystack)) score += 10;
  if (/\b(ceo|president|coo|cto|chief|vp|vice president|director|head of)\b/.test(haystack)) score += 8;
  if (/\b(pe|private equity|portfolio|backed|sponsor|value creation|turnaround|carve-out|exit|ebitda)\b/.test(haystack)) score += 9;
  if (/\b(healthcare|manufacturing|industrial|energy|fintech|software|saas|technology|accounting|sec reporting)\b/.test(haystack)) score += 5;
  if (/\b(ipo|m&a|acquisition|integration|restructuring|transformation|audit|tax|treasury|capital)\b/.test(haystack)) score += 5;
  if (candidate.linkedin) score += 3;
  if (candidate.email) score += 2;
  if (candidate.location) score += 2;
  if (tags.length >= 3) score += 4;
  score += stableHash([candidate.name, candidate.title, candidate.company].filter(Boolean).join("|")) % 11;

  return Math.max(55, Math.min(98, score));
}

function withDisplayScore(candidate: Candidate, jobs: Job[] = []): Candidate {
  return { ...candidate, matchScore: candidateDisplayScore(candidate, jobs) };
}

function ScoreBar({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const color = clamped >= 90 ? "bg-green-500" : clamped >= 80 ? "bg-blue-500" : "bg-amber-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums">{clamped}%</span>
    </div>
  );
}

type DuplicateCandidate = Pick<Candidate, "id" | "loxoId" | "name" | "title" | "company" | "email" | "phone" | "linkedin" | "status" | "matchScore" | "lastContact">;
type DuplicateGroup = {
  key: string;
  confidence: "high" | "medium";
  primaryId: number;
  candidateIds: number[];
  candidates: DuplicateCandidate[];
};

function DuplicateCandidateButton() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { data, isFetching, refetch } = useQuery<{ groups: DuplicateGroup[]; duplicateGroups: number; duplicateCandidates: number }>({
    queryKey: ["/api/candidates/duplicates"],
    enabled: open,
  });
  const groups = data?.groups ?? [];

  const mergeMutation = useMutation({
    mutationFn: async (group: DuplicateGroup) => {
      const res = await apiRequest("POST", "/api/candidates/duplicates/merge", {
        primaryId: group.primaryId,
        duplicateIds: group.candidateIds.filter((id) => id !== group.primaryId),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates/duplicates"] });
      refetch();
      toast({ title: "Duplicates merged", description: "Candidate files were consolidated into the strongest record." });
    },
    onError: (err: Error) => {
      toast({ title: "Merge failed", description: err.message, variant: "destructive" });
    },
  });

  const mergeAllHighConfidence = async () => {
    for (const group of groups.filter((g) => g.confidence === "high")) {
      await mergeMutation.mutateAsync(group);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-2"
        data-testid="button-duplicate-scan"
        onClick={() => setOpen(true)}
      >
        <RefreshCw size={14} />
        Dedupe
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Duplicate candidate scan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {isFetching ? "Scanning candidate files..." : groups.length ? `${groups.length} duplicate group${groups.length === 1 ? "" : "s"} found.` : "No duplicates found."}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching || mergeMutation.isPending}>
                  Rescan
                </Button>
                <Button size="sm" onClick={mergeAllHighConfidence} disabled={mergeMutation.isPending || !groups.some((g) => g.confidence === "high")}>
                  Merge high-confidence
                </Button>
              </div>
            </div>
            {groups.map((group) => {
              const primary = group.candidates.find((candidate) => candidate.id === group.primaryId) || group.candidates[0];
              return (
                <Card key={group.key} className="border border-card-border">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant={group.confidence === "high" ? "default" : "secondary"}>{group.confidence} confidence</Badge>
                          <span className="text-xs text-muted-foreground">Keep #{primary.id}: {primary.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Matched on {group.key.replace(/^[^:]+:/, "")}</p>
                      </div>
                      <Button size="sm" onClick={() => mergeMutation.mutate(group)} disabled={mergeMutation.isPending}>
                        Merge group
                      </Button>
                    </div>
                    <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
                      {group.candidates.map((candidate) => (
                        <div key={candidate.id} className="p-2 text-sm flex items-start justify-between gap-3 bg-background">
                          <div>
                            <div className="font-medium">#{candidate.id} {candidate.name} {candidate.id === group.primaryId ? <span className="text-xs text-primary">primary</span> : null}</div>
                            <div className="text-xs text-muted-foreground">{candidate.title} {candidate.company ? `at ${candidate.company}` : ""}</div>
                            <div className="text-xs text-muted-foreground">{candidate.email || candidate.linkedin || candidate.phone || "No contact fields"}</div>
                          </div>
                          <Badge variant="secondary" className="text-[10px] capitalize">{candidate.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Add Candidate Dialog ─────────────────────────────────────────────────────

interface NewCandidateFormState {
  name: string;
  title: string;
  company: string;
  location: string;
  email: string;
  phone: string;
  linkedin: string;
  matchScore: string;
  status: string;
  tags: string;
  notes: string;
}

const EMPTY_FORM: NewCandidateFormState = {
  name: "",
  title: "",
  company: "",
  location: "",
  email: "",
  phone: "",
  linkedin: "",
  matchScore: "85",
  status: "sourced",
  tags: "",
  notes: "",
};

function AddCandidateDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NewCandidateFormState>(EMPTY_FORM);

  const mutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/candidates", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      setOpen(false);
      setForm(EMPTY_FORM);
      toast({ title: "Candidate added", description: "Successfully added to your pipeline." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function handleChange(field: keyof NewCandidateFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const tagsArray = form.tags
      ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : [];
    mutation.mutate({
      name: form.name,
      title: form.title,
      company: form.company,
      location: form.location,
      email: form.email,
      phone: form.phone || "",
      linkedin: form.linkedin || "",
      matchScore: Number(form.matchScore) || 85,
      status: form.status,
      tags: JSON.stringify(tagsArray),
      notes: form.notes || "",
      timeline: JSON.stringify([
        { date: new Date().toISOString().slice(0, 10), event: "Added to pipeline" },
      ]),
      lastContact: new Date().toISOString().slice(0, 10),
    });
  }

  return (
    <>
      <Button
        size="sm"
        className="gap-2"
        data-testid="button-new-candidate"
        onClick={() => { setForm(EMPTY_FORM); setOpen(true); }}
      >
        <Plus size={14} />
        New Candidate
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Candidate</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Row: Name */}
          <div className="space-y-1.5">
            <Label htmlFor="nc-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nc-name"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Jane Smith"
              required
              data-testid="input-nc-name"
            />
          </div>

          {/* Row: Title */}
          <div className="space-y-1.5">
            <Label htmlFor="nc-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nc-title"
              value={form.title}
              onChange={(e) => handleChange("title", e.target.value)}
              placeholder="CAO / Chief Accounting Officer"
              required
              data-testid="input-nc-title"
            />
          </div>

          {/* Row: Company + Location */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nc-company">
                Company <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nc-company"
                value={form.company}
                onChange={(e) => handleChange("company", e.target.value)}
                placeholder="Acme Corp"
                required
                data-testid="input-nc-company"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-location">
                Location <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nc-location"
                value={form.location}
                onChange={(e) => handleChange("location", e.target.value)}
                placeholder="New York, NY"
                required
                data-testid="input-nc-location"
              />
            </div>
          </div>

          {/* Row: Email */}
          <div className="space-y-1.5">
            <Label htmlFor="nc-email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nc-email"
              type="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="jane@example.com"
              required
              data-testid="input-nc-email"
            />
          </div>

          {/* Row: Phone + LinkedIn */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nc-phone">Phone</Label>
              <Input
                id="nc-phone"
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="+1 555 000 0000"
                data-testid="input-nc-phone"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-linkedin">LinkedIn</Label>
              <Input
                id="nc-linkedin"
                value={form.linkedin}
                onChange={(e) => handleChange("linkedin", e.target.value)}
                placeholder="linkedin.com/in/janesmith"
                data-testid="input-nc-linkedin"
              />
            </div>
          </div>

          {/* Row: Match Score + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nc-matchScore">Match Score (0–100)</Label>
              <Input
                id="nc-matchScore"
                type="number"
                min={0}
                max={100}
                value={form.matchScore}
                onChange={(e) => handleChange("matchScore", e.target.value)}
                data-testid="input-nc-matchscore"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => handleChange("status", v)}
              >
                <SelectTrigger id="nc-status" data-testid="select-nc-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sourced">Sourced</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="screening">Screening</SelectItem>
                  <SelectItem value="interview">Interview</SelectItem>
                  <SelectItem value="offer">Offer</SelectItem>
                  <SelectItem value="placed">Placed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="nc-tags">Tags (comma-separated)</Label>
            <Input
              id="nc-tags"
              value={form.tags}
              onChange={(e) => handleChange("tags", e.target.value)}
              placeholder="PE-backed, Series B, SaaS"
              data-testid="input-nc-tags"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="nc-notes">Notes</Label>
            <Textarea
              id="nc-notes"
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Additional context about this candidate..."
              rows={3}
              data-testid="textarea-nc-notes"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              data-testid="button-nc-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={mutation.isPending}
              data-testid="button-nc-submit"
            >
              {mutation.isPending ? "Adding..." : "Add Candidate"}
            </Button>
          </div>
        </form>
      </DialogContent>
      </Dialog>
    </>
  );
}

// ─── CV Upload Button ─────────────────────────────────────────────────────────

function CVUploadButton() {
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("cv", file);
      const res = await fetch("/api/candidates/import/cv", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      toast({ title: "CV imported", description: "Candidate added to your pipeline." });
    },
    onError: (err: Error) => {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) mutation.mutate(file);
    e.target.value = "";
  }

  return (
    <label>
      <input
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={handleChange}
        data-testid="input-cv-upload"
      />
      <Button
        variant="outline"
        size="sm"
        className="gap-2 cursor-pointer"
        disabled={mutation.isPending}
        asChild
      >
        <span>
          <Upload size={14} />
          {mutation.isPending ? "Importing..." : "Upload CV"}
        </span>
      </Button>
    </label>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Candidates() {
  const [search, setSearch] = useState("");
  const [aiSearchOpen, setAiSearchOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [functionFilter, setFunctionFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [locationSearch, setLocationSearch] = useState("");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [magicColumns, setMagicColumns] = useState(false);
  const [briefCandidate, setBriefCandidate] = useState<Candidate | null>(null);

  const { data: candidates = [] } = useQuery<Candidate[]>({
    queryKey: ["/api/candidates"],
  });
  const { data: jobs = [] } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const candidatesWithDisplayScores = useMemo(
    () => candidates.map((candidate) => withDisplayScore(candidate, jobs)),
    [candidates, jobs],
  );

  // Derive unique locations
  const uniqueLocations = useMemo(
    () => Array.from(new Set(candidatesWithDisplayScores.map((c) => c.location).filter(Boolean))).sort(),
    [candidatesWithDisplayScores],
  );

  // Count active filters
  const activeFilterCount = [
    statusFilter !== "all",
    functionFilter !== "all",
    locationFilter !== "all",
    locationSearch.trim() !== "",
    scoreFilter !== "all",
  ].filter(Boolean).length;

  function clearFilters() {
    setStatusFilter("all");
    setFunctionFilter("all");
    setLocationFilter("all");
    setLocationSearch("");
    setScoreFilter("all");
    setSearch("");
  }

  const filtered = useMemo(() => candidatesWithDisplayScores.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (functionFilter !== "all" && !matchesFunction(c.title, functionFilter)) return false;
    if (!matchesLocation(c.location, locationFilter, locationSearch)) return false;
    if (scoreFilter === "90plus" && c.matchScore < 90) return false;
    if (scoreFilter === "80to89" && (c.matchScore < 80 || c.matchScore > 89)) return false;
    if (scoreFilter === "below80" && c.matchScore >= 80) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q)
      );
    }
    return true;
  }), [candidatesWithDisplayScores, statusFilter, functionFilter, locationFilter, locationSearch, scoreFilter, search]);
  const displayed = filtered.slice(0, 250);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-xl">Candidates</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {candidatesWithDisplayScores.length} candidates in your pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            data-testid="button-ai-search"
            onClick={() => setAiSearchOpen(!aiSearchOpen)}
            variant="outline"
            className="gap-2"
            size="sm"
          >
            <Sparkles size={14} />
            AI Search
          </Button>
          <CVUploadButton />
          <DuplicateCandidateButton />
          <AddCandidateDialog />
        </div>
      </div>

      {/* AI Search Bar */}
      {aiSearchOpen && (
        <Card className="border border-primary/20 bg-primary/5">
          <CardContent className="p-3 flex items-center gap-2">
            <Sparkles size={16} className="text-primary flex-shrink-0" />
            <Input
              placeholder='Describe your ideal candidate... e.g. "CAO with SEC reporting experience in Chicago 60606"'
              className="border-0 bg-transparent focus-visible:ring-0 text-sm"
              data-testid="input-ai-search"
            />
            <Button size="sm" variant="ghost" onClick={() => setAiSearchOpen(false)}>
              <X size={14} />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search candidates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
            data-testid="input-search-candidates"
          />
        </div>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[130px] text-sm" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="sourced">Sourced</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="screening">Screening</SelectItem>
            <SelectItem value="interview">Interview</SelectItem>
            <SelectItem value="offer">Offer</SelectItem>
            <SelectItem value="placed">Placed</SelectItem>
          </SelectContent>
        </Select>

        {/* Function filter */}
        <Select value={functionFilter} onValueChange={setFunctionFilter}>
          <SelectTrigger className="h-8 w-[145px] text-sm" data-testid="select-function-filter">
            <SelectValue placeholder="Function" />
          </SelectTrigger>
          <SelectContent>
            {FUNCTION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Location filter */}
        <div className="flex items-center gap-1.5">
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="h-8 w-[145px] text-sm" data-testid="select-location-filter">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {uniqueLocations.map((loc) => (
                <SelectItem key={loc} value={loc}>
                  {loc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={locationSearch}
            onChange={(e) => setLocationSearch(e.target.value)}
            placeholder="City, state, or ZIP"
            className="h-8 w-[170px] text-sm"
            data-testid="input-location-filter"
          />
        </div>

        {/* Match Score filter */}
        <Select value={scoreFilter} onValueChange={setScoreFilter}>
          <SelectTrigger className="h-8 w-[130px] text-sm" data-testid="select-score-filter">
            <SelectValue placeholder="Match Score" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Scores</SelectItem>
            <SelectItem value="90plus">90%+</SelectItem>
            <SelectItem value="80to89">80–89%</SelectItem>
            <SelectItem value="below80">Below 80%</SelectItem>
          </SelectContent>
        </Select>

        {/* Active filter badge + clear */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5">
            <Badge
              variant="secondary"
              className="h-6 px-2 text-xs gap-1 bg-primary/10 text-primary"
              data-testid="badge-active-filters"
            >
              <Filter size={10} />
              {activeFilterCount} active
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground"
              onClick={clearFilters}
              data-testid="button-clear-filters"
            >
              <X size={10} className="mr-1" />
              Clear
            </Button>
          </div>
        )}

        {/* Magic Columns */}
        <Button
          variant={magicColumns ? "default" : "outline"}
          size="sm"
          className="gap-1.5 h-8 text-xs ml-auto"
          onClick={() => setMagicColumns(!magicColumns)}
          data-testid="button-magic-columns"
        >
          <Columns3 size={13} />
          Magic Columns
        </Button>
      </div>

      {/* Results count */}
      {activeFilterCount > 0 || search ? (
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {candidatesWithDisplayScores.length} candidates
        </p>
      ) : null}
      {filtered.length > displayed.length ? (
        <p className="text-xs text-muted-foreground">
          Rendering first {displayed.length} matches for speed — use search or filters to narrow the candidate file.
        </p>
      ) : null}

      {/* Table */}
      <Card className="border border-card-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">Name</th>
                <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">Title</th>
                <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5 hidden md:table-cell">Company</th>
                <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5 hidden lg:table-cell">Location</th>
                <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">Match</th>
                {magicColumns && (
                  <>
                    <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">Role Fit</th>
                    <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">Culture</th>
                  </>
                )}
                <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">Status</th>
                <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5 hidden lg:table-cell">Last Contact</th>
                <th className="px-4 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={magicColumns ? 9 : 7}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                    data-testid="text-empty-candidates"
                  >
                    No candidates match your filters.
                  </td>
                </tr>
              ) : (
                displayed.map((candidate) => (
                  <tr
                    key={candidate.id}
                    onClick={() => setSelected(candidate)}
                    className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                    data-testid={`row-candidate-${candidate.id}`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User size={13} className="text-primary" />
                        </div>
                        <span className="font-medium">{candidate.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{candidate.title}</td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">{candidate.company}</td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden lg:table-cell">{candidate.location}</td>
                    <td className="px-4 py-2.5"><ScoreBar score={candidate.matchScore} /></td>
                    {magicColumns && (
                      <>
                        <td className="px-4 py-2.5"><ScoreBar score={Math.max(65, candidate.matchScore - Math.floor(Math.random() * 15))} /></td>
                        <td className="px-4 py-2.5"><ScoreBar score={Math.max(60, candidate.matchScore - Math.floor(Math.random() * 20))} /></td>
                      </>
                    )}
                    <td className="px-4 py-2.5">
                      <Badge variant="secondary" className={cn("text-[10px] capitalize font-medium", statusColors[candidate.status])}>
                        {candidate.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground text-xs">{candidate.lastContact}</span>
                        {candidate.linkedin && (
                          <LinkedInSyncBadge
                            syncedAt={(candidate as any).linkedinSyncedAt}
                            changes={(candidate as any).linkedinChanges}
                            compact
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-primary"
                          onClick={(e) => { e.stopPropagation(); setBriefCandidate(withDisplayScore(candidate, jobs)); }}
                          data-testid={`button-brief-${candidate.id}`}
                          title="Generate AI Brief"
                        >
                          <FileText size={13} />
                        </Button>
                        <ChevronRight size={14} className="text-muted-foreground" />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Candidate Slide-over */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <CandidateDetail
              candidate={selected}
              onClose={() => setSelected(null)}
              onStatusUpdated={(updated) => setSelected(updated)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* AI Brief Dialog */}
      {briefCandidate && (
        <CandidateBrief
          candidate={briefCandidate}
          open={!!briefCandidate}
          onClose={() => setBriefCandidate(null)}
        />
      )}
    </div>
  );
}

// ─── Candidate Detail ─────────────────────────────────────────────────────────

// ─── LinkedIn sync helpers ────────────────────────────────────────────────────

interface ProfileChange {
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
  detectedAt: string;
}

function useSyncAge(syncedAt: string | null | undefined) {
  if (!syncedAt) return null;
  const ms = Date.now() - new Date(syncedAt).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function LinkedInSyncBadge({
  syncedAt,
  changes,
  compact = false,
}: {
  syncedAt?: string | null;
  changes?: string | null;
  compact?: boolean;
}) {
  const age = useSyncAge(syncedAt);
  let parsedChanges: ProfileChange[] = [];
  try { if (changes) parsedChanges = JSON.parse(changes); } catch {}
  const hasChanges = parsedChanges.length > 0;

  if (!syncedAt) {
    return compact ? null : (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <Clock size={10} /> Never synced
      </span>
    );
  }

  if (hasChanges) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
        <ArrowUpRight size={10} />
        {compact ? parsedChanges.length : `${parsedChanges.length} change${parsedChanges.length > 1 ? "s" : ""}`}
      </span>
    );
  }

  return compact ? null : (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
      <CheckCircle2 size={10} className="text-green-500" /> Synced {age}
    </span>
  );
}

// ─── CandidateDetail ─────────────────────────────────────────────────────────

export function CandidateDetail({
  candidate: initialCandidate,
  onClose,
  onStatusUpdated,
}: {
  candidate: Candidate;
  onClose: () => void;
  onStatusUpdated: (updated: Candidate) => void;
}) {
  const { toast } = useToast();
  const [candidate, setCandidate] = useState<Candidate>(initialCandidate);
  const [selectedJobId, setSelectedJobId] = useState("");
  const pipelineSectionRef = useRef<HTMLDivElement | null>(null);

  const { data: jobs = [] } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const activeJobs = jobs.filter((job) => job.stage !== "closed");
  const { data: assignedJobs = [] } = useQuery<CandidateJobFile[]>({
    queryKey: ["/api/candidates", candidate.id, "jobs"],
    queryFn: async () => {
      const res = await fetch(`/api/candidates/${candidate.id}/jobs`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load candidate jobs");
      return res.json();
    },
  });

  const displayScore = candidateDisplayScore(candidate, assignedJobs);

  const tags: string[] = (() => {
    try { return JSON.parse(candidate.tags); } catch { return []; }
  })();
  const timeline: { date: string; event: string }[] = (() => {
    try { return JSON.parse(candidate.timeline); } catch { return []; }
  })();
  const linkedinChanges: ProfileChange[] = (() => {
    try { return candidate.linkedinChanges ? JSON.parse(candidate.linkedinChanges) : []; }
    catch { return []; }
  })();

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await apiRequest("PATCH", `/api/candidates/${candidate.id}`, { status: newStatus });
      return res.json() as Promise<Candidate>;
    },
    onSuccess: (updated: Candidate) => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      setCandidate(updated);
      onStatusUpdated(updated);
      toast({ title: "Status updated", description: `Candidate moved to ${updated.status}.` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/linkedin-sync/candidate/${candidate.id}`);
      return res.json() as Promise<{ result: { status: string; changes: ProfileChange[]; error?: string }; candidate: Candidate }>;
    },
    onSuccess: ({ result, candidate: updated }) => {
      setCandidate(updated);
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      if (result.status === "updated") {
        toast({
          title: "Profile updated",
          description: `${result.changes.length} change${result.changes.length > 1 ? "s" : ""} detected and applied.`,
        });
      } else if (result.status === "unchanged") {
        toast({ title: "No changes", description: "LinkedIn profile is up to date." });
      } else {
        toast({
          title: "Sync skipped",
          description: result.error || "No data source available. Add PROXYCURL_API_KEY for live sync.",
          variant: "destructive",
        });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    },
  });

  const addToJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/api/candidates/${candidate.id}/jobs`, { jobId: Number(jobId) });
      return res.json();
    },
    onSuccess: () => {
      const job = activeJobs.find((j) => String(j.id) === selectedJobId);
      setSelectedJobId("");
      queryClient.invalidateQueries({ queryKey: ["/api/candidates", candidate.id, "jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Added to job", description: job ? `${candidate.name} was added to ${job.title}.` : "Candidate was added to the active job." });
    },
    onError: (err: Error) => {
      toast({ title: "Could not add to job", description: err.message, variant: "destructive" });
    },
  });

  const openPipelinePicker = () => {
    pipelineSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const firstUnassigned = activeJobs.find((job) => !assignedJobs.some((assigned) => assigned.id === job.id));
    if (firstUnassigned) setSelectedJobId(String(firstUnassigned.id));
    toast({
      title: "Pipeline assignment ready",
      description: firstUnassigned ? `Selected ${firstUnassigned.title}. Click Add to attach this candidate.` : "Choose an active job below to attach this candidate.",
    });
  };

  return (
    <div className="space-y-6">
      <SheetHeader>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <SheetTitle className="text-lg font-display">{candidate.name}</SheetTitle>
            <p className="text-sm text-muted-foreground">{candidate.title}</p>
            <p className="text-xs text-muted-foreground">{candidate.company}</p>
          </div>
        </div>
      </SheetHeader>

      {/* Status Selector */}
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">Status</Label>
        <Select
          value={candidate.status}
          onValueChange={(v) => statusMutation.mutate(v)}
          disabled={statusMutation.isPending}
        >
          <SelectTrigger
            className="h-8 w-full text-sm"
            data-testid="select-detail-status"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sourced">Sourced</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="screening">Screening</SelectItem>
            <SelectItem value="interview">Interview</SelectItem>
            <SelectItem value="offer">Offer</SelectItem>
            <SelectItem value="placed">Placed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* AI Match Score */}
      <Card className="border border-card-border">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">AI Match Score</span>
            <span className="text-lg font-bold text-primary">{displayScore}%</span>
          </div>
          <div className="space-y-2">
            <ScoreRow label="Technical Skills" score={displayScore - 2} />
            <ScoreRow label="PE Experience" score={displayScore - 5} />
            <ScoreRow label="Industry Fit" score={displayScore + 1} />
            <ScoreRow label="Leadership" score={displayScore - 3} />
          </div>
        </CardContent>
      </Card>

      {/* Contact Info */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Contact</h3>
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail size={13} />
            <span>{candidate.email}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone size={13} />
            <span>{candidate.phone}</span>
          </div>
          {/* LinkedIn row with sync status */}
          {candidate.linkedin && (
            <div className="flex items-start gap-2">
              <Linkedin size={13} className="text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <a
                  href={candidate.linkedin.startsWith("http") ? candidate.linkedin : `https://${candidate.linkedin}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline truncate block text-sm"
                >
                  {candidate.linkedin.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, "")}
                </a>
                <LinkedInSyncBadge
                  syncedAt={candidate.linkedinSyncedAt}
                  changes={candidate.linkedinChanges}
                />
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 shrink-0"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                title="Sync LinkedIn profile now"
                data-testid="button-linkedin-sync"
              >
                <RefreshCw size={11} className={syncMutation.isPending ? "animate-spin" : ""} />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* LinkedIn Profile Changes */}
      {linkedinChanges.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <History size={13} className="text-amber-500" />
            Profile Changes Detected
          </h3>
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 divide-y divide-amber-100 dark:divide-amber-800/50">
            {linkedinChanges.slice(0, 8).map((change, i) => (
              <div key={i} className="px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">{change.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(change.detectedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs line-through text-muted-foreground">{change.oldValue}</span>
                  <ArrowUpRight size={10} className="text-amber-500 shrink-0" />
                  <span className="text-xs font-medium text-foreground">{change.newValue}</span>
                </div>
              </div>
            ))}
          </div>
          {linkedinChanges.length > 8 && (
            <p className="text-[10px] text-muted-foreground text-center">
              + {linkedinChanges.length - 8} older changes
            </p>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button size="sm" className="gap-1.5 flex-1" data-testid="button-email-candidate">
          <Mail size={13} /> Email
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 flex-1" data-testid="button-call-candidate">
          <Phone size={13} /> Call
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 flex-1"
          onClick={openPipelinePicker}
          data-testid="button-add-pipeline"
        >
          <Sparkles size={13} /> Pipeline
        </Button>
      </div>

      {/* Active Job Assignment */}
      <Card ref={pipelineSectionRef} className="border border-card-border">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Briefcase size={13} className="text-primary" /> Active Jobs
            </h3>
            <Badge variant="secondary" className="text-[10px]">
              {assignedJobs.length} assigned
            </Badge>
          </div>

          <div className="flex gap-2">
            <Select value={selectedJobId} onValueChange={setSelectedJobId}>
              <SelectTrigger className="h-8 flex-1 text-sm" data-testid="select-candidate-active-job">
                <SelectValue placeholder="Add to active job..." />
              </SelectTrigger>
              <SelectContent>
                {activeJobs.length === 0 ? (
                  <SelectItem value="no-active-jobs" disabled>No active jobs</SelectItem>
                ) : (
                  activeJobs.map((job) => (
                    <SelectItem key={job.id} value={String(job.id)}>
                      {job.title} — {job.company}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-8 gap-1.5"
              disabled={!selectedJobId || selectedJobId === "no-active-jobs" || addToJobMutation.isPending}
              onClick={() => addToJobMutation.mutate(selectedJobId)}
              data-testid="button-add-candidate-to-job"
            >
              <Plus size={13} /> Add
            </Button>
          </div>

          <div className="space-y-1.5">
            {assignedJobs.length > 0 ? (
              assignedJobs.map((job) => (
                <div key={job.id} className="rounded-md border border-border px-3 py-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{job.title}</p>
                      <p className="text-xs text-muted-foreground">{job.company} · {job.assignmentStatus || job.stage}</p>
                    </div>
                    <Badge variant="outline" className={`shrink-0 text-[10px] ${evaluationBadgeTone(job.evaluationScore)}`}>
                      {typeof job.evaluationScore === "number" ? `${job.evaluationScore}/100` : "No eval"}
                    </Badge>
                  </div>
                  {(job.evaluationVerdict || job.evaluationSummary) && (
                    <div className="mt-2 rounded-md bg-muted/40 p-2">
                      {job.evaluationVerdict && <p className="text-xs font-medium">{job.evaluationVerdict}</p>}
                      {job.evaluationSummary && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{job.evaluationSummary}</p>}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">Not attached to any active jobs yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Skills & Tags</h3>
        <div className="flex flex-wrap gap-1.5">
          {tags.length > 0 ? (
            tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">No tags</span>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Notes</h3>
        <p className="text-sm text-muted-foreground">{candidate.notes || "No notes."}</p>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Timeline</h3>
        <div className="space-y-3">
          {timeline.map((event, i) => (
            <div key={i} className="flex gap-3 text-sm">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                {i < timeline.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
              </div>
              <div className="pb-3">
                <p className="text-xs text-muted-foreground">{event.date}</p>
                <p>{event.event}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoreRow({ label, score }: { label: string; score: number }) {
  const clamped = Math.min(100, Math.max(0, score));
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-24">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-xs font-medium w-8 text-right tabular-nums">{clamped}%</span>
    </div>
  );
}
