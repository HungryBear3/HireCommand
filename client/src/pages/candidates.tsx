import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Candidate } from "@shared/schema";
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
  DialogTrigger,
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

const FUNCTION_OPTIONS = [
  { label: "All Functions", value: "all" },
  { label: "CFO / Finance", value: "CFO / Finance", keywords: ["CFO", "VP Finance", "Finance", "Chief Financial"] },
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

function ScoreBar({ score }: { score: number }) {
  const color = score >= 90 ? "bg-green-500" : score >= 80 ? "bg-blue-500" : "bg-amber-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums">{score}%</span>
    </div>
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2" data-testid="button-new-candidate">
          <Plus size={14} />
          New Candidate
        </Button>
      </DialogTrigger>
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
              placeholder="VP Finance"
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
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Candidates() {
  const [search, setSearch] = useState("");
  const [aiSearchOpen, setAiSearchOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [functionFilter, setFunctionFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [magicColumns, setMagicColumns] = useState(false);
  const [briefCandidate, setBriefCandidate] = useState<Candidate | null>(null);

  const { data: candidates = [] } = useQuery<Candidate[]>({
    queryKey: ["/api/candidates"],
  });

  // Derive unique locations
  const uniqueLocations = Array.from(
    new Set(candidates.map((c) => c.location).filter(Boolean))
  ).sort();

  // Count active filters
  const activeFilterCount = [
    statusFilter !== "all",
    functionFilter !== "all",
    locationFilter !== "all",
    scoreFilter !== "all",
  ].filter(Boolean).length;

  function clearFilters() {
    setStatusFilter("all");
    setFunctionFilter("all");
    setLocationFilter("all");
    setScoreFilter("all");
    setSearch("");
  }

  const filtered = candidates.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (functionFilter !== "all" && !matchesFunction(c.title, functionFilter)) return false;
    if (locationFilter !== "all" && c.location !== locationFilter) return false;
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
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-xl">Candidates</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {candidates.length} candidates in your pipeline
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
          <AddCandidateDialog />
        </div>
      </div>

      {/* AI Search Bar */}
      {aiSearchOpen && (
        <Card className="border border-primary/20 bg-primary/5">
          <CardContent className="p-3 flex items-center gap-2">
            <Sparkles size={16} className="text-primary flex-shrink-0" />
            <Input
              placeholder='Describe your ideal candidate... e.g. "CTO with platform scaling experience" or "CFO with PE exit in healthcare"'
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
          Showing {filtered.length} of {candidates.length} candidates
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
                filtered.map((candidate) => (
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
                    <td className="px-4 py-2.5 text-muted-foreground text-xs hidden lg:table-cell">{candidate.lastContact}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-primary"
                          onClick={(e) => { e.stopPropagation(); setBriefCandidate(candidate); }}
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

function CandidateDetail({
  candidate,
  onClose,
  onStatusUpdated,
}: {
  candidate: Candidate;
  onClose: () => void;
  onStatusUpdated: (updated: Candidate) => void;
}) {
  const { toast } = useToast();
  const tags: string[] = (() => {
    try { return JSON.parse(candidate.tags); } catch { return []; }
  })();
  const timeline: { date: string; event: string }[] = (() => {
    try { return JSON.parse(candidate.timeline); } catch { return []; }
  })();

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await apiRequest("PATCH", `/api/candidates/${candidate.id}`, { status: newStatus });
      return res.json() as Promise<Candidate>;
    },
    onSuccess: (updated: Candidate) => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      onStatusUpdated(updated);
      toast({ title: "Status updated", description: `Candidate moved to ${updated.status}.` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

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
            <span className="text-lg font-bold text-primary">{candidate.matchScore}%</span>
          </div>
          <div className="space-y-2">
            <ScoreRow label="Technical Skills" score={candidate.matchScore - 2} />
            <ScoreRow label="PE Experience" score={candidate.matchScore - 5} />
            <ScoreRow label="Industry Fit" score={candidate.matchScore + 1} />
            <ScoreRow label="Leadership" score={candidate.matchScore - 3} />
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
          <div className="flex items-center gap-2 text-muted-foreground">
            <Linkedin size={13} />
            <span>{candidate.linkedin}</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button size="sm" className="gap-1.5 flex-1" data-testid="button-email-candidate">
          <Mail size={13} /> Email
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 flex-1" data-testid="button-call-candidate">
          <Phone size={13} /> Call
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 flex-1" data-testid="button-add-pipeline">
          <Sparkles size={13} /> Pipeline
        </Button>
      </div>

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
