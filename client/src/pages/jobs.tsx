import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Job } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MapPin, Users, Clock, DollarSign, Briefcase, ChevronRight, Plus, Pencil, Trash2, Loader2 } from "lucide-react";

const STAGES = [
  { key: "intake",     label: "Intake",     color: "bg-slate-400" },
  { key: "sourcing",   label: "Sourcing",   color: "bg-blue-500" },
  { key: "screening",  label: "Screening",  color: "bg-cyan-500" },
  { key: "interview",  label: "Interview",  color: "bg-amber-500" },
  { key: "offer",      label: "Offer",      color: "bg-purple-500" },
  { key: "placed",     label: "Placed",     color: "bg-green-500" },
];

interface JobForm {
  title: string; company: string; location: string;
  stage: string; feePotential: string; description: string; requirements: string;
}
const EMPTY: JobForm = { title: "", company: "", location: "", stage: "intake", feePotential: "", description: "", requirements: "" };

function jobToForm(job: Job): JobForm {
  let reqs: string[] = [];
  try { reqs = JSON.parse(job.requirements); } catch {}
  return { title: job.title, company: job.company, location: job.location, stage: job.stage, feePotential: job.feePotential, description: job.description, requirements: reqs.join("\n") };
}

function formToPayload(form: JobForm, existing?: Job) {
  const reqs = form.requirements.split("\n").map(r => r.trim()).filter(Boolean);
  return {
    title: form.title,
    company: form.company,
    location: form.location || "",
    stage: form.stage,
    feePotential: form.feePotential || "",
    description: form.description || "",
    requirements: JSON.stringify(reqs),
    candidateCount: existing?.candidateCount ?? 0,
    daysOpen: existing?.daysOpen ?? 0,
  };
}

function JobFormDialog({ trigger, initial, jobId, onDone, dialogTitle }: {
  trigger: React.ReactNode;
  initial?: Partial<JobForm>;
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
      const payload = formToPayload(form);
      if (jobId) {
        await apiRequest("PATCH", `/api/jobs/${jobId}`, payload);
      } else {
        await apiRequest("POST", "/api/jobs", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: jobId ? "Job updated" : "Job created" });
      setOpen(false);
      onDone();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (v) setForm({ ...EMPTY, ...initial }); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{dialogTitle}</DialogTitle></DialogHeader>
        <form onSubmit={e => { e.preventDefault(); mut.mutate(); }} className="space-y-4 mt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Job Title *</Label>
              <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Chief Financial Officer" className="h-9 text-sm" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Company *</Label>
              <Input value={form.company} onChange={e => set("company", e.target.value)} placeholder="Acme Corp" className="h-9 text-sm" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Location</Label>
              <Input value={form.location} onChange={e => set("location", e.target.value)} placeholder="New York, NY" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fee Potential</Label>
              <Input value={form.feePotential} onChange={e => set("feePotential", e.target.value)} placeholder="$125,000" className="h-9 text-sm" />
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
  );
}

export default function Jobs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const { data: jobs = [], isLoading } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });

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
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-xl">Jobs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{jobs.length} active search{jobs.length !== 1 ? "es" : ""}</p>
        </div>
        <JobFormDialog
          dialogTitle="Add New Job"
          trigger={<Button size="sm" className="gap-1.5"><Plus size={14} /> New Job</Button>}
          onDone={() => {}}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8"><Loader2 size={14} className="animate-spin" /> Loading…</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
          {STAGES.map(stage => {
            const stageJobs = jobs.filter(j => j.stage === stage.key);
            return (
              <div key={stage.key} className="flex-shrink-0 w-[260px]">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stage.label}</span>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-auto">{stageJobs.length}</Badge>
                </div>
                <div className="space-y-2">
                  {stageJobs.map(job => (
                    <Card key={job.id} className="border border-card-border hover:border-primary/30 transition-colors cursor-pointer" onClick={() => setSelectedJob(job)}>
                      <CardContent className="p-3 space-y-2">
                        <div>
                          <p className="text-sm font-semibold leading-tight">{job.title}</p>
                          <p className="text-xs text-muted-foreground">{job.company}</p>
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

      <Sheet open={!!selectedJob} onOpenChange={v => !v && setSelectedJob(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
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
                      <button key={s.key} onClick={() => stageMutation.mutate({ id: selectedJob.id, stage: s.key })}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${selectedJob.stage === s.key ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                        {s.label}
                      </button>
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
                  <JobFormDialog
                    dialogTitle="Edit Job"
                    initial={jobToForm(selectedJob)}
                    jobId={selectedJob.id}
                    trigger={<Button size="sm" variant="outline" className="gap-1.5 flex-1"><Pencil size={13} /> Edit</Button>}
                    onDone={() => queryClient.invalidateQueries({ queryKey: ["/api/jobs"] })}
                  />
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
    </div>
  );
}
