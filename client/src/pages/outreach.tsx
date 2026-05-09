import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Campaign } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Mail, Linkedin, Phone, MessageSquare, ArrowLeft, Send, Eye, Reply,
  AlertCircle, CheckCircle2, PauseCircle, PlayCircle, Plus, Pencil, Trash2, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CHANNELS = ["email", "linkedin", "phone", "sms"] as const;
const STATUSES = ["active", "paused", "completed"] as const;

const channelIcons: Record<string, typeof Mail> = {
  email: Mail, linkedin: Linkedin, phone: Phone, sms: MessageSquare,
};

const statusConfig: Record<string, { icon: typeof PlayCircle; color: string; bg: string }> = {
  active:    { icon: PlayCircle,   color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
  paused:    { icon: PauseCircle,  color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20" },
  completed: { icon: CheckCircle2, color: "text-blue-600",  bg: "bg-blue-50 dark:bg-blue-900/20" },
};

const stepTypeIcons: Record<string, typeof Mail> = {
  Email: Mail, LinkedIn: Linkedin, Phone: Phone,
};

interface CampaignForm {
  name: string;
  channel: string;
  status: string;
}

const EMPTY_FORM: CampaignForm = { name: "", channel: "email", status: "active" };

function CampaignFormDialog({ trigger, initial, campaignId, onDone, dialogTitle }: {
  trigger: React.ReactNode;
  initial?: Partial<CampaignForm>;
  campaignId?: number;
  onDone: () => void;
  dialogTitle: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CampaignForm>({ ...EMPTY_FORM, ...initial });
  const set = (k: keyof CampaignForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: async () => {
      if (!form.name) throw new Error("Campaign name is required");
      const payload = {
        name: form.name,
        channel: form.channel,
        status: form.status,
        sentCount: 0,
        openRate: 0,
        replyRate: 0,
        steps: JSON.stringify([]),
      };
      if (campaignId) {
        await apiRequest("PATCH", `/api/campaigns/${campaignId}`, { name: form.name, channel: form.channel, status: form.status });
      } else {
        await apiRequest("POST", "/api/campaigns", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: campaignId ? "Campaign updated" : "Campaign created" });
      setOpen(false);
      onDone();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openDialog = () => {
    setForm({ ...EMPTY_FORM, ...initial });
    setOpen(true);
  };

  return (
    <>
      <span onClick={openDialog} style={{ display: "contents" }}>{trigger}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{dialogTitle}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); mut.mutate(); }} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Campaign Name *</Label>
              <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Q2 CFO Outreach — PE Portfolio" className="h-9 text-sm" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Channel</Label>
                <select value={form.channel} onChange={e => set("channel", e.target.value)} className="w-full h-9 text-sm rounded-md border border-input bg-background px-3">
                  {CHANNELS.map(c => <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <select value={form.status} onChange={e => set("status", e.target.value)} className="w-full h-9 text-sm rounded-md border border-input bg-background px-3">
                  {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
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
    </>
  );
}

export default function Outreach() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/campaigns/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: "Campaign deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (selectedCampaign) {
    return (
      <CampaignDetail
        campaign={selectedCampaign}
        onBack={() => setSelectedCampaign(null)}
        onDelete={(id) => { deleteMutation.mutate(id); setSelectedCampaign(null); }}
        onUpdated={() => queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] })}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-xl">Outreach</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} • Multi-channel engagement
          </p>
        </div>
        <CampaignFormDialog
          dialogTitle="New Campaign"
          trigger={<Button size="sm" className="gap-1.5"><Plus size={14} /> New Campaign</Button>}
          onDone={() => {}}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8"><Loader2 size={14} className="animate-spin" /> Loading…</div>
      ) : campaigns.length === 0 ? (
        <Card className="border border-dashed border-border">
          <CardContent className="py-12 text-center">
            <Send size={24} className="mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-sm font-medium">No campaigns yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create your first campaign to start reaching candidates</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-card-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">Campaign</th>
                  <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">Channel</th>
                  <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">Sent</th>
                  <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">Open Rate</th>
                  <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">Reply Rate</th>
                  <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">Status</th>
                  <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => {
                  const ChannelIcon = channelIcons[c.channel] || Mail;
                  const sc = statusConfig[c.status] || statusConfig.active;
                  const StatusIcon = sc.icon;
                  return (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer" onClick={() => setSelectedCampaign(c)}>
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <ChannelIcon size={13} className="text-muted-foreground" />
                          <span className="capitalize text-muted-foreground">{c.channel}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{c.sentCount}</td>
                      <td className="px-4 py-3">
                        {c.openRate > 0 ? <span className="tabular-nums">{c.openRate}%</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{c.replyRate}%</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className={cn("text-[10px] capitalize gap-1", sc.bg, sc.color)}>
                          <StatusIcon size={10} />
                          {c.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <CampaignFormDialog
                            dialogTitle="Edit Campaign"
                            initial={{ name: c.name, channel: c.channel, status: c.status }}
                            campaignId={c.id}
                            trigger={
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                <Pencil size={12} />
                              </Button>
                            }
                            onDone={() => {}}
                          />
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => { if (confirm(`Delete "${c.name}"?`)) deleteMutation.mutate(c.id); }}>
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function CampaignDetail({ campaign, onBack, onDelete, onUpdated }: {
  campaign: Campaign;
  onBack: () => void;
  onDelete: (id: number) => void;
  onUpdated: () => void;
}) {
  let steps: { day: number; type: string; subject: string; sent: number; opened: number; replied: number; bounced: number }[] = [];
  try { steps = JSON.parse(campaign.steps); } catch {}

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft size={14} />
          </Button>
          <div>
            <h1 className="font-display font-bold text-xl">{campaign.name}</h1>
            <p className="text-sm text-muted-foreground">
              {campaign.sentCount} sent • {campaign.replyRate}% reply rate
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CampaignFormDialog
            dialogTitle="Edit Campaign"
            initial={{ name: campaign.name, channel: campaign.channel, status: campaign.status }}
            campaignId={campaign.id}
            trigger={<Button size="sm" variant="outline" className="gap-1.5"><Pencil size={13} /> Edit</Button>}
            onDone={onUpdated}
          />
          <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive"
            onClick={() => { if (confirm(`Delete "${campaign.name}"?`)) onDelete(campaign.id); }}>
            <Trash2 size={13} /> Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Send,         color: "text-blue-500",  label: "Sent",      value: campaign.sentCount },
          { icon: Eye,          color: "text-cyan-500",  label: "Open Rate",  value: campaign.openRate > 0 ? `${campaign.openRate}%` : "—" },
          { icon: Reply,        color: "text-green-500", label: "Reply Rate", value: `${campaign.replyRate}%` },
          { icon: AlertCircle,  color: "text-red-500",   label: "Bounced",    value: steps.reduce((s, st) => s + st.bounced, 0) },
        ].map(({ icon: Icon, color, label, value }) => (
          <Card key={label} className="border border-card-border">
            <CardContent className="p-3 text-center">
              <Icon size={14} className={cn("mx-auto mb-1", color)} />
              <p className="text-lg font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {steps.length > 0 ? (
        <Card className="border border-card-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Sequence Steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            {steps.map((step, i) => {
              const StepIcon = stepTypeIcons[step.type] || Mail;
              return (
                <div key={i} className="flex items-start gap-4 py-4 border-b border-border last:border-0">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <StepIcon size={14} className="text-primary" />
                    </div>
                    {i < steps.length - 1 && <div className="w-px h-full min-h-[20px] bg-border mt-2" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-primary">Day {step.day}</span>
                      <Badge variant="secondary" className="text-[10px]">{step.type}</Badge>
                    </div>
                    <p className="text-sm font-medium mb-2">{step.subject}</p>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: "Sent",    val: step.sent },
                        { label: "Opened",  val: step.opened || "—" },
                        { label: "Replied", val: step.replied },
                        { label: "Bounced", val: step.bounced },
                      ].map(({ label, val }) => (
                        <div key={label}>
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="text-sm font-medium tabular-nums">{val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-dashed border-border">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No sequence steps yet</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
