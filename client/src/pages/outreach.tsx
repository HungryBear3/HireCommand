import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Campaign } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Linkedin,
  Phone,
  MessageSquare,
  ArrowLeft,
  Send,
  Eye,
  Reply,
  AlertCircle,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const channelIcons: Record<string, typeof Mail> = {
  email: Mail,
  linkedin: Linkedin,
  phone: Phone,
  sms: MessageSquare,
};

const statusConfig: Record<string, { icon: typeof PlayCircle; color: string; bg: string }> = {
  active: { icon: PlayCircle, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
  paused: { icon: PauseCircle, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20" },
  completed: { icon: CheckCircle2, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
};

const stepTypeIcons: Record<string, typeof Mail> = {
  Email: Mail,
  LinkedIn: Linkedin,
  Phone: Phone,
};

export default function Outreach() {
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  if (selectedCampaign) {
    return (
      <CampaignDetail
        campaign={selectedCampaign}
        onBack={() => setSelectedCampaign(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-xl">Outreach</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {campaigns.length} campaigns • Multi-channel engagement
          </p>
        </div>
        <Button size="sm" className="gap-2" data-testid="button-new-campaign">
          <Send size={14} />
          New Campaign
        </Button>
      </div>

      {/* Campaign List */}
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
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const ChannelIcon = channelIcons[c.channel] || Mail;
                const sc = statusConfig[c.status];
                const StatusIcon = sc.icon;
                return (
                  <tr
                    key={c.id}
                    className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedCampaign(c)}
                    data-testid={`row-campaign-${c.id}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium">{c.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <ChannelIcon size={13} className="text-muted-foreground" />
                        <span className="capitalize text-muted-foreground">{c.channel}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{c.sentCount}</td>
                    <td className="px-4 py-3">
                      {c.openRate > 0 ? (
                        <span className="tabular-nums">{c.openRate}%</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{c.replyRate}%</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={cn("text-[10px] capitalize gap-1", sc.bg, sc.color)}>
                        <StatusIcon size={10} />
                        {c.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function CampaignDetail({ campaign, onBack }: { campaign: Campaign; onBack: () => void }) {
  const steps: {
    day: number;
    type: string;
    subject: string;
    sent: number;
    opened: number;
    replied: number;
    bounced: number;
  }[] = JSON.parse(campaign.steps);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-campaigns">
          <ArrowLeft size={14} />
        </Button>
        <div>
          <h1 className="font-display font-bold text-xl">{campaign.name}</h1>
          <p className="text-sm text-muted-foreground">
            {campaign.sentCount} sent • {campaign.replyRate}% reply rate
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border border-card-border">
          <CardContent className="p-3 text-center">
            <Send size={14} className="mx-auto mb-1 text-blue-500" />
            <p className="text-lg font-bold">{campaign.sentCount}</p>
            <p className="text-xs text-muted-foreground">Sent</p>
          </CardContent>
        </Card>
        <Card className="border border-card-border">
          <CardContent className="p-3 text-center">
            <Eye size={14} className="mx-auto mb-1 text-cyan-500" />
            <p className="text-lg font-bold">{campaign.openRate}%</p>
            <p className="text-xs text-muted-foreground">Open Rate</p>
          </CardContent>
        </Card>
        <Card className="border border-card-border">
          <CardContent className="p-3 text-center">
            <Reply size={14} className="mx-auto mb-1 text-green-500" />
            <p className="text-lg font-bold">{campaign.replyRate}%</p>
            <p className="text-xs text-muted-foreground">Reply Rate</p>
          </CardContent>
        </Card>
        <Card className="border border-card-border">
          <CardContent className="p-3 text-center">
            <AlertCircle size={14} className="mx-auto mb-1 text-red-500" />
            <p className="text-lg font-bold">
              {steps.reduce((s, st) => s + st.bounced, 0)}
            </p>
            <p className="text-xs text-muted-foreground">Bounced</p>
          </CardContent>
        </Card>
      </div>

      {/* Sequence Steps */}
      <Card className="border border-card-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Sequence Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {steps.map((step, i) => {
            const StepIcon = stepTypeIcons[step.type] || Mail;
            return (
              <div
                key={i}
                className="flex items-start gap-4 py-4 border-b border-border last:border-0"
              >
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <StepIcon size={14} className="text-primary" />
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-px h-full min-h-[20px] bg-border mt-2" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-primary">Day {step.day}</span>
                    <Badge variant="secondary" className="text-[10px]">{step.type}</Badge>
                  </div>
                  <p className="text-sm font-medium mb-2">{step.subject}</p>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Sent</p>
                      <p className="text-sm font-medium tabular-nums">{step.sent}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Opened</p>
                      <p className="text-sm font-medium tabular-nums">{step.opened || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Replied</p>
                      <p className="text-sm font-medium tabular-nums">{step.replied}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Bounced</p>
                      <p className="text-sm font-medium tabular-nums">{step.bounced}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
