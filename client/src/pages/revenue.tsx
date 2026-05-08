import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useCurrentUser, isAdmin } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  DollarSign,
  TrendingUp,
  Download,
  Plus,
  ChevronDown,
  ChevronRight,
  FileText,
  Users,
  Check,
  AlertCircle,
  Building2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ──────────────── Types ────────────────

interface CommissionSplit {
  id: number;
  placementId: number;
  employee: string;
  splitPercent: number;
  commissionRate: number;
  commissionAmount: number;
}

interface Placement {
  id: number;
  jobTitle: string;
  company: string;
  clientName: string;
  candidateName: string;
  salary: number;
  feePercent: number;
  feeAmount: number;
  invoiceStatus: string;
  invoiceDate: string | null;
  paidDate: string | null;
  paidAmount: number;
  placedDate: string;
  startDate: string | null;
  guaranteeDays: number;
  notes: string;
  leadRecruiter: string;
  splits: CommissionSplit[];
}

// ──────────────── Helpers ────────────────

const fmt = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const TEAM = ["Andrew", "Ryan", "Aileen"] as const;
type TeamMember = (typeof TEAM)[number];

const DEFAULT_COMM_RATES: Record<TeamMember, number> = {
  Andrew: 40,
  Ryan: 35,
  Aileen: 25,
};

const COMM_GOALS: Record<TeamMember, number> = {
  Andrew: 200000,
  Ryan: 150000,
  Aileen: 100000,
};

const AVATAR_COLORS: Record<TeamMember, string> = {
  Andrew: "bg-blue-600",
  Ryan: "bg-teal-600",
  Aileen: "bg-purple-600",
};

// ──────────────── Seed Data ────────────────

const SEED_PLACEMENTS: Placement[] = [
  {
    id: 1001,
    jobTitle: "Chief Financial Officer",
    company: "Meridian Health Partners",
    clientName: "Summit Capital",
    candidateName: "Sarah Chen",
    salary: 350000,
    feePercent: 25,
    feeAmount: 87500,
    invoiceStatus: "paid",
    invoiceDate: "2025-01-20",
    paidDate: "2025-02-01",
    paidAmount: 87500,
    placedDate: "2025-01-15",
    startDate: "2025-02-17",
    guaranteeDays: 90,
    notes: "Strong CFO with healthcare M&A background.",
    leadRecruiter: "Andrew",
    splits: [
      { id: 1, placementId: 1001, employee: "Andrew", splitPercent: 60, commissionRate: 40, commissionAmount: 21000 },
      { id: 2, placementId: 1001, employee: "Ryan", splitPercent: 40, commissionRate: 35, commissionAmount: 12250 },
    ],
  },
  {
    id: 1002,
    jobTitle: "Chief Technology Officer",
    company: "DataPulse Analytics",
    clientName: "TalentForge Ventures",
    candidateName: "Alex Rivera",
    salary: 420000,
    feePercent: 25,
    feeAmount: 105000,
    invoiceStatus: "invoiced",
    invoiceDate: "2025-02-10",
    paidDate: null,
    paidAmount: 0,
    placedDate: "2025-02-05",
    startDate: "2025-03-03",
    guaranteeDays: 90,
    notes: "Exceptional AI/ML leader. Client very happy.",
    leadRecruiter: "Ryan",
    splits: [
      { id: 3, placementId: 1002, employee: "Ryan", splitPercent: 70, commissionRate: 35, commissionAmount: 25725 },
      { id: 4, placementId: 1002, employee: "Aileen", splitPercent: 30, commissionRate: 25, commissionAmount: 7875 },
    ],
  },
  {
    id: 1003,
    jobTitle: "Chief Operating Officer",
    company: "BrightPath Health",
    clientName: "Acme Health",
    candidateName: "Marcus Williams",
    salary: 380000,
    feePercent: 22,
    feeAmount: 83600,
    invoiceStatus: "partial",
    invoiceDate: "2025-02-15",
    paidDate: "2025-03-01",
    paidAmount: 41800,
    placedDate: "2025-02-12",
    startDate: "2025-03-10",
    guaranteeDays: 90,
    notes: "COO with deep ops background. Half invoice paid pending board approval.",
    leadRecruiter: "Andrew",
    splits: [
      { id: 5, placementId: 1003, employee: "Andrew", splitPercent: 50, commissionRate: 40, commissionAmount: 16720 },
      { id: 6, placementId: 1003, employee: "Ryan", splitPercent: 30, commissionRate: 35, commissionAmount: 8778 },
      { id: 7, placementId: 1003, employee: "Aileen", splitPercent: 20, commissionRate: 25, commissionAmount: 4180 },
    ],
  },
  {
    id: 1004,
    jobTitle: "VP of Finance",
    company: "Summit Capital",
    clientName: "Summit Capital",
    candidateName: "Jordan Blake",
    salary: 290000,
    feePercent: 20,
    feeAmount: 58000,
    invoiceStatus: "paid",
    invoiceDate: "2025-03-05",
    paidDate: "2025-03-20",
    paidAmount: 58000,
    placedDate: "2025-03-01",
    startDate: "2025-04-01",
    guaranteeDays: 90,
    notes: "Strong candidate, smooth process.",
    leadRecruiter: "Ryan",
    splits: [
      { id: 8, placementId: 1004, employee: "Ryan", splitPercent: 60, commissionRate: 35, commissionAmount: 12180 },
      { id: 9, placementId: 1004, employee: "Andrew", splitPercent: 40, commissionRate: 40, commissionAmount: 9280 },
    ],
  },
  {
    id: 1005,
    jobTitle: "Chief Marketing Officer",
    company: "VitalWell Consumer",
    clientName: "VitalWell",
    candidateName: "Priya Sharma",
    salary: 310000,
    feePercent: 25,
    feeAmount: 77500,
    invoiceStatus: "pending",
    invoiceDate: null,
    paidDate: null,
    paidAmount: 0,
    placedDate: "2025-03-18",
    startDate: "2025-04-14",
    guaranteeDays: 90,
    notes: "CMO with DTC brand expertise. Start date confirmed.",
    leadRecruiter: "Aileen",
    splits: [
      { id: 10, placementId: 1005, employee: "Aileen", splitPercent: 50, commissionRate: 25, commissionAmount: 9688 },
      { id: 11, placementId: 1005, employee: "Andrew", splitPercent: 50, commissionRate: 40, commissionAmount: 15500 },
    ],
  },
  {
    id: 1006,
    jobTitle: "Head of Revenue Operations",
    company: "TalentForge",
    clientName: "TalentForge Ventures",
    candidateName: "Deion Carter",
    salary: 265000,
    feePercent: 22,
    feeAmount: 58300,
    invoiceStatus: "invoiced",
    invoiceDate: "2025-04-01",
    paidDate: null,
    paidAmount: 0,
    placedDate: "2025-03-25",
    startDate: "2025-04-28",
    guaranteeDays: 90,
    notes: "RevOps leader. Invoice sent, 30-day terms.",
    leadRecruiter: "Ryan",
    splits: [
      { id: 12, placementId: 1006, employee: "Ryan", splitPercent: 100, commissionRate: 35, commissionAmount: 20405 },
    ],
  },
  {
    id: 1007,
    jobTitle: "Chief People Officer",
    company: "CarePoint Health",
    clientName: "Acme Health",
    candidateName: "Monica Patel",
    salary: 450000,
    feePercent: 25,
    feeAmount: 112500,
    invoiceStatus: "paid",
    invoiceDate: "2025-04-10",
    paidDate: "2025-04-25",
    paidAmount: 112500,
    placedDate: "2025-04-05",
    startDate: "2025-05-05",
    guaranteeDays: 90,
    notes: "Transformational HR leader. Large deal, paid quickly.",
    leadRecruiter: "Andrew",
    splits: [
      { id: 13, placementId: 1007, employee: "Andrew", splitPercent: 70, commissionRate: 40, commissionAmount: 31500 },
      { id: 14, placementId: 1007, employee: "Aileen", splitPercent: 30, commissionRate: 25, commissionAmount: 8438 },
    ],
  },
  {
    id: 1008,
    jobTitle: "VP of Business Development",
    company: "Acme Health",
    clientName: "Summit Capital",
    candidateName: "Nathan Brooks",
    salary: 275000,
    feePercent: 20,
    feeAmount: 55000,
    invoiceStatus: "pending",
    invoiceDate: null,
    paidDate: null,
    paidAmount: 0,
    placedDate: "2025-05-01",
    startDate: "2025-05-26",
    guaranteeDays: 90,
    notes: "BD leader. Placed fast — 28 days.",
    leadRecruiter: "Aileen",
    splits: [
      { id: 15, placementId: 1008, employee: "Aileen", splitPercent: 60, commissionRate: 25, commissionAmount: 8250 },
      { id: 16, placementId: 1008, employee: "Ryan", splitPercent: 40, commissionRate: 35, commissionAmount: 7700 },
    ],
  },
];

// ──────────────── Invoice Status Badge ────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  invoiced: { label: "Invoiced", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  partial: { label: "Partial", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  paid: { label: "Paid", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
};

function InvoiceBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", cfg.className)}>
      {cfg.label}
    </span>
  );
}

// ──────────────── Log Placement Modal ────────────────

interface SplitRow {
  employee: TeamMember;
  included: boolean;
  splitPercent: number;
  commissionRate: number;
}

interface PlacementForm {
  jobTitle: string;
  company: string;
  clientName: string;
  candidateName: string;
  leadRecruiter: string;
  salary: string;
  feePercent: string;
  invoiceStatus: string;
  invoiceDate: string;
  paidDate: string;
  paidAmount: string;
  startDate: string;
  guaranteeDays: string;
  notes: string;
}

const DEFAULT_FORM: PlacementForm = {
  jobTitle: "",
  company: "",
  clientName: "",
  candidateName: "",
  leadRecruiter: "Andrew",
  salary: "",
  feePercent: "25",
  invoiceStatus: "pending",
  invoiceDate: "",
  paidDate: "",
  paidAmount: "",
  startDate: "",
  guaranteeDays: "90",
  notes: "",
};

const DEFAULT_SPLITS: SplitRow[] = TEAM.map((emp) => ({
  employee: emp,
  included: true,
  splitPercent: parseFloat((100 / TEAM.length).toFixed(2)),
  commissionRate: DEFAULT_COMM_RATES[emp],
}));

function LogPlacementModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<PlacementForm>(DEFAULT_FORM);
  const [splits, setSplits] = useState<SplitRow[]>(DEFAULT_SPLITS);

  const salary = parseFloat(form.salary) || 0;
  const feePercent = parseFloat(form.feePercent) || 0;
  const feeAmount = (salary * feePercent) / 100;

  const includedSplits = splits.filter((s) => s.included);
  const splitTotal = includedSplits.reduce((sum, s) => sum + s.splitPercent, 0);
  const splitOk = Math.abs(splitTotal - 100) < 0.01;

  const setField = (key: keyof PlacementForm, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const setSplitField = (emp: TeamMember, key: keyof SplitRow, val: unknown) => {
    setSplits((prev) =>
      prev.map((s) => (s.employee === emp ? { ...s, [key]: val } : s))
    );
  };

  const evenSplit = () => {
    const included = splits.filter((s) => s.included);
    if (!included.length) return;
    const each = parseFloat((100 / included.length).toFixed(2));
    setSplits((prev) =>
      prev.map((s) => (s.included ? { ...s, splitPercent: each } : s))
    );
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        salary: parseFloat(form.salary) || 0,
        feePercent: parseFloat(form.feePercent) || 25,
        feeAmount,
        paidAmount: parseFloat(form.paidAmount) || 0,
        guaranteeDays: parseInt(form.guaranteeDays) || 90,
        invoiceDate: form.invoiceDate || null,
        paidDate: form.paidDate || null,
        startDate: form.startDate || null,
        splits: includedSplits.map((s) => ({
          employee: s.employee,
          splitPercent: s.splitPercent,
          commissionRate: s.commissionRate,
          commissionAmount: (feeAmount * s.splitPercent / 100 * s.commissionRate / 100),
        })),
      };
      return apiRequest("POST", "/api/placements", payload);
    },
    onSuccess: () => {
      toast({ title: "Placement logged successfully" });
      setForm(DEFAULT_FORM);
      setSplits(DEFAULT_SPLITS);
      onSaved();
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error logging placement", description: err.message, variant: "destructive" });
    },
  });

  const showPaidFields =
    form.invoiceStatus === "paid" || form.invoiceStatus === "partial";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Log New Placement</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Section 1: Search Details */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Search Details
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Job Title</Label>
                <Input
                  data-testid="input-job-title"
                  value={form.jobTitle}
                  onChange={(e) => setField("jobTitle", e.target.value)}
                  placeholder="Chief Financial Officer"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Company</Label>
                <Input
                  data-testid="input-company"
                  value={form.company}
                  onChange={(e) => setField("company", e.target.value)}
                  placeholder="Meridian Health Partners"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Client / PE Firm</Label>
                <Input
                  data-testid="input-client-name"
                  value={form.clientName}
                  onChange={(e) => setField("clientName", e.target.value)}
                  placeholder="Summit Capital"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Candidate Name</Label>
                <Input
                  data-testid="input-candidate-name"
                  value={form.candidateName}
                  onChange={(e) => setField("candidateName", e.target.value)}
                  placeholder="Sarah Chen"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Lead Recruiter</Label>
                <Select
                  value={form.leadRecruiter}
                  onValueChange={(v) => setField("leadRecruiter", v)}
                >
                  <SelectTrigger data-testid="select-lead-recruiter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Section 2: Financial */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Financial
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Placed Salary ($)</Label>
                <Input
                  data-testid="input-salary"
                  type="number"
                  value={form.salary}
                  onChange={(e) => setField("salary", e.target.value)}
                  placeholder="350000"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fee %</Label>
                <Input
                  data-testid="input-fee-percent"
                  type="number"
                  value={form.feePercent}
                  onChange={(e) => setField("feePercent", e.target.value)}
                  placeholder="25"
                />
                {feeAmount > 0 && (
                  <p className="text-xs text-primary font-medium">
                    Fee = {fmt(feeAmount)}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Invoice Status</Label>
                <Select
                  value={form.invoiceStatus}
                  onValueChange={(v) => setField("invoiceStatus", v)}
                >
                  <SelectTrigger data-testid="select-invoice-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="invoiced">Invoiced</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Invoice Date</Label>
                <Input
                  data-testid="input-invoice-date"
                  type="date"
                  value={form.invoiceDate}
                  onChange={(e) => setField("invoiceDate", e.target.value)}
                />
              </div>
              {showPaidFields && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Paid Date</Label>
                    <Input
                      data-testid="input-paid-date"
                      type="date"
                      value={form.paidDate}
                      onChange={(e) => setField("paidDate", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Paid Amount ($)</Label>
                    <Input
                      data-testid="input-paid-amount"
                      type="number"
                      value={form.paidAmount}
                      onChange={(e) => setField("paidAmount", e.target.value)}
                      placeholder="87500"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <Separator />

          {/* Section 3: Commission Splits */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Commission Splits
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={evenSplit}
                data-testid="button-even-split"
              >
                Even Split
              </Button>
            </div>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2.5 text-xs font-medium text-muted-foreground w-8"></th>
                    <th className="text-left p-2.5 text-xs font-medium text-muted-foreground">Employee</th>
                    <th className="text-left p-2.5 text-xs font-medium text-muted-foreground">Split %</th>
                    <th className="text-left p-2.5 text-xs font-medium text-muted-foreground">Comm Rate %</th>
                    <th className="text-right p-2.5 text-xs font-medium text-muted-foreground">Commission $</th>
                  </tr>
                </thead>
                <tbody>
                  {splits.map((s) => {
                    const commAmt = feeAmount * (s.splitPercent / 100) * (s.commissionRate / 100);
                    return (
                      <tr key={s.employee} className="border-t border-border">
                        <td className="p-2.5">
                          <input
                            type="checkbox"
                            checked={s.included}
                            onChange={(e) =>
                              setSplitField(s.employee, "included", e.target.checked)
                            }
                            data-testid={`checkbox-split-${s.employee}`}
                            className="rounded border-gray-300 text-primary focus:ring-primary"
                          />
                        </td>
                        <td className="p-2.5 font-medium">{s.employee}</td>
                        <td className="p-2.5">
                          <Input
                            type="number"
                            className="h-7 w-20 text-xs"
                            value={s.splitPercent}
                            disabled={!s.included}
                            onChange={(e) =>
                              setSplitField(s.employee, "splitPercent", parseFloat(e.target.value) || 0)
                            }
                            data-testid={`input-split-percent-${s.employee}`}
                          />
                        </td>
                        <td className="p-2.5">
                          <Input
                            type="number"
                            className="h-7 w-20 text-xs"
                            value={s.commissionRate}
                            disabled={!s.included}
                            onChange={(e) =>
                              setSplitField(s.employee, "commissionRate", parseFloat(e.target.value) || 0)
                            }
                            data-testid={`input-comm-rate-${s.employee}`}
                          />
                        </td>
                        <td className="p-2.5 text-right font-semibold text-primary">
                          {s.included && feeAmount > 0 ? fmt(commAmt) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!splitOk && includedSplits.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-red-600">
                <AlertCircle size={12} />
                Split total: {splitTotal.toFixed(1)}% — must equal 100%
              </div>
            )}
            {splitOk && includedSplits.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-green-600">
                <Check size={12} />
                Splits sum to 100%
              </div>
            )}
          </div>

          <Separator />

          {/* Section 4: Additional */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Additional
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date (optional)</Label>
                <Input
                  data-testid="input-start-date"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setField("startDate", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Guarantee Days</Label>
                <Input
                  data-testid="input-guarantee-days"
                  type="number"
                  value={form.guaranteeDays}
                  onChange={(e) => setField("guaranteeDays", e.target.value)}
                  placeholder="90"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  data-testid="input-notes"
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  placeholder="Any relevant context..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              data-testid="button-cancel-placement"
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !splitOk}
              data-testid="button-save-placement"
            >
              {mutation.isPending ? "Saving…" : "Log Placement"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────── Revenue Tab ────────────────

function RevenueTab({ placements }: { placements: Placement[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [recruiterFilter, setRecruiterFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [logOpen, setLogOpen] = useState(false);
  const queryClient = useQueryClient();

  const years = useMemo(() => {
    const ys = new Set(placements.map((p) => new Date(p.placedDate).getFullYear().toString()));
    return Array.from(ys).sort((a, b) => parseInt(b) - parseInt(a));
  }, [placements]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return placements.filter((p) => {
      const matchSearch =
        !q ||
        p.candidateName.toLowerCase().includes(q) ||
        p.company.toLowerCase().includes(q) ||
        p.jobTitle.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || p.invoiceStatus === statusFilter;
      const matchRecruiter = recruiterFilter === "all" || p.leadRecruiter === recruiterFilter;
      const matchYear =
        yearFilter === "all" || new Date(p.placedDate).getFullYear().toString() === yearFilter;
      return matchSearch && matchStatus && matchRecruiter && matchYear;
    });
  }, [placements, search, statusFilter, recruiterFilter, yearFilter]);

  const kpis = useMemo(() => {
    const total = placements.length;
    const totalFees = placements.reduce((s, p) => s + p.feeAmount, 0);
    const collected = placements
      .filter((p) => p.invoiceStatus === "paid")
      .reduce((s, p) => s + p.paidAmount, 0);
    const outstanding = placements
      .filter((p) => p.invoiceStatus !== "paid")
      .reduce((s, p) => s + p.feeAmount, 0);
    const avgFee = total > 0 ? totalFees / total : 0;
    return { total, totalFees, collected, outstanding, avgFee };
  }, [placements]);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* KPI Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Placements", value: kpis.total.toString(), icon: FileText, color: "text-blue-500" },
          { label: "Total Fees Billed", value: fmt(kpis.totalFees), icon: DollarSign, color: "text-green-500" },
          { label: "Collected", value: fmt(kpis.collected), icon: Check, color: "text-teal-500" },
          { label: "Outstanding", value: fmt(kpis.outstanding), icon: AlertCircle, color: "text-amber-500" },
          { label: "Avg Fee", value: fmt(kpis.avgFee), icon: TrendingUp, color: "text-purple-500" },
        ].map((k) => (
          <Card key={k.label} className="border border-card-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <k.icon size={14} className={k.color} />
                <span className="text-xs text-muted-foreground">{k.label}</span>
              </div>
              <div
                className="text-lg font-bold font-display"
                data-testid={`kpi-${k.label.toLowerCase().replace(/\s/g, "-")}`}
              >
                {k.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter Bar + Log Button */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          data-testid="input-search"
          placeholder="Search candidate, company, or role…"
          className="h-8 w-60 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-36 text-xs" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="invoiced">Invoiced</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
        <Select value={recruiterFilter} onValueChange={setRecruiterFilter}>
          <SelectTrigger className="h-8 w-36 text-xs" data-testid="select-recruiter-filter">
            <SelectValue placeholder="Recruiter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Recruiters</SelectItem>
            {TEAM.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="h-8 w-28 text-xs" data-testid="select-year-filter">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button
            size="sm"
            className="gap-1.5 h-8"
            onClick={() => setLogOpen(true)}
            data-testid="button-log-placement"
          >
            <Plus size={14} />
            Log Placement
          </Button>
        </div>
      </div>

      {/* Deal Table */}
      <Card className="border border-card-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-8 p-3"></TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Candidate</TableHead>
                <TableHead className="text-xs">Role</TableHead>
                <TableHead className="text-xs">Company / Client</TableHead>
                <TableHead className="text-xs">Salary</TableHead>
                <TableHead className="text-xs">Fee %</TableHead>
                <TableHead className="text-xs">Fee Amount</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Paid Date</TableHead>
                <TableHead className="text-xs">Lead</TableHead>
                <TableHead className="text-xs w-16">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-12 text-muted-foreground text-sm">
                    No placements match your filters.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((p) => {
                const isExpanded = expanded.has(p.id);
                return (
                  <>
                    <TableRow
                      key={p.id}
                      className="cursor-pointer hover:bg-muted/20 transition-colors"
                      data-testid={`row-placement-${p.id}`}
                    >
                      <TableCell className="p-3">
                        <button
                          onClick={() => toggleExpand(p.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          data-testid={`toggle-expand-${p.id}`}
                          aria-label="Expand row"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDate(p.placedDate)}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{p.candidateName}</TableCell>
                      <TableCell className="text-sm">{p.jobTitle}</TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{p.company}</p>
                        <p className="text-xs text-muted-foreground">{p.clientName}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmt(p.salary)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.feePercent}%</TableCell>
                      <TableCell className="font-bold text-primary text-sm">{fmt(p.feeAmount)}</TableCell>
                      <TableCell>
                        <InvoiceBadge status={p.invoiceStatus} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDate(p.paidDate)}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                          {p.leadRecruiter[0]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          data-testid={`button-edit-${p.id}`}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${p.id}-splits`} className="bg-muted/10">
                        <TableCell colSpan={12} className="p-0">
                          <div className="px-8 py-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                              Commission Splits
                            </p>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                                  <th className="pb-2 font-medium">Employee</th>
                                  <th className="pb-2 font-medium">Split %</th>
                                  <th className="pb-2 font-medium">Comm Rate</th>
                                  <th className="pb-2 font-medium text-right">Commission $</th>
                                  <th className="pb-2 font-medium text-right">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {p.splits.map((s) => (
                                  <tr key={s.id} className="border-b border-border/50 last:border-0">
                                    <td className="py-2 font-medium">{s.employee}</td>
                                    <td className="py-2 text-muted-foreground">{s.splitPercent}%</td>
                                    <td className="py-2 text-muted-foreground">{s.commissionRate}%</td>
                                    <td className="py-2 text-right font-semibold text-primary">{fmt(s.commissionAmount)}</td>
                                    <td className="py-2 text-right">
                                      <InvoiceBadge status={p.invoiceStatus === "paid" ? "paid" : "pending"} />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <LogPlacementModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/placements"] })}
      />
    </div>
  );
}

// ──────────────── CSV Export Helper ────────────────

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildCSVRows(placements: Placement[], employee?: string): string[][] {
  const header = [
    "Employee",
    "Deal Date",
    "Candidate",
    "Role",
    "Company",
    "Salary",
    "Total Fee",
    "Split %",
    "Commission Rate %",
    "Commission $",
    "Invoice Status",
    "Paid Date",
  ];
  const rows: string[][] = [header];

  for (const p of placements) {
    for (const s of p.splits) {
      if (employee && s.employee !== employee) continue;
      rows.push([
        s.employee,
        p.placedDate,
        p.candidateName,
        p.jobTitle,
        p.company,
        String(p.salary),
        String(p.feeAmount),
        String(s.splitPercent),
        String(s.commissionRate),
        String(s.commissionAmount),
        p.invoiceStatus,
        p.paidDate ?? "",
      ]);
    }
  }
  return rows;
}

// ──────────────── Commission Settings ────────────────

const STORAGE_KEY = "hirecommand_commission_settings";

interface CommissionSettingsState {
  rates: Record<string, number>;
  defaultSplit: Record<string, number>;
  annualGoals: Record<string, number>;
}

function loadSettings(): CommissionSettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {
    rates: { Andrew: 40, Ryan: 35, Aileen: 25 },
    defaultSplit: { Andrew: 50, Ryan: 30, Aileen: 20 },
    annualGoals: { Andrew: 200000, Ryan: 150000, Aileen: 100000 },
  };
}

function CommissionSettings() {
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const adminUser = isAdmin(currentUser);
  const [settings, setSettings] = useState<CommissionSettingsState>(loadSettings);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CommissionSettingsState>(settings);

  function handleOpen() {
    setDraft(JSON.parse(JSON.stringify(settings)));
    setOpen(true);
  }

  function handleSave() {
    setSettings(draft);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    setOpen(false);
    toast({ title: "Commission settings saved" });
  }

  function setField(
    section: keyof CommissionSettingsState,
    person: string,
    value: string
  ) {
    const num = parseFloat(value) || 0;
    setDraft(prev => ({
      ...prev,
      [section]: { ...prev[section], [person]: num },
    }));
  }

  return (
    <>
      <Card className="border border-card-border mb-6">
        <CardHeader className="pb-3 pt-4 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Commission Settings</CardTitle>
            {adminUser && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleOpen}>
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            {TEAM.map(emp => (
              <div key={emp} className="space-y-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${AVATAR_COLORS[emp]}`}>
                    {emp[0]}
                  </div>
                  <span className="font-medium text-sm">{emp}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Commission rate</span>
                  <span className="font-medium text-foreground">{settings.rates[emp]}%</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Default split</span>
                  <span className="font-medium text-foreground">{settings.defaultSplit[emp]}%</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Annual goal</span>
                  <span className="font-medium text-foreground">
                    ${settings.annualGoals[emp].toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Commission Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {TEAM.map(emp => (
              <div key={emp} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${AVATAR_COLORS[emp]}`}>
                    {emp[0]}
                  </div>
                  <span className="font-semibold text-sm">{emp}</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs mb-1 block">Commission Rate %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={draft.rates[emp]}
                      onChange={e => setField("rates", emp, e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Default Split %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={draft.defaultSplit[emp]}
                      onChange={e => setField("defaultSplit", emp, e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Annual Goal $</Label>
                    <Input
                      type="number"
                      min={0}
                      value={draft.annualGoals[emp]}
                      onChange={e => setField("annualGoals", emp, e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave}>Save Settings</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ──────────────── Commissions Tab ────────────────

function CommissionsTab({ placements }: { placements: Placement[] }) {
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const adminUser = isAdmin(currentUser);
  // Non-admin users only see their own recruiter's data
  const myRecruiterName = currentUser?.recruiterName ?? null;
  const visibleTeam = adminUser ? TEAM : TEAM.filter(e => e === myRecruiterName);

  const [empTab, setEmpTab] = useState<string>(adminUser ? "all" : (myRecruiterName ?? "all"));
  const [yearFilter, setYearFilter] = useState("all");
  const currentYear = new Date().getFullYear().toString();
  const savedSettings = loadSettings();

  const years = useMemo(() => {
    const ys = new Set(placements.map((p) => new Date(p.placedDate).getFullYear().toString()));
    return Array.from(ys).sort((a, b) => parseInt(b) - parseInt(a));
  }, [placements]);

  // Per-employee stats — filtered by visibility
  const empStats = useMemo(() => {
    return visibleTeam.map((emp) => {
      const mySplits = placements.flatMap((p) =>
        p.splits.filter((s) => s.employee === emp).map((s) => ({ ...s, placement: p }))
      );
      const totalComm = mySplits.reduce((s, x) => s + x.commissionAmount, 0);
      const ytdComm = mySplits
        .filter((x) => new Date(x.placement.placedDate).getFullYear().toString() === currentYear)
        .reduce((s, x) => s + x.commissionAmount, 0);
      const placements_ = new Set(mySplits.map((x) => x.placementId)).size;
      return { emp, totalComm, ytdComm, placements: placements_, goal: savedSettings.annualGoals[emp] ?? COMM_GOALS[emp] };
    });
  }, [placements, currentYear]);

  // Commission rows for detail table
  const commRows = useMemo(() => {
    const rows: {
      date: string;
      candidate: string;
      company: string;
      totalFee: number;
      employee: string;
      splitPercent: number;
      commRate: number;
      commAmount: number;
      invoiceStatus: string;
      paidDate: string | null;
    }[] = [];
    for (const p of placements) {
      const yr = new Date(p.placedDate).getFullYear().toString();
      if (yearFilter !== "all" && yr !== yearFilter) continue;
      for (const s of p.splits) {
        if (empTab !== "all" && s.employee !== empTab) continue;
        rows.push({
          date: p.placedDate,
          candidate: p.candidateName,
          company: p.company,
          totalFee: p.feeAmount,
          employee: s.employee,
          splitPercent: s.splitPercent,
          commRate: s.commissionRate,
          commAmount: s.commissionAmount,
          invoiceStatus: p.invoiceStatus,
          paidDate: p.paidDate,
        });
      }
    }
    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [placements, empTab, yearFilter]);

  const totalFiltered = commRows.reduce((s, r) => s + r.commAmount, 0);

  const handleExportEmployee = (emp: TeamMember) => {
    const rows = buildCSVRows(placements, emp);
    downloadCSV(`commissions-${emp.toLowerCase()}.csv`, rows);
    toast({ title: `Exported ${emp}'s commissions` });
  };

  const handleExportAll = () => {
    const rows = buildCSVRows(placements);
    downloadCSV("commissions-all.csv", rows);
    toast({ title: "Exported all commissions" });
  };

  return (
    <div className="space-y-6">
      {/* Employee Summary Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {empStats.map(({ emp, totalComm, ytdComm, placements: pCount, goal }) => {
          const pct = Math.min(100, (ytdComm / goal) * 100);
          return (
            <Card key={emp} className="border border-card-border">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold",
                        AVATAR_COLORS[emp]
                      )}
                    >
                      {emp[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{emp}</p>
                      <p className="text-xs text-muted-foreground">
                        {pCount} placement{pCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => handleExportEmployee(emp)}
                    data-testid={`button-export-${emp}`}
                  >
                    <Download size={11} />
                    Export
                  </Button>
                </div>

                <div className="space-y-1 mb-4">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Total Commission</span>
                    <span className="font-semibold text-foreground">{fmt(totalComm)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>YTD Commission</span>
                    <span className="font-semibold text-primary">{fmt(ytdComm)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Annual Goal</span>
                    <span>{fmt(goal)}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Progress to Goal</span>
                    <span className="font-medium">{pct.toFixed(0)}%</span>
                  </div>
                  <Progress value={pct} className="h-2" data-testid={`progress-${emp}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detail Table Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold">Commission Detail</h2>
        <div className="flex gap-1 ml-2">
          {(adminUser ? (["all", ...TEAM] as const) : visibleTeam).map((tab) => (
            <button
              key={tab}
              onClick={() => setEmpTab(tab)}
              data-testid={`tab-comm-${tab}`}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                empTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "all" ? "All" : tab}
            </button>
          ))}
        </div>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="h-7 w-28 text-xs ml-2" data-testid="select-comm-year">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {adminUser && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1 ml-auto"
            onClick={handleExportAll}
            data-testid="button-export-all"
          >
            <Download size={11} />
            Export All
          </Button>
        )}
      </div>

      <Card className="border border-card-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Deal</TableHead>
                {adminUser && <TableHead className="text-xs">Total Fee</TableHead>}
                {adminUser && <TableHead className="text-xs">Employee</TableHead>}
                {adminUser && <TableHead className="text-xs">Split %</TableHead>}
                {adminUser && <TableHead className="text-xs">Comm Rate</TableHead>}
                <TableHead className="text-xs">Commission $</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={adminUser ? 8 : 3} className="text-center py-12 text-muted-foreground text-sm">
                    No commission records match your filters.
                  </TableCell>
                </TableRow>
              )}
              {commRows.map((r, i) => (
                <TableRow key={i} data-testid={`row-comm-${i}`}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {fmtDate(r.date)}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{r.candidate}</p>
                    <p className="text-xs text-muted-foreground">@ {r.company}</p>
                  </TableCell>
                  {adminUser && <TableCell className="text-sm text-muted-foreground">{fmt(r.totalFee)}</TableCell>}
                  {adminUser && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold",
                            AVATAR_COLORS[r.employee as TeamMember] ?? "bg-gray-500"
                          )}
                        >
                          {r.employee[0]}
                        </div>
                        <span className="text-sm">{r.employee}</span>
                      </div>
                    </TableCell>
                  )}
                  {adminUser && <TableCell className="text-sm text-muted-foreground">{r.splitPercent}%</TableCell>}
                  {adminUser && <TableCell className="text-sm text-muted-foreground">{r.commRate}%</TableCell>}
                  <TableCell className="font-bold text-primary text-sm">{fmt(r.commAmount)}</TableCell>
                  <TableCell>
                    <InvoiceBadge status={r.invoiceStatus} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Subtotals */}
        {commRows.length > 0 && (
          <div className="border-t border-border px-4 py-3 bg-muted/20 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {commRows.length} record{commRows.length !== 1 ? "s" : ""}
            </span>
            <span className="text-sm font-bold text-primary">
              Total: {fmt(totalFiltered)}
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}

// ──────────────── Main Page ────────────────

export default function RevenuePage() {
  const { data: apiPlacements = [], isLoading } = useQuery<Placement[]>({
    queryKey: ["/api/placements"],
    queryFn: () => apiRequest("GET", "/api/placements").then((r) => r.json()),
  });

  const placements = apiPlacements;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-foreground" data-testid="page-title">
            Revenue & Commissions
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Financial command center — {placements.length} placements tracked
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DollarSign size={18} className="text-primary" />
          <Building2 size={18} className="text-muted-foreground" />
          <Users size={18} className="text-muted-foreground" />
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList className="h-9" data-testid="tabs-main">
          <TabsTrigger value="revenue" className="text-sm gap-1.5" data-testid="tab-revenue">
            <FileText size={14} />
            Revenue / Deals
          </TabsTrigger>
          <TabsTrigger value="commissions" className="text-sm gap-1.5" data-testid="tab-commissions">
            <DollarSign size={14} />
            Commissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="mt-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              Loading placements…
            </div>
          ) : (
            <RevenueTab placements={placements} />
          )}
        </TabsContent>

        <TabsContent value="commissions" className="mt-0">
          <CommissionSettings />
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              Loading commissions…
            </div>
          ) : (
            <CommissionsTab placements={placements} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
