import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase,
  Users,
  Calendar,
  Trophy,
  DollarSign,
  Clock,
  Mail,
  Phone,
  FileText,
  Award,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { Activity, Interview } from "@shared/schema";

const iconMap: Record<string, typeof Mail> = {
  email: Mail,
  call: Phone,
  interview: Calendar,
  note: FileText,
  placement: Award,
};

export default function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
    queryFn: () => apiRequest("GET", "/api/stats").then((r) => r.json()),
  });

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
  });

  const { data: interviews = [] } = useQuery<Interview[]>({
    queryKey: ["/api/interviews"],
  });

  const { data: currentUser } = useCurrentUser();

  const kpis = [
    { label: "Active Jobs", value: stats?.activeJobs ?? "—", icon: Briefcase, color: "text-blue-500" },
    { label: "Pipeline Candidates", value: stats?.pipelineCandidates ?? "—", icon: Users, color: "text-cyan-500" },
    { label: "Interviews This Week", value: stats?.interviewsThisWeek ?? "—", icon: Calendar, color: "text-teal-500" },
    { label: "Placements MTD", value: stats?.placementsMTD ?? "—", icon: Trophy, color: "text-amber-500" },
    { label: "Revenue MTD", value: stats?.revenueMTD ?? "—", icon: DollarSign, color: "text-green-500" },
    { label: "Avg Time-to-Fill", value: stats ? `${stats.avgTimeToFill} days` : "—", icon: Clock, color: "text-purple-500" },
  ];

  const pipelineData = [
    { stage: "Sourced", count: stats?.pipeline?.sourced ?? 0, fill: "hsl(217, 91%, 60%)" },
    { stage: "Contacted", count: stats?.pipeline?.contacted ?? 0, fill: "hsl(199, 89%, 48%)" },
    { stage: "Screening", count: stats?.pipeline?.screening ?? 0, fill: "hsl(168, 76%, 42%)" },
    { stage: "Interview", count: stats?.pipeline?.interview ?? 0, fill: "hsl(43, 96%, 50%)" },
    { stage: "Offer", count: stats?.pipeline?.offer ?? 0, fill: "hsl(262, 83%, 58%)" },
    { stage: "Placed", count: stats?.pipeline?.placed ?? 0, fill: "hsl(142, 71%, 45%)" },
  ];

  const upcomingInterviews = interviews
    .filter((interview) => new Date(interview.interviewDate).getTime() >= Date.now())
    .sort((a, b) => new Date(a.interviewDate).getTime() - new Date(b.interviewDate).getTime())
    .slice(0, 4);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const displayName = currentUser?.recruiterName || currentUser?.username || "there";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-xl text-foreground" data-testid="text-greeting">
          {greeting}, {displayName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Here's your recruitment command center for today.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border border-card-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <kpi.icon size={16} className={kpi.color} />
              </div>
              <div className="text-lg font-bold font-display" data-testid={`text-kpi-${kpi.label.toLowerCase().replace(/\s/g, "-")}`}>
                {kpi.value}
              </div>
              <div className="text-xs text-muted-foreground">{kpi.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Pipeline Funnel */}
        <Card className="lg:col-span-2 border border-card-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Pipeline Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={pipelineData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="stage" type="category" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={70} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                  {pipelineData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Upcoming Interviews */}
        <Card className="border border-card-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Upcoming Interviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingInterviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming interviews scheduled.</p>
            ) : upcomingInterviews.map((interview) => (
              <div key={interview.id} className="flex items-start gap-3 pb-3 border-b border-border last:border-0 last:pb-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Calendar size={14} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{interview.candidateName}</p>
                  <p className="text-xs text-muted-foreground">{interview.jobTitle} — {interview.jobCompany}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-primary font-medium">
                      {new Date(interview.interviewDate).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                      {interview.interviewType.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="border border-card-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity recorded.</p>
            ) : activities.slice(0, 5).map((activity) => {
              const Icon = iconMap[activity.type] || FileText;
              return (
                <div key={activity.id} className="flex items-start gap-3 pb-3 border-b border-border last:border-0 last:pb-0">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon size={13} className="text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{activity.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {new Date(activity.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
