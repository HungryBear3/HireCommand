import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/lib/auth";
import {
  CalendarDays, Plus, Loader2, Copy, CheckCircle2, Clock, Mail,
  User, Building2, ChevronDown, ChevronUp, Trash2, RefreshCw,
  Send, X, Sparkles,
} from "lucide-react";

interface SchedulingSession {
  id: number;
  candidateId: number;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  company: string;
  contactName: string;
  contactEmail: string;
  interviewType: string;
  proposedTimes: string;
  candidateDraft: string;
  contactDraft: string;
  status: string;
  confirmedTime: string | null;
  notes: string;
  zoomJoinUrl?: string;
  zoomMeetingId?: string;
  zoomPasscode?: string;
  createdAt: string;
}

interface CandidateOption {
  id: number;
  name: string;
  title: string;
  company: string;
  email: string;
}

interface JobOption {
  id: number;
  title: string;
  company: string;
}

interface ZoomMeeting {
  joinUrl: string;
  meetingId: string;
  passcode: string;
}

const INTERVIEW_TYPES = [
  { value: "phone_screen", label: "Phone Screen" },
  { value: "first_round", label: "First Round" },
  { value: "second_round", label: "Second Round" },
  { value: "technical", label: "Technical Interview" },
  { value: "final", label: "Final Round" },
  { value: "pe_partner", label: "PE Partner Meeting" },
  { value: "reference", label: "Reference Check" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  drafting: { label: "Draft", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  sent: { label: "Sent", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  confirmed: { label: "Confirmed", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

function copyText(text: string, label: string, toast: ReturnType<typeof useToast>["toast"]) {
  navigator.clipboard.writeText(text).then(() => toast({ title: label }));
}

function EmailDraftPanel({ label, draft, onChange }: { label: string; draft: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const { toast } = useToast();
  const lines = draft.split("\n");
  const subject = lines[0]?.startsWith("Subject:") ? lines[0] : null;
  const body = subject ? lines.slice(1).join("\n").trimStart() : draft;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => copyText(draft, "Copied!", toast)}>
            <Copy size={11} /> Copy
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setEditing(e => !e)}>
            {editing ? <><X size={11} /> Close</> : "Edit"}
          </Button>
        </div>
      </div>
      {editing ? (
        <textarea
          className="w-full h-48 text-xs font-mono border border-border rounded-md p-3 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          value={draft}
          onChange={e => onChange(e.target.value)}
        />
      ) : (
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          {subject && (
            <p className="text-xs font-semibold text-foreground">{subject}</p>
          )}
          {subject && <Separator />}
          <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{body}</p>
        </div>
      )}
    </div>
  );
}

function SessionCard({ session, onUpdate, onDelete }: {
  session: SchedulingSession;
  onUpdate: (id: number, data: Partial<SchedulingSession>) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [candidateDraft, setCandidateDraft] = useState(session.candidateDraft);
  const [contactDraft, setContactDraft] = useState(session.contactDraft);
  const statusCfg = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.drafting;
  const times: string[] = (() => { try { return JSON.parse(session.proposedTimes); } catch { return []; } })();
  const zoomMeeting = (() => { try { return JSON.parse(session.notes || "{}").zoomMeeting as ZoomMeeting | undefined; } catch { return undefined; } })();
  const interviewLabel = INTERVIEW_TYPES.find(t => t.value === session.interviewType)?.label ?? session.interviewType;

  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30" onClick={() => setExpanded(e => !e)}>
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <User size={15} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{session.candidateName}</p>
            <Badge className={`text-[10px] border-0 flex-shrink-0 ${statusCfg.color}`}>{statusCfg.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {interviewLabel} · {session.jobTitle} @ {session.company} · with {session.contactName}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {times.length > 0 && (
            <span className="text-[11px] text-muted-foreground hidden sm:block">{times.length} time{times.length !== 1 ? "s" : ""} proposed</span>
          )}
          {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-5">
          {/* Proposed times */}
          {times.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Proposed Times</p>
              <div className="flex flex-wrap gap-2">
                {times.map((t, i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs">
                    <Clock size={11} className="text-muted-foreground" />
                    {new Date(t).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Zoom meeting */}
          {zoomMeeting?.joinUrl && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Zoom Meeting</p>
              <div className="grid gap-1 text-xs text-muted-foreground">
                <span>Meeting ID: <strong className="text-foreground">{zoomMeeting.meetingId}</strong></span>
                <span>Passcode: <strong className="text-foreground">{zoomMeeting.passcode}</strong></span>
                <span className="truncate">Join URL: {zoomMeeting.joinUrl}</span>
              </div>
            </div>
          )}

          {/* Email drafts */}
          {(candidateDraft || contactDraft) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {candidateDraft && (
                <EmailDraftPanel label={`Email to ${session.candidateName}`} draft={candidateDraft} onChange={setCandidateDraft} />
              )}
              {contactDraft && (
                <EmailDraftPanel label={`Email to ${session.contactName}`} draft={contactDraft} onChange={setContactDraft} />
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            <select
              value={session.status}
              onChange={e => onUpdate(session.id, { status: e.target.value })}
              className="h-8 text-xs rounded-md border border-input bg-background px-2 pr-7"
            >
              {Object.entries(STATUS_CONFIG).map(([v, { label }]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
            {(candidateDraft !== session.candidateDraft || contactDraft !== session.contactDraft) && (
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => onUpdate(session.id, { candidateDraft, contactDraft })}>
                <CheckCircle2 size={11} /> Save Edits
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive ml-auto" onClick={() => onDelete(session.id)}>
              <Trash2 size={11} /> Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function NewSessionForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();

  const { data: candidateOptions = [] } = useQuery<CandidateOption[]>({
    queryKey: ["/api/scheduling/candidates"],
    queryFn: async () => {
      const r = await fetch("/api/scheduling/candidates", { credentials: "include" });
      return r.json();
    },
  });

  const { data: jobOptions = [] } = useQuery<JobOption[]>({
    queryKey: ["/api/scheduling/jobs"],
    queryFn: async () => {
      const r = await fetch("/api/scheduling/jobs", { credentials: "include" });
      return r.json();
    },
  });

  const [candidateId, setCandidateId] = useState("");
  const [jobId, setJobId] = useState("");
  const [jobQuery, setJobQuery] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [interviewType, setInterviewType] = useState("first_round");
  const [timeInputs, setTimeInputs] = useState<string[]>(["", "", ""]);
  const [drafting, setDrafting] = useState(false);
  const [creatingZoom, setCreatingZoom] = useState(false);
  const [autoCreateZoom, setAutoCreateZoom] = useState(true);
  const [zoomMeeting, setZoomMeeting] = useState<ZoomMeeting | null>(null);
  const [drafts, setDrafts] = useState<{ candidateDraft: string; contactDraft: string } | null>(null);

  const selectedCandidate = candidateOptions.find(c => String(c.id) === candidateId);
  const selectedExistingJob = jobOptions.find(j => String(j.id) === jobId);
  const selectedJob = selectedExistingJob ?? (jobQuery.trim()
    ? { id: 0, title: jobQuery.trim(), company: jobQuery.includes("@") ? jobQuery.split("@").slice(1).join("@").trim() : "" }
    : undefined);
  const filteredJobOptions = useMemo(() => {
    const q = jobQuery.toLowerCase().trim();
    if (!q) return jobOptions.slice(0, 20);
    return jobOptions.filter(j => `${j.title} ${j.company}`.toLowerCase().includes(q)).slice(0, 20);
  }, [jobOptions, jobQuery]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/scheduling/sessions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduling/sessions"] });
      toast({ title: "Scheduling session created" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  async function ensureZoomMeeting(): Promise<ZoomMeeting | null> {
    if (!autoCreateZoom) return zoomMeeting;
    if (zoomMeeting) return zoomMeeting;
    const proposedTimes = timeInputs.filter(Boolean);
    if (proposedTimes.length === 0) {
      toast({ title: "Add at least one proposed time before creating Zoom", variant: "destructive" });
      return null;
    }
    if (!selectedCandidate || !selectedJob || !contactName) return null;
    setCreatingZoom(true);
    try {
      const r = await fetch("/api/scheduling/zoom-meeting", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: `${selectedJob.title} interview: ${selectedCandidate.name}`,
          startTime: proposedTimes[0],
          durationMinutes: 45,
          agenda: `${selectedCandidate.name} interview for ${selectedJob.title}${selectedJob.company ? ` at ${selectedJob.company}` : ""}`,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const meeting = await r.json();
      setZoomMeeting(meeting);
      toast({ title: "Zoom meeting created", description: `Meeting ID ${meeting.meetingId}` });
      return meeting;
    } catch (e: any) {
      toast({ title: "Zoom setup failed", description: e.message, variant: "destructive" });
      return null;
    } finally {
      setCreatingZoom(false);
    }
  }

  async function handleDraft() {
    if (!selectedCandidate || !selectedJob || !contactName) {
      toast({ title: "Fill in candidate, job, and contact name first", variant: "destructive" });
      return;
    }
    setDrafting(true);
    try {
      const proposedTimes = timeInputs.filter(Boolean);
      const meeting = await ensureZoomMeeting();
      const r = await fetch("/api/scheduling/draft", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateName: selectedCandidate.name,
          candidateTitle: selectedCandidate.title,
          candidateCompany: selectedCandidate.company,
          candidateEmail: selectedCandidate.email,
          jobTitle: selectedJob.title,
          company: selectedJob.company,
          contactName,
          contactEmail,
          interviewType,
          recruiterName: currentUser?.recruiterName ?? "The Hiring Advisors",
          proposedTimes,
          zoomMeeting: meeting,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      setDrafts(await r.json());
    } catch (e: any) {
      toast({ title: "AI draft failed", description: e.message, variant: "destructive" });
    } finally {
      setDrafting(false);
    }
  }

  async function handleSave() {
    if (!selectedCandidate || !selectedJob || !contactName) {
      toast({ title: "Candidate, job, and contact name required", variant: "destructive" });
      return;
    }
    const proposedTimes = timeInputs.filter(Boolean);
    const meeting = await ensureZoomMeeting();
    if (autoCreateZoom && !meeting) return;
    createMutation.mutate({
      candidateId: selectedCandidate.id,
      candidateName: selectedCandidate.name,
      candidateEmail: selectedCandidate.email,
      jobId: selectedJob.id || undefined,
      jobTitle: selectedJob.title,
      company: selectedJob.company || "",
      contactName,
      contactEmail,
      interviewType,
      proposedTimes: JSON.stringify(proposedTimes),
      candidateDraft: drafts?.candidateDraft ?? "",
      contactDraft: drafts?.contactDraft ?? "",
      status: "drafting",
      zoomJoinUrl: meeting?.joinUrl ?? "",
      zoomMeetingId: meeting?.meetingId ?? "",
      zoomPasscode: meeting?.passcode ?? "",
      notes: meeting ? JSON.stringify({ zoomMeeting: meeting }) : "",
    });
  }

  return (
    <Card className="border border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">New Scheduling Session</CardTitle>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}><X size={14} /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Candidate + Job */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Candidate</Label>
            <select
              value={candidateId}
              onChange={e => setCandidateId(e.target.value)}
              className="w-full h-9 text-sm rounded-md border border-input bg-background px-3"
            >
              <option value="">Select candidate…</option>
              {candidateOptions.map(c => (
                <option key={c.id} value={c.id}>{c.name} — {c.title}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Job</Label>
            <Input
              value={jobQuery}
              onChange={e => {
                const value = e.target.value;
                setJobQuery(value);
                const match = jobOptions.find(j => `${j.title} @ ${j.company}` === value);
                setJobId(match ? String(match.id) : "");
              }}
              list="scheduling-job-options"
              placeholder="Type to search jobs, or enter a custom role…"
              className="h-9 text-sm"
            />
            <datalist id="scheduling-job-options">
              {filteredJobOptions.map(j => (
                <option key={j.id} value={`${j.title} @ ${j.company}`} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Contact + Interview type */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Hiring Manager / Contact</Label>
            <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Jane Smith" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Contact Email</Label>
            <Input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="jane@company.com" type="email" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Interview Type</Label>
            <select
              value={interviewType}
              onChange={e => setInterviewType(e.target.value)}
              className="w-full h-9 text-sm rounded-md border border-input bg-background px-3"
            >
              {INTERVIEW_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        {/* Proposed times */}
        <div className="space-y-2">
          <Label className="text-xs">Proposed Times (optional — add up to 3 options)</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            {timeInputs.map((t, i) => (
              <Input
                key={i}
                type="datetime-local"
                value={t}
                onChange={e => {
                  const next = [...timeInputs];
                  next[i] = e.target.value;
                  setTimeInputs(next);
                }}
                className="h-9 text-xs"
              />
            ))}
          </div>
        </div>

        {/* Zoom setup */}
        <div className="rounded-lg border border-border bg-background p-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Zoom Meeting</Label>
              <p className="text-[11px] text-muted-foreground">
                Creates a Zoom link with join-before-host enabled, meeting ID, and passcode so the admin does not need to attend.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={autoCreateZoom} onChange={e => setAutoCreateZoom(e.target.checked)} />
              Auto-create
            </label>
          </div>
          {zoomMeeting ? (
            <div className="grid gap-1 text-xs text-muted-foreground">
              <span>Meeting ID: <strong className="text-foreground">{zoomMeeting.meetingId}</strong></span>
              <span>Passcode: <strong className="text-foreground">{zoomMeeting.passcode}</strong></span>
              <span className="truncate">Join URL: {zoomMeeting.joinUrl}</span>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={ensureZoomMeeting}
              disabled={creatingZoom || !candidateId || !selectedJob || !contactName || timeInputs.filter(Boolean).length === 0}
            >
              {creatingZoom ? <Loader2 size={12} className="animate-spin" /> : <CalendarDays size={12} />}
              Set up Zoom meeting
            </Button>
          )}
        </div>

        {/* AI drafts */}
        {drafts && (
          <div className="grid gap-4 sm:grid-cols-2">
            <EmailDraftPanel
              label={`Email to ${selectedCandidate?.name ?? "Candidate"}`}
              draft={drafts.candidateDraft}
              onChange={v => setDrafts(d => d ? { ...d, candidateDraft: v } : null)}
            />
            <EmailDraftPanel
              label={`Email to ${contactName}`}
              draft={drafts.contactDraft}
              onChange={v => setDrafts(d => d ? { ...d, contactDraft: v } : null)}
            />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={handleDraft}
            disabled={drafting || !candidateId || !selectedJob || !contactName}
          >
            {drafting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {drafts ? "Re-draft with AI" : "Draft Emails with AI"}
          </Button>
          <Button
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleSave}
            disabled={createMutation.isPending || !candidateId || !selectedJob || !contactName}
          >
            {createMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            Save Session
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Scheduling() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const { data: sessions = [], isLoading } = useQuery<SchedulingSession[]>({
    queryKey: ["/api/scheduling/sessions"],
    queryFn: async () => {
      const r = await fetch("/api/scheduling/sessions", { credentials: "include" });
      return r.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/scheduling/sessions/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/scheduling/sessions"] }),
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/scheduling/sessions/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduling/sessions"] });
      toast({ title: "Session deleted" });
    },
  });

  const filtered = filter === "all" ? sessions : sessions.filter(s => s.status === filter);

  const counts = sessions.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-xl">AI Scheduling Assistant</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Coordinate interviews between candidates and hiring managers — AI drafts both emails
          </p>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setShowNew(v => !v)}>
          {showNew ? <X size={12} /> : <Plus size={12} />}
          {showNew ? "Cancel" : "New Session"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "All Sessions", value: sessions.length, key: "all" },
          { label: "Drafts", value: counts.drafting ?? 0, key: "drafting" },
          { label: "Sent", value: counts.sent ?? 0, key: "sent" },
          { label: "Confirmed", value: counts.confirmed ?? 0, key: "confirmed" },
        ].map(({ label, value, key }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-xl border p-3 text-center transition-colors ${filter === key ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"}`}
          >
            <p className="text-xl font-bold tabular-nums">{value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* New session form */}
      {showNew && <NewSessionForm onClose={() => setShowNew(false)} />}

      {/* Session list */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 size={14} className="animate-spin" /> Loading sessions…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <CalendarDays size={32} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            {filter === "all" ? "No scheduling sessions yet" : `No ${filter} sessions`}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {filter === "all" ? "Create one above to coordinate your first interview" : "Try a different filter"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => (
            <SessionCard
              key={s.id}
              session={s}
              onUpdate={(id, data) => updateMutation.mutate({ id, data })}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
