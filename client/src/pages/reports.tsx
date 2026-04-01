import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Mail, Calendar, FileText, Award } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const periods = ["This Week", "This Month", "This Quarter", "This Year"];

const placementsByMonth = [
  { month: "Aug", placements: 2 },
  { month: "Sep", placements: 4 },
  { month: "Oct", placements: 3 },
  { month: "Nov", placements: 5 },
  { month: "Dec", placements: 4 },
  { month: "Jan", placements: 3 },
];

const revenuePipeline = [
  { name: "Closed Won", value: 385000, fill: "hsl(217, 91%, 60%)" },
  { name: "Negotiation", value: 495000, fill: "hsl(199, 89%, 48%)" },
  { name: "Proposal", value: 355000, fill: "hsl(168, 76%, 42%)" },
  { name: "Qualified", value: 260000, fill: "hsl(43, 96%, 56%)" },
];

const sourceEffectiveness = [
  { source: "LinkedIn", placements: 8, fill: "hsl(217, 91%, 60%)" },
  { source: "Referrals", placements: 6, fill: "hsl(199, 89%, 48%)" },
  { source: "Direct", placements: 4, fill: "hsl(168, 76%, 42%)" },
  { source: "Conferences", placements: 3, fill: "hsl(43, 96%, 56%)" },
  { source: "Database", placements: 2, fill: "hsl(262, 83%, 58%)" },
];

const timeToFill = [
  { month: "Aug", days: 42 },
  { month: "Sep", days: 38 },
  { month: "Oct", days: 36 },
  { month: "Nov", days: 35 },
  { month: "Dec", days: 33 },
  { month: "Jan", days: 34 },
];

const activitySummary = [
  { label: "Calls Made", value: 47, icon: Phone, color: "text-blue-500" },
  { label: "Emails Sent", value: 234, icon: Mail, color: "text-cyan-500" },
  { label: "Interviews", value: 18, icon: Calendar, color: "text-amber-500" },
  { label: "Offers Extended", value: 5, icon: FileText, color: "text-purple-500" },
  { label: "Placements", value: 3, icon: Award, color: "text-green-500" },
];

const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "6px",
    fontSize: "12px",
  },
};

export default function Reports() {
  const [period, setPeriod] = useState("This Month");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-xl">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Performance analytics and business intelligence
          </p>
        </div>
        <div className="flex gap-1 bg-muted p-1 rounded-lg">
          {periods.map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "ghost"}
              size="sm"
              className="text-xs h-7 px-3"
              onClick={() => setPeriod(p)}
              data-testid={`button-period-${p.toLowerCase().replace(/\s/g, "-")}`}
            >
              {p}
            </Button>
          ))}
        </div>
      </div>

      {/* Activity Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {activitySummary.map((item) => (
          <Card key={item.label} className="border border-card-border">
            <CardContent className="p-4">
              <item.icon size={16} className={item.color} />
              <p className="text-2xl font-bold font-display mt-2 tabular-nums">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Placements by Month */}
        <Card className="border border-card-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Placements by Month</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={placementsByMonth} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="placements" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue Pipeline */}
        <Card className="border border-card-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenue Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={revenuePipeline}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                  stroke="none"
                >
                  {revenuePipeline.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value: number) => [`$${(value / 1000).toFixed(0)}K`, "Value"]}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => <span className="text-xs">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Source Effectiveness */}
        <Card className="border border-card-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Source Effectiveness</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sourceEffectiveness} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="source" type="category" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={80} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="placements" radius={[0, 4, 4, 0]} barSize={20}>
                  {sourceEffectiveness.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Time-to-Fill Trend */}
        <Card className="border border-card-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Time-to-Fill Trend (Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={timeToFill} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} domain={[25, 45]} />
                <Tooltip {...tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="days"
                  stroke="hsl(217, 91%, 60%)"
                  strokeWidth={2}
                  dot={{ fill: "hsl(217, 91%, 60%)", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
