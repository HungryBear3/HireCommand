import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Opportunity } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  TrendingUp, DollarSign, Flame, Thermometer, Snowflake, Sparkles,
  Target, Plus, Pencil, Trash2, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PIPELINE_STAGES = [
  { key: "lead",        label: "Lead" },
  { key: "qualified",   label: "Qualified" },
  { key: "proposal",    label: "Proposal" },
  { key: "negotiation", label: "Negotiation" },
  { key: "won",         label: "Won" },
  { key: "lost",        label: "Lost" },
];

const SCORE_OPTIONS = ["hot", "warm", "cold"] as const;

const scoreConfig: Record<string, { icon: typeof Flame; color: string; bg: string }> = {
  hot:  { icon: Flame,       color: "text-red-500",  bg: "bg-red-50 dark:bg-red-900/20" },
  warm: { icon: Thermometer, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" },
  cold: { icon: Snowflake,   color: "text-blue-400",  bg: "bg-blue-50 dark:bg-blue-900/20" },
};

interface OppForm {
  company: string;
  contactPerson: string;
  estimatedFee: string;
  stage: string;
  aiScore: string;
  winProbability: string;
  notes: string;
  lastActivity: string;
}

const EMPTY: OppForm = {
  company: "", contactPerson: "", estimatedFee: "", stage: "lead",
  aiScore: "warm", winProbability: "30", notes: "", lastActivity: "",
};

function oppToForm(opp: Opportunity): OppForm {
  return {
    company:        opp.company,
    contactPerson:  opp.contactPerson,
    estimatedFee:   opp.estimatedFee,
    stage:          opp.stage,
    aiScore:        opp.aiScore,
    winProbability: String(opp.winProbability),
    notes:          opp.notes || "",
    lastActivity:   opp.lastActivity || "",
  };
}

function OppFormDialog({ trigger, initial, oppId, onDone, dialogTitle }: {
  trigger: React.ReactNode;
  initial?: Partial<OppForm>;
  oppId?: number;
  onDone: () => void;
  dialogTitle: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<OppForm>({ ...EMPTY, ...initial });
  const set = (k: keyof OppForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: async () => {
      if (!form.company) throw new Error("Company is required");
      const payload = {
        company:        form.company,
        contactPerson:  form.contactPerson || "",
        estimatedFee:   form.estimatedFee || "$0",
        stage:          form.stage,
        aiScore:        form.aiScore,
        winProbability: parseInt(form.winProbability) || 0,
        notes:          form.notes || "",
        lastActivity:   form.lastActivity || "",
      };
      if (oppId) {
        await apiRequest("PATCH", `/api/opportunities/${oppId}`, payload);
      } else {
        await apiRequest("POST", "/api/opportunities", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      toast({ title: oppId ? "Opportunity updated" : "Opportunity created" });
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
              <Label className="text-xs">Company *</Label>
              <Input value={form.company} onChange={e => set("company", e.target.value)} placeholder="Acme Capital" className="h-9 text-sm" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contact Person</Label>
              <Input value={form.contactPerson} onChange={e => set("contactPerson", e.target.value)} placeholder="Jane Smith" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Estimated Fee</Label>
              <Input value={form.estimatedFee} onChange={e => set("estimatedFee", e.target.value)} placeholder="$75,000" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Win Probability (%)</Label>
              <Input type="number" min={0} max={100} value={form.winProbability} onChange={e => set("winProbability", e.target.value)} placeholder="50" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Stage</Label>
              <select value={form.stage} onChange={e => set("stage", e.target.value)} className="w-full h-9 text-sm rounded-md border border-input bg-background px-3">
                {PIPELINE_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">AI Score</Label>
              <select value={form.aiScore} onChange={e => set("aiScore", e.target.value)} className="w-full h-9 text-sm rounded-md border border-input bg-background px-3">
                {SCORE_OPTIONS.map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Last Activity</Label>
              <Input value={form.lastActivity} onChange={e => set("lastActivity", e.target.value)} placeholder="Sent proposal on Monday" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Notes</Label>
              <textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Key context, next steps..." className="w-full h-20 text-sm rounded-md border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={mut.isPending}>
              {mut.isPending ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
              {mut.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Opportunities() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Opportunity | null>(null);

  const { data: opps = [], isLoading } = useQuery<Opportunity[]>({
    queryKey: ["/api/opportunities"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/opportunities/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      setSelected(null);
      toast({ title: "Opportunity deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const stageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: number; stage: string }) => {
      const r = await apiRequest("PATCH", `/api/opportunities/${id}`, { stage });
      return r.json();
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      setSelected(updated);
    },
  });

  const hotOpps = opps.filter(o => o.aiScore === "hot" && o.stage !== "won" && o.stage !== "lost");
  const totalPipeline = opps
    .filter(o => o.stage !== "won" && o.stage !== "lost")
    .reduce((sum, o) => {
      const n = parseInt((o.estimatedFee || "0").replace(/[^0-9]/g, ""));
      return sum + (isNaN(n) ? 0 : n);
    }, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-xl">Business Development</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {opps.length} opportunit{opps.length !== 1 ? "ies" : "y"} • ${(totalPipeline / 1000).toFixed(0)}K in pipeline
          </p>
        </div>
        <OppFormDialog
          dialogTitle="New Opportunity"
          trigger={<Button size="sm" className="gap-1.5"><Plus size={14} /> New Opportunity</Button>}
          onDone={() => {}}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8"><Loader2 size={14} className="animate-spin" /> Loading…</div>
      ) : (
        <div className="grid lg:grid-cols-4 gap-4">
          {/* Kanban — 3 cols */}
          <div className="lg:col-span-3">
            <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
              {PIPELINE_STAGES.map(stage => {
                const stageOpps = opps.filter(o => o.stage === stage.key);
                return (
                  <div key={stage.key} className="flex-shrink-0 w-[220px]">
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stage.label}</span>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-auto">{stageOpps.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {stageOpps.map(opp => {
                        const sc = scoreConfig[opp.aiScore] || scoreConfig.warm;
                        const ScoreIcon = sc.icon;
                        return (
                          <Card key={opp.id} className="border border-card-border hover:border-primary/30 transition-colors cursor-pointer" onClick={() => setSelected(opp)}>
                            <CardContent className="p-3 space-y-2">
                              <div className="flex items-start justify-between">
                                <p className="text-sm font-semibold leading-tight">{opp.company}</p>
                                <div className={cn("w-5 h-5 rounded flex items-center justify-center flex-shrink-0", sc.bg)}>
                                  <ScoreIcon size={11} className={sc.color} />
                                </div>
                              </div>
                              {opp.contactPerson && <p className="text-xs text-muted-foreground">{opp.contactPerson}</p>}
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1 font-medium text-primary">
                                  <DollarSign size={11} />{opp.estimatedFee}
                                </div>
                                <span className="text-muted-foreground">{opp.winProbability}%</span>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                      {stageOpps.length === 0 && (
                        <div className="rounded-lg border border-dashed border-border py-8 text-center">
                          <p className="text-xs text-muted-foreground">Empty</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Insights Panel */}
          <div className="space-y-4">
            <Card className="border border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles size={14} className="text-primary" />
                  AI Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Hottest Opportunities</p>
                  {hotOpps.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No hot opportunities yet</p>
                  ) : hotOpps.slice(0, 3).map(opp => (
                    <div key={opp.id} className="flex items-center gap-2 py-1.5 text-sm">
                      <Flame size={12} className="text-red-500" />
                      <span className="truncate">{opp.company}</span>
                      <span className="ml-auto text-xs text-primary font-medium">{opp.winProbability}%</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Pipeline Value</p>
                  <p className="text-2xl font-bold font-display text-primary">
                    ${(totalPipeline / 1000).toFixed(0)}K
                  </p>
                  <p className="text-xs text-muted-foreground">Active pipeline</p>
                </div>
                {opps.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Quick Tips</p>
                    <div className="space-y-2">
                      {opps.filter(o => o.stage === "proposal").slice(0, 2).map(opp => (
                        <div key={opp.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <Target size={11} className="mt-0.5 text-primary flex-shrink-0" />
                          <span>Follow up with {opp.company} on proposal</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Opportunity Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={v => !v && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (() => {
            const sc = scoreConfig[selected.aiScore] || scoreConfig.warm;
            const ScoreIcon = sc.icon;
            return (
              <div className="space-y-6">
                <SheetHeader>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <TrendingUp size={18} className="text-primary" />
                    </div>
                    <div>
                      <SheetTitle className="text-lg font-display">{selected.company}</SheetTitle>
                      {selected.contactPerson && <p className="text-sm text-muted-foreground">{selected.contactPerson}</p>}
                    </div>
                  </div>
                </SheetHeader>

                <div className="grid grid-cols-3 gap-3">
                  <Card className="border border-card-border">
                    <CardContent className="p-3 text-center">
                      <p className="text-base font-bold text-primary truncate">{selected.estimatedFee}</p>
                      <p className="text-xs text-muted-foreground">Est. Fee</p>
                    </CardContent>
                  </Card>
                  <Card className="border border-card-border">
                    <CardContent className="p-3 text-center">
                      <p className="text-base font-bold">{selected.winProbability}%</p>
                      <p className="text-xs text-muted-foreground">Win Prob.</p>
                    </CardContent>
                  </Card>
                  <Card className="border border-card-border">
                    <CardContent className="p-3 text-center flex flex-col items-center">
                      <div className={cn("flex items-center gap-1", sc.color)}>
                        <ScoreIcon size={14} />
                        <span className="text-sm font-bold capitalize">{selected.aiScore}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">AI Score</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Stage selector */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Stage</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PIPELINE_STAGES.map(s => (
                      <button key={s.key} onClick={() => stageMutation.mutate({ id: selected.id, stage: s.key })}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${selected.stage === s.key ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {selected.lastActivity && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last Activity</p>
                    <p className="text-sm text-muted-foreground">{selected.lastActivity}</p>
                  </div>
                )}

                {selected.notes && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{selected.notes}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <OppFormDialog
                    dialogTitle="Edit Opportunity"
                    initial={oppToForm(selected)}
                    oppId={selected.id}
                    trigger={<Button size="sm" variant="outline" className="gap-1.5 flex-1"><Pencil size={13} /> Edit</Button>}
                    onDone={() => queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] })}
                  />
                  <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => { if (confirm(`Delete opportunity for "${selected.company}"?`)) deleteMutation.mutate(selected.id); }}
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
