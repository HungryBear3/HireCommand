import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Opportunity } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  TrendingUp,
  DollarSign,
  Flame,
  Thermometer,
  Snowflake,
  Sparkles,
  Target,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const pipelineStages = [
  { key: "lead", label: "Lead" },
  { key: "qualified", label: "Qualified" },
  { key: "proposal", label: "Proposal" },
  { key: "negotiation", label: "Negotiation" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

const scoreConfig: Record<string, { icon: typeof Flame; color: string; bg: string }> = {
  hot: { icon: Flame, color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/20" },
  warm: { icon: Thermometer, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" },
  cold: { icon: Snowflake, color: "text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" },
};

export default function Opportunities() {
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const { data: opps = [] } = useQuery<Opportunity[]>({
    queryKey: ["/api/opportunities"],
  });

  const wonOpps = opps.filter((o) => o.stage === "won");
  const hotOpps = opps.filter((o) => o.aiScore === "hot" && o.stage !== "won" && o.stage !== "lost");
  const totalPipeline = opps
    .filter((o) => o.stage !== "won" && o.stage !== "lost")
    .reduce((sum, o) => sum + parseInt(o.estimatedFee.replace(/[^0-9]/g, "")), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-xl">Business Development</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {opps.length} opportunities • ${(totalPipeline / 1000).toFixed(0)}K in pipeline
          </p>
        </div>
        <Button size="sm" className="gap-2" data-testid="button-new-opportunity">
          <TrendingUp size={14} />
          New Opportunity
        </Button>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        {/* Kanban - 3 cols */}
        <div className="lg:col-span-3">
          <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
            {pipelineStages.map((stage) => {
              const stageOpps = opps.filter((o) => o.stage === stage.key);
              return (
                <div key={stage.key} className="flex-shrink-0 w-[220px]">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {stage.label}
                    </span>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-auto">
                      {stageOpps.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {stageOpps.map((opp) => {
                      const sc = scoreConfig[opp.aiScore];
                      const ScoreIcon = sc.icon;
                      return (
                        <Card
                          key={opp.id}
                          className="border border-card-border hover:border-primary/30 transition-colors cursor-pointer"
                          onClick={() => setSelected(opp)}
                          data-testid={`card-opp-${opp.id}`}
                        >
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start justify-between">
                              <p className="text-sm font-semibold leading-tight">{opp.company}</p>
                              <div className={cn("w-5 h-5 rounded flex items-center justify-center", sc.bg)}>
                                <ScoreIcon size={11} className={sc.color} />
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">{opp.contactPerson}</p>
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1 font-medium text-primary">
                                <DollarSign size={11} />
                                {opp.estimatedFee}
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
                {hotOpps.slice(0, 3).map((opp) => (
                  <div key={opp.id} className="flex items-center gap-2 py-1.5 text-sm">
                    <Flame size={12} className="text-red-500" />
                    <span className="truncate">{opp.company}</span>
                    <span className="ml-auto text-xs text-primary font-medium">{opp.winProbability}%</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Recommended Actions</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Target size={11} className="mt-0.5 text-primary flex-shrink-0" />
                    <span>Follow up with Silver Lake — CTO search proposal sent 2 days ago</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Target size={11} className="mt-0.5 text-primary flex-shrink-0" />
                    <span>Schedule deep-dive with Hellman & Friedman re: tech & healthcare portfolio</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Target size={11} className="mt-0.5 text-primary flex-shrink-0" />
                    <span>Send multi-function case study to General Atlantic — high intent signal</span>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Win Probability</p>
                <p className="text-2xl font-bold font-display text-primary">
                  ${(totalPipeline / 1000).toFixed(0)}K
                </p>
                <p className="text-xs text-muted-foreground">Weighted pipeline value</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Opportunity Detail */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && <OppDetail opp={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function OppDetail({ opp }: { opp: Opportunity }) {
  const sc = scoreConfig[opp.aiScore];
  const ScoreIcon = sc.icon;
  return (
    <div className="space-y-6">
      <SheetHeader>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={18} className="text-primary" />
          </div>
          <div>
            <SheetTitle className="text-lg font-display">{opp.company}</SheetTitle>
            <p className="text-sm text-muted-foreground">{opp.contactPerson}</p>
          </div>
        </div>
      </SheetHeader>

      <div className="grid grid-cols-3 gap-3">
        <Card className="border border-card-border">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-primary">{opp.estimatedFee}</p>
            <p className="text-xs text-muted-foreground">Est. Fee</p>
          </CardContent>
        </Card>
        <Card className="border border-card-border">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{opp.winProbability}%</p>
            <p className="text-xs text-muted-foreground">Win Prob.</p>
          </CardContent>
        </Card>
        <Card className="border border-card-border">
          <CardContent className="p-3 text-center flex flex-col items-center">
            <div className={cn("flex items-center gap-1", sc.color)}>
              <ScoreIcon size={16} />
              <span className="text-sm font-bold capitalize">{opp.aiScore}</span>
            </div>
            <p className="text-xs text-muted-foreground">AI Score</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Stage</h3>
        <Badge variant="secondary" className="capitalize">{opp.stage}</Badge>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Notes</h3>
        <p className="text-sm text-muted-foreground">{opp.notes}</p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Last Activity</h3>
        <p className="text-sm text-muted-foreground">{opp.lastActivity}</p>
      </div>

      <div className="flex gap-2">
        <Button size="sm" className="flex-1">Follow Up</Button>
        <Button size="sm" variant="outline" className="flex-1">Edit</Button>
      </div>
    </div>
  );
}
