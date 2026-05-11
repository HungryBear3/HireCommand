import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Candidate, Invoice, Job } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MapPin, Users, Clock, DollarSign, Briefcase, ChevronRight, Plus, Pencil, Trash2, Loader2, Archive, RotateCcw, CheckSquare, FileText } from "lucide-react";

const ACTIVE_STAGES = [
  { key: "intake",     label: "Intake",     color: "bg-slate-400" },
  { key: "sourcing",   label: "Sourcing",   color: "bg-blue-500" },
  { key: "screening",  label: "Screening",  color: "bg-cyan-500" },
  { key: "interview",  label: "Interview",  color: "bg-amber-500" },
  { key: "offer",      label: "Offer",      color: "bg-purple-500" },
  { key: "placed",     label: "Placed",     color: "bg-green-500" },
];

const CLOSED_STAGE = { key: "closed", label: "Closed", color: "bg-zinc-500" };
const STAGES = [...ACTIVE_STAGES, CLOSED_STAGE];
const CANDIDATE_PIPELINE_STAGES = [
  { key: "sourced", label: "Sourced", color: "border-slate-300 bg-slate-50 dark:bg-slate-900/30" },
  { key: "contacted", label: "Contacted", color: "border-blue-300 bg-blue-50 dark:bg-blue-950/30" },
  { key: "screening", label: "Screening", color: "border-cyan-300 bg-cyan-50 dark:bg-cyan-950/30" },
  { key: "interview", label: "Interview", color: "border-amber-300 bg-amber-50 dark:bg-amber-950/30" },
  { key: "offer", label: "Offer", color: "border-purple-300 bg-purple-50 dark:bg-purple-950/30" },
  { key: "placed", label: "Placed", color: "border-green-300 bg-green-50 dark:bg-green-950/30" },
];

type JobCandidate = Candidate & { assignmentStatus?: string; assignmentNotes?: string };

function candidateStage(candidate: JobCandidate) {
  const raw = candidate.assignmentStatus || candidate.status || "sourced";
  return raw === "submitted" ? "sourced" : raw;
}

interface JobForm {
  title: string; company: string; location: string;
  stage: string; feePotential: string; daysOpen: string; description: string; requirements: string;
}
const EMPTY: JobForm = { title: "", company: "", location: "", stage: "intake", feePotential: "", daysOpen: "0", description: "", requirements: "" };

function jobToForm(job: Job): JobForm {
  let reqs: string[] = [];
  try { reqs = JSON.parse(job.requirements); } catch {}
  return { title: job.title, company: job.company, location: job.location, stage: job.stage, feePotential: job.feePotential, daysOpen: String(job.daysOpen ?? 0), description: job.description, requirements: reqs.join("\n") };
}

function formToPayload(form: JobForm, existing?: Job) {
  const reqs = form.requirements.split("\n").map(r => r.trim()).filter(Boolean);
  const parsedDaysOpen = Math.max(0, Math.floor(Number(form.daysOpen) || 0));
  return {
    title: form.title,
    company: form.company,
    location: form.location || "",
    stage: form.stage,
    feePotential: form.feePotential || "",
    description: form.description || "",
    requirements: JSON.stringify(reqs),
    candidateCount: existing?.candidateCount ?? 0,
    daysOpen: parsedDaysOpen,
  };
}

type ApiClientContact = {
  id: number;
  name: string;
  company: string;
  email?: string;
  location?: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function parseCurrency(value?: string | number | null) {
  if (typeof value === "number") return value;
  const parsed = parseFloat(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function nextInvoiceNumber(invoices: Invoice[]) {
  const year = new Date().getFullYear();
  const max = invoices.reduce((highest, invoice) => {
    const match = invoice.invoiceNumber?.match(/(\d+)$/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `INV-${year}-${String(max + 1).padStart(4, "0")}`;
}

function JobFormDialog({ trigger, initial, existing, jobId, onDone, dialogTitle }: {
  trigger: React.ReactNode;
  initial?: Partial<JobForm>;
  existing?: Job;
  jobId?: number;
  onDone: () => void;
  dialogTitle: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<JobForm>({ ...EMPTY, ...initial });
  const set = (k: keyof JobForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: async () => {
      if (!form.title || !form.company) throw new Error("Title and company are required");
      const payload = formToPayload(form, existing);
      const r = jobId
        ? await apiRequest("PATCH", `/api/jobs/${jobId}`, payload)
        : await apiRequest("POST", "/api/jobs", payload);
      return r.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      const matchCount = Array.isArray(data?.aiMatches) ? data.aiMatches.length : 0;
      toast({
        title: jobId ? "Job updated" : "Job created",
        description: !jobId ? `AI sourced ${matchCount} matching candidate${matchCount === 1 ? "" : "s"} from the database.` : undefined,
      });
      setOpen(false);
      onDone();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openDialog = () => {
    setForm({ ...EMPTY, ...initial });
    setOpen(true);
  };

  return (
    <>
      <span onClick={openDialog} style={{ display: "contents" }}>{trigger}</span>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{dialogTitle}</DialogTitle></DialogHeader>
        <form onSubmit={e => { e.preventDefault(); mut.mutate(); }} className="space-y-4 mt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Job Title *</Label>
              <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Chief Accounting Officer" className="h-9 text-sm" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Company *</Label>
              <Input value={form.company} onChange={e => set("company", e.target.value)} placeholder="Acme Corp" className="h-9 text-sm" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Location</Label>
              <Input value={form.location} onChange={e => set("location", e.target.value)} placeholder="Chicago, IL 60606" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fee Potential</Label>
              <Input value={form.feePotential} onChange={e => set("feePotential", e.target.value)} placeholder="$125,000" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Days Open</Label>
              <Input type="number" min="0" value={form.daysOpen} onChange={e => set("daysOpen", e.target.value)} placeholder="0" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Stage</Label>
              <select value={form.stage} onChange={e => set("stage", e.target.value)} className="w-full h-9 text-sm rounded-md border border-input bg-background px-3">
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Description</Label>
              <textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Role overview, responsibilities..." className="w-full h-24 text-sm rounded-md border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Requirements (one per line)</Label>
              <textarea value={form.requirements} onChange={e => set("requirements", e.target.value)} placeholder={"10+ years executive leadership\nPE-backed experience\nIPO or M&A track record"} className="w-full h-20 text-sm font-mono rounded-md border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={mut.isPending}>
              {mut.isPending ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
              {mut.isPending ? "Saving…" : "Save Job"}
            </Button>
          </div>
        </form>
      </DialogContent>
      </Dialog>
    </>
  );
}

function PlacementInvoiceDialog({ job, open, onClose }: { job: Job | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: jobCandidates = [] } = useQuery<Candidate[]>({
    queryKey: ["/api/jobs", job?.id, "candidates"],
    queryFn: async () => {
      if (!job) return [];
      const r = await apiRequest("GET", `/api/jobs/${job.id}/candidates`);
      return r.json();
    },
    enabled: open && !!job,
  });
  const { data: allCandidates = [] } = useQuery<Candidate[]>({ queryKey: ["/api/candidates"], enabled: open });
  const { data: clients = [] } = useQuery<ApiClientContact[]>({ queryKey: ["/api/clients"], enabled: open });
  const { data: invoices = [] } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"], enabled: open });

  const candidateOptions = jobCandidates.length ? jobCandidates : allCandidates;
  const [candidateId, setCandidateId] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [salary, setSalary] = useState("");
  const [feePercent, setFeePercent] = useState("25");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState(addDays(today(), 30));
  const [terms, setTerms] = useState("Net 30");
  const [leadRecruiter, setLeadRecruiter] = useState("Andrew");
  const [notes, setNotes] = useState("");

  const matchingClient = useMemo(() => {
    const company = job?.company?.toLowerCase().trim();
    if (!company) return undefined;
    return clients.find((client) => client.company?.toLowerCase().trim() === company || client.name?.toLowerCase().trim() === company);
  }, [clients, job?.company]);

  useEffect(() => {
    if (!open || !job) return;
    const firstCandidate = jobCandidates[0];
    setCandidateId(firstCandidate ? String(firstCandidate.id) : "");
    setCandidateName(firstCandidate?.name || "");
    setClientName(job.company || "");
    setClientEmail(matchingClient?.email || "");
    setClientAddress(matchingClient?.location || job.location || "");
    setSalary("");
    setFeePercent("25");
    setInvoiceNumber(nextInvoiceNumber(invoices));
    setIssueDate(today());
    setDueDate(addDays(today(), 30));
    setTerms("Net 30");
    setLeadRecruiter("Andrew");
    setNotes(`Placement invoice for ${job.title} at ${job.company}.`);
  }, [open, job, jobCandidates, matchingClient, invoices]);

  const feeAmount = Math.round((parseCurrency(salary) * (parseFloat(feePercent) || 0)) / 100);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!job) throw new Error("No job selected");
      if (!clientName.trim()) throw new Error("Client name is required");
      if (!candidateName.trim()) throw new Error("Candidate name is required");
      if (feeAmount <= 0) throw new Error("Salary and fee percent must produce an invoice amount");
      const now = new Date().toISOString();
      const selectedCandidateId = candidateId ? Number(candidateId) : null;

      const placementPayload = {
        jobTitle: job.title,
        company: job.company,
        clientName: clientName.trim(),
        candidateName: candidateName.trim(),
        candidateId: selectedCandidateId,
        salary: parseCurrency(salary),
        feePercent: parseFloat(feePercent) || 0,
        feeAmount,
        invoiceStatus: "pending",
        placedDate: issueDate,
        startDate: "",
        guaranteeDays: 90,
        notes: notes.trim(),
        leadRecruiter,
      };
      const placementRes = await apiRequest("POST", "/api/placements", placementPayload);
      const placement = await placementRes.json();

      const invoicePayload = {
        invoiceNumber: invoiceNumber.trim() || nextInvoiceNumber(invoices),
        status: "draft",
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim(),
        clientAddress: clientAddress.trim(),
        candidateName: candidateName.trim(),
        jobTitle: job.title,
        salary: parseCurrency(salary),
        feePercent: parseFloat(feePercent) || 0,
        subtotal: feeAmount,
        taxPercent: 0,
        taxAmount: 0,
        total: feeAmount,
        amountPaid: 0,
        amountDue: feeAmount,
        lineItems: JSON.stringify([{ description: `Executive Search Fee — ${job.title}`, quantity: 1, unitPrice: feeAmount, amount: feeAmount }]),
        issueDate,
        dueDate,
        notes: notes.trim(),
        terms,
        placementId: placement.id,
        createdAt: now,
        updatedAt: now,
      };
      const invoiceRes = await apiRequest("POST", "/api/invoices", invoicePayload);
      const invoice = await invoiceRes.json();

      await Promise.all([
        apiRequest("PATCH", `/api/jobs/${job.id}`, { stage: "placed" }),
        selectedCandidateId ? apiRequest("PATCH", `/api/candidates/${selectedCandidateId}`, { status: "placed" }) : Promise.resolve(),
      ]);

      return invoice;
    },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/placements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Placement invoice created", description: `${invoice.invoiceNumber} is now in the Invoices tab.` });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Invoice setup failed", description: e.message, variant: "destructive" }),
  });

  if (!job) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create placement invoice</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="rounded-lg border border-card-border bg-muted/30 p-3 text-sm">
            <p className="font-medium">{job.title}</p>
            <p className="text-muted-foreground">{job.company}{job.location ? ` · ${job.location}` : ""}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Placed Candidate *</Label>
              <select
                value={candidateId}
                onChange={(e) => {
                  const id = e.target.value;
                  setCandidateId(id);
                  const candidate = candidateOptions.find((c) => String(c.id) === id);
                  setCandidateName(candidate?.name || "");
                }}
                className="w-full h-9 text-sm rounded-md border border-input bg-background px-3"
              >
                <option value="">Manual entry</option>
                {candidateOptions.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} — {candidate.title || candidate.company}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Candidate Name *</Label>
              <Input value={candidateName} onChange={(e) => setCandidateName(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Client Name *</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Client Email</Label>
              <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Client Address</Label>
              <Input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Salary *</Label>
              <Input value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="175000" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fee % *</Label>
              <Input value={feePercent} onChange={(e) => setFeePercent(e.target.value)} placeholder="25" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Invoice #</Label>
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Lead Recruiter</Label>
              <select value={leadRecruiter} onChange={(e) => setLeadRecruiter(e.target.value)} className="w-full h-9 text-sm rounded-md border border-input bg-background px-3">
                {['Andrew', 'Ryan', 'Aileen'].map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Issue / Placed Date</Label>
              <Input type="date" value={issueDate} onChange={(e) => { setIssueDate(e.target.value); setDueDate(addDays(e.target.value, 30)); }} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Notes</Label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full h-20 text-sm rounded-md border border-input bg-background px-3 py-2 resize-none" />
            </div>
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Draft invoice total</p>
              <p className="text-xs text-muted-foreground">Creates a placement record, marks the job/candidate placed, and saves a draft invoice.</p>
            </div>
            <p className="text-xl font-bold">${feeAmount.toLocaleString()}</p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="button" size="sm" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? <Loader2 size={13} className="animate-spin mr-1" /> : <FileText size={13} className="mr-1" />}
              Create Invoice
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Jobs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<number[]>([]);
  const [bulkStage, setBulkStage] = useState("");
  const [placementInvoiceJob, setPlacementInvoiceJob] = useState<Job | null>(null);
  const [candidateToAddId, setCandidateToAddId] = useState("");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [draggedCandidate, setDraggedCandidate] = useState<{ candidateId: number; stage: string } | null>(null);

  const { data: jobs = [], isLoading } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: candidates = [] } = useQuery<Candidate[]>({ queryKey: ["/api/candidates"] });
  const { data: selectedJobCandidates = [] } = useQuery<JobCandidate[]>({
    queryKey: ["/api/jobs", selectedJob?.id, "candidates"],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${selectedJob!.id}/candidates`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load job candidates");
      return res.json();
    },
    enabled: !!selectedJob,
  });
  const activeJobs = jobs.filter(job => job.stage !== "closed");
  const closedJobs = jobs.filter(job => job.stage === "closed");
  const selectedActiveJobs = activeJobs.filter(job => selectedJobIds.includes(job.id));
  const addableCandidates = candidates.filter(candidate => !selectedJobCandidates.some(assigned => assigned.id === candidate.id));
  const filteredAddableCandidates = addableCandidates.filter(candidate => {
    const q = candidateSearch.trim().toLowerCase();
    if (!q) return true;
    return [candidate.name, candidate.title, candidate.company, candidate.email, candidate.location]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
  const selectedJobCandidatesByStage = CANDIDATE_PIPELINE_STAGES.map(stage => ({
    ...stage,
    candidates: selectedJobCandidates.filter(candidate => candidateStage(candidate) === stage.key),
  }));

  const toggleJobSelection = (jobId: number) => {
    setSelectedJobIds(ids => ids.includes(jobId) ? ids.filter(id => id !== jobId) : [...ids, jobId]);
  };

  const clearSelection = () => {
    setSelectedJobIds([]);
    setSelectionMode(false);
  };

  const toggleStageSelection = (stageJobs: Job[]) => {
    setSelectionMode(true);
    const stageIds = stageJobs.map(job => job.id);
    const allStageSelected = stageIds.length > 0 && stageIds.every(id => selectedJobIds.includes(id));
    setSelectedJobIds(ids => allStageSelected
      ? ids.filter(id => !stageIds.includes(id))
      : Array.from(new Set([...ids, ...stageIds]))
    );
  };

  const handleJobCardClick = (job: Job) => {
    if (selectionMode || selectedJobIds.length > 0) {
      toggleJobSelection(job.id);
      return;
    }
    setCandidateToAddId("");
    setCandidateSearch("");
    setSelectedJob(job);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/jobs/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setSelectedJob(null);
      toast({ title: "Job deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const stageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: number; stage: string }) => {
      const r = await apiRequest("PATCH", `/api/jobs/${id}`, { stage });
      return r.json();
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setSelectedJob(updated);
      toast({ title: updated.stage === "closed" ? "Job closed" : "Job updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleStageChange = (job: Job, stage: string) => {
    if (stage === "placed" && job.stage !== "placed") {
      setPlacementInvoiceJob(job);
      return;
    }
    stageMutation.mutate({ id: job.id, stage });
  };

  const bulkStageMutation = useMutation({
    mutationFn: async ({ ids, stage }: { ids: number[]; stage: string }) => {
      await Promise.all(ids.map(id => apiRequest("PATCH", `/api/jobs/${id}`, { stage })));
    },
    onSuccess: (_data, vars) => {
      const count = vars.ids.length;
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setSelectedJob(null);
      setBulkStage("");
      clearSelection();
      const label = STAGES.find(s => s.key === vars.stage)?.label ?? vars.stage;
      toast({ title: `${count} job${count === 1 ? "" : "s"} moved to ${label}` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const bulkCloseMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map(id => apiRequest("PATCH", `/api/jobs/${id}`, { stage: "closed" })));
    },
    onSuccess: () => {
      const count = selectedActiveJobs.length;
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setSelectedJob(null);
      clearSelection();
      toast({ title: `${count} job${count === 1 ? "" : "s"} closed` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addCandidateMutation = useMutation({
    mutationFn: async ({ candidateId, jobId }: { candidateId: number; jobId: number }) => {
      const res = await apiRequest("POST", `/api/candidates/${candidateId}/jobs`, { jobId });
      return res.json();
    },
    onSuccess: () => {
      const candidate = candidates.find(c => String(c.id) === candidateToAddId);
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", selectedJob?.id, "candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      if (selectedJob) setSelectedJob({ ...selectedJob, candidateCount: selectedJob.candidateCount + 1 });
      setCandidateToAddId("");
      setCandidateSearch("");
      toast({ title: "Candidate added", description: candidate && selectedJob ? `${candidate.name} was added to ${selectedJob.title}.` : "Candidate was added to the job." });
    },
    onError: (e: Error) => toast({ title: "Could not add candidate", description: e.message, variant: "destructive" }),
  });

  const updateCandidateStageMutation = useMutation({
    mutationFn: async ({ candidateId, jobId, status }: { candidateId: number; jobId: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/jobs/${jobId}/candidates/${candidateId}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", selectedJob?.id, "candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      toast({ title: "Candidate stage updated" });
    },
    onError: (e: Error) => toast({ title: "Could not update stage", description: e.message, variant: "destructive" }),
  });

  const moveCandidateToStage = (candidate: JobCandidate, status: string) => {
    if (!selectedJob || candidateStage(candidate) === status) return;
    updateCandidateStageMutation.mutate({ candidateId: candidate.id, jobId: selectedJob.id, status });
  };

  const handleCandidateDrop = (status: string) => {
    if (!selectedJob || !draggedCandidate || draggedCandidate.stage === status) {
      setDraggedCandidate(null);
      return;
    }
    updateCandidateStageMutation.mutate({
      candidateId: draggedCandidate.candidateId,
      jobId: selectedJob.id,
      status,
    });
    setDraggedCandidate(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-xl">Jobs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeJobs.length} active search{activeJobs.length !== 1 ? "es" : ""}
            {closedJobs.length > 0 ? ` · ${closedJobs.length} closed` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeJobs.length > 0 && (
            <Button
              size="sm"
              variant={selectionMode || selectedActiveJobs.length > 0 ? "default" : "outline"}
              className="gap-1.5"
              onClick={() => {
                setSelectionMode(v => !v);
                if (selectionMode) setSelectedJobIds([]);
              }}
            >
              <CheckSquare size={14} /> {selectionMode || selectedActiveJobs.length > 0 ? "Selecting" : "Select Jobs"}
            </Button>
          )}
          {(selectionMode || selectedActiveJobs.length > 0) && (
            <>
              <span className="text-xs text-muted-foreground hidden md:inline">Use each stage header to select only that stage.</span>
              {selectedActiveJobs.length > 0 && (
                <>
                  <select
                    value={bulkStage}
                    onChange={(e) => {
                      const stage = e.target.value;
                      setBulkStage(stage);
                      if (stage && confirm(`Move ${selectedActiveJobs.length} selected job${selectedActiveJobs.length === 1 ? "" : "s"} to ${STAGES.find(s => s.key === stage)?.label ?? stage}?`)) {
                        bulkStageMutation.mutate({ ids: selectedActiveJobs.map(job => job.id), stage });
                      }
                    }}
                    disabled={bulkStageMutation.isPending}
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="">Move selected…</option>
                    {STAGES.map(stage => <option key={stage.key} value={stage.key}>{stage.label}</option>)}
                  </select>
                  <Button size="sm" variant="outline" onClick={clearSelection}>
                    Clear ({selectedActiveJobs.length})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => {
                      if (confirm(`Close ${selectedActiveJobs.length} selected job${selectedActiveJobs.length === 1 ? "" : "s"} and remove them from the active pipeline?`)) {
                        bulkCloseMutation.mutate(selectedActiveJobs.map(job => job.id));
                      }
                    }}
                    disabled={bulkCloseMutation.isPending}
                  >
                    {bulkCloseMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                    Close Selected
                  </Button>
                </>
              )}
            </>
          )}
          {closedJobs.length > 0 && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowClosed(v => !v)}>
              <Archive size={14} /> {showClosed ? "Hide Closed" : "Closed Jobs"}
            </Button>
          )}
          <JobFormDialog
            dialogTitle="Add New Job"
            trigger={<Button size="sm" className="gap-1.5"><Plus size={14} /> New Job</Button>}
            onDone={() => {}}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8"><Loader2 size={14} className="animate-spin" /> Loading…</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
          {ACTIVE_STAGES.map(stage => {
            const stageJobs = activeJobs.filter(j => j.stage === stage.key);
            return (
              <div key={stage.key} className="flex-shrink-0 w-[260px]">
                <div className="flex items-center gap-2 mb-3 px-1">
                  {(selectionMode || selectedActiveJobs.length > 0) && stageJobs.length > 0 && (
                    <input
                      type="checkbox"
                      aria-label={`Select all ${stage.label} jobs`}
                      checked={stageJobs.every(job => selectedJobIds.includes(job.id))}
                      onChange={() => toggleStageSelection(stageJobs)}
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                  )}
                  <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                  <button
                    type="button"
                    onClick={() => stageJobs.length > 0 && toggleStageSelection(stageJobs)}
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                    disabled={stageJobs.length === 0}
                    title={stageJobs.length > 0 ? `Select/unselect ${stage.label} jobs only` : undefined}
                  >
                    {stage.label}
                  </button>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-auto">{stageJobs.length}</Badge>
                </div>
                <div className="space-y-2">
                  {stageJobs.map(job => (
                    <Card key={job.id} className={`border transition-colors cursor-pointer ${selectedJobIds.includes(job.id) ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-card-border hover:border-primary/30"}`} onClick={() => handleJobCardClick(job)}>
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            aria-label={`Select ${job.title}`}
                            checked={selectedJobIds.includes(job.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectionMode(true);
                              toggleJobSelection(job.id);
                            }}
                            onChange={() => {}}
                            className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold leading-tight">{job.title}</p>
                            <p className="text-xs text-muted-foreground">{job.company}</p>
                          </div>
                        </div>
                        {job.location && <div className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={11} />{job.location}</div>}
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Users size={11} />{job.candidateCount}</span>
                          <span className="flex items-center gap-1"><Clock size={11} />{job.daysOpen}d</span>
                        </div>
                        {job.feePotential && <div className="flex items-center gap-1 text-xs font-medium text-primary"><DollarSign size={11} />{job.feePotential}</div>}
                      </CardContent>
                    </Card>
                  ))}
                  {stageJobs.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border py-6 text-center">
                      <p className="text-xs text-muted-foreground">No jobs</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && showClosed && (
        <div className="rounded-xl border border-card-border bg-card/60 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Archive size={15} className="text-muted-foreground" />
            <h2 className="font-semibold text-sm">Closed Jobs</h2>
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{closedJobs.length}</Badge>
          </div>
          {closedJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No closed jobs.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {closedJobs.map(job => (
                <Card key={job.id} className="border border-card-border hover:border-primary/30 transition-colors cursor-pointer" onClick={() => setSelectedJob(job)}>
                  <CardContent className="p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold leading-tight">{job.title}</p>
                        <p className="text-xs text-muted-foreground">{job.company}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">Closed</Badge>
                    </div>
                    {job.feePotential && <div className="flex items-center gap-1 text-xs font-medium text-primary"><DollarSign size={11} />{job.feePotential}</div>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <Sheet open={!!selectedJob} onOpenChange={v => !v && setSelectedJob(null)}>
        <SheetContent className="w-full sm:max-w-6xl overflow-y-auto">
          {selectedJob && (() => {
            let reqs: string[] = [];
            try { reqs = JSON.parse(selectedJob.requirements); } catch {}
            return (
              <div className="space-y-6">
                <SheetHeader>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Briefcase size={18} className="text-primary" />
                    </div>
                    <div>
                      <SheetTitle className="text-lg font-display">{selectedJob.title}</SheetTitle>
                      <p className="text-sm text-muted-foreground">{selectedJob.company}</p>
                      {selectedJob.location && <p className="text-xs text-muted-foreground">{selectedJob.location}</p>}
                    </div>
                  </div>
                </SheetHeader>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Candidates", value: selectedJob.candidateCount },
                    { label: "Days Open", value: selectedJob.daysOpen },
                    { label: "Fee", value: selectedJob.feePotential || "—" },
                  ].map(({ label, value }) => (
                    <Card key={label} className="border border-card-border">
                      <CardContent className="p-3 text-center">
                        <p className="text-base font-bold truncate">{value}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Stage selector */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Stage</p>
                  <div className="flex flex-wrap gap-1.5">
                    {STAGES.map(s => (
                      <button key={s.key} onClick={() => handleStageChange(selectedJob, s.key)}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${selectedJob.stage === s.key ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {selectedJob.stage === "closed" && (
                    <p className="text-xs text-muted-foreground">Closed jobs are hidden from the active pipeline.</p>
                  )}
                </div>

                <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Candidate Pipeline Kanban</p>
                      <p className="text-xs text-muted-foreground">Per-job stages. Drag candidates between columns or use the stage selector.</p>
                    </div>
                    <Badge variant="secondary">{selectedJobCandidates.length} assigned</Badge>
                  </div>
                  {selectedJob.stage !== "closed" ? (
                    <div className="rounded-lg border border-border bg-background p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">Add candidate to this job</p>
                          <p className="text-xs text-muted-foreground">Search the candidate database, then attach them directly to this open job.</p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{addableCandidates.length} available</Badge>
                      </div>
                      <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                        <Input
                          value={candidateSearch}
                          onChange={(e) => setCandidateSearch(e.target.value)}
                          placeholder="Search name, title, company, email…"
                          className="h-9 text-sm"
                        />
                        <select
                          value={candidateToAddId}
                          onChange={(e) => setCandidateToAddId(e.target.value)}
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value="">Select candidate…</option>
                          {filteredAddableCandidates.map(candidate => (
                            <option key={candidate.id} value={candidate.id}>{candidate.name} — {candidate.title || "Candidate"}{candidate.company ? ` at ${candidate.company}` : ""}</option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          className="gap-1.5"
                          disabled={!candidateToAddId || addCandidateMutation.isPending}
                          onClick={() => addCandidateMutation.mutate({ candidateId: Number(candidateToAddId), jobId: selectedJob.id })}
                        >
                          {addCandidateMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                          Add to Job
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border bg-background/60 p-3 text-sm text-muted-foreground">
                      Reopen this job to add candidates.
                    </div>
                  )}
                  <div className="grid min-w-[920px] grid-cols-6 gap-2 overflow-x-auto pb-1">
                    {selectedJobCandidatesByStage.map(stage => (
                      <div
                        key={stage.key}
                        className={`min-h-36 rounded-lg border p-2 transition-colors ${stage.color} ${draggedCandidate && draggedCandidate.stage !== stage.key ? "ring-1 ring-primary/30" : ""}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleCandidateDrop(stage.key)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{stage.label}</p>
                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{stage.candidates.length}</Badge>
                        </div>
                        <div className="space-y-2">
                          {stage.candidates.map(candidate => (
                            <div
                              key={candidate.id}
                              draggable={!updateCandidateStageMutation.isPending}
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = "move";
                                setDraggedCandidate({ candidateId: candidate.id, stage: candidateStage(candidate) });
                              }}
                              onDragEnd={() => setDraggedCandidate(null)}
                              className={`rounded-md border border-border bg-background/95 p-2 shadow-sm transition cursor-grab active:cursor-grabbing ${draggedCandidate?.candidateId === candidate.id ? "opacity-50" : "hover:border-primary/40"}`}
                            >
                              <p className="text-xs font-medium leading-tight">{candidate.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{candidate.title || "Candidate"}</p>
                              {candidate.company && <p className="text-[10px] text-muted-foreground truncate">{candidate.company}</p>}
                              <div className="mt-2">
                                <select
                                  value={candidateStage(candidate)}
                                  onChange={(e) => moveCandidateToStage(candidate, e.target.value)}
                                  className="h-7 w-full rounded-md border border-input bg-background px-1.5 text-[11px]"
                                  disabled={updateCandidateStageMutation.isPending}
                                >
                                  {CANDIDATE_PIPELINE_STAGES.map(option => (
                                    <option key={option.key} value={option.key}>{option.label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          ))}
                          {stage.candidates.length === 0 && (
                            <div className="rounded-md border border-dashed border-border/70 bg-background/40 p-3 text-center text-[11px] text-muted-foreground">
                              No candidates in {stage.label}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedJob.description && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{selectedJob.description}</p>
                  </div>
                )}

                {reqs.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Requirements</p>
                    <ul className="space-y-1.5">
                      {reqs.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <ChevronRight size={12} className="mt-1 text-primary flex-shrink-0" />{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  {selectedJob.stage !== "placed" && selectedJob.stage !== "closed" && (
                    <Button size="sm" className="gap-1.5" onClick={() => setPlacementInvoiceJob(selectedJob)}>
                      <FileText size={13} /> Mark Placed
                    </Button>
                  )}
                  <JobFormDialog
                    dialogTitle="Edit Job"
                    initial={jobToForm(selectedJob)}
                    existing={selectedJob}
                    jobId={selectedJob.id}
                    trigger={<Button size="sm" variant="outline" className="gap-1.5 flex-1"><Pencil size={13} /> Edit</Button>}
                    onDone={() => queryClient.invalidateQueries({ queryKey: ["/api/jobs"] })}
                  />
                  {selectedJob.stage === "closed" ? (
                    <Button size="sm" variant="outline" className="gap-1.5"
                      onClick={() => stageMutation.mutate({ id: selectedJob.id, stage: "intake" })}
                      disabled={stageMutation.isPending}>
                      <RotateCcw size={13} /> Reopen
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="gap-1.5"
                      onClick={() => { if (confirm(`Close "${selectedJob.title}" and remove it from the active pipeline?`)) stageMutation.mutate({ id: selectedJob.id, stage: "closed" }); }}
                      disabled={stageMutation.isPending}>
                      <Archive size={13} /> Close
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => { if (confirm(`Delete "${selectedJob.title}"?`)) deleteMutation.mutate(selectedJob.id); }}
                    disabled={deleteMutation.isPending}>
                    <Trash2 size={13} /> Delete
                  </Button>
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      <PlacementInvoiceDialog
        job={placementInvoiceJob}
        open={!!placementInvoiceJob}
        onClose={() => setPlacementInvoiceJob(null)}
      />
    </div>
  );
}
