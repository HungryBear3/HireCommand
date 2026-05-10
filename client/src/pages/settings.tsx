import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useCurrentUser, isAdmin } from "@/lib/auth";
import {
  User,
  Mail,
  Linkedin,
  Calendar,
  Link2,
  CheckCircle2,
  Users,
  Database,
  Loader2,
  RefreshCw,
  Wifi,
  WifiOff,
  Key,
  Plus,
  Trash2,
  Copy,
  Globe,
  Webhook,
  Eye,
  EyeOff,
  Code2,
  ExternalLink,
  History,
  ArrowUpRight,
  Clock,
  AlertCircle,
  Info,
  Sparkles,
} from "lucide-react";

const comingSoonIntegrations = [
  { name: "Google Workspace", description: "Docs, Sheets, and Drive sync" },
  { name: "Mailchimp", description: "Email campaign management" },
  { name: "LinkedIn Recruiter", description: "Deep seat integration with InMail and pipeline" },
];

interface QBStatus {
  connected: boolean;
  companyName?: string;
  realmId?: string;
  lastSync?: string;
  tokenExpiry?: string;
  clientIdConfigured: boolean;
}

interface SyncStatus {
  lastSync: string | null;
  candidatesSynced: number;
  jobsSynced: number;
  isRunning: boolean;
}

interface LinkedInSyncStatus {
  lastSync: string | null;
  nextSync: string | null;
  summary: {
    total: number;
    updated: number;
    unchanged: number;
    skipped: number;
    errors: number;
    ranAt: string;
  } | null;
  stats: {
    totalCandidates: number;
    withLinkedIn: number;
    neverSynced: number;
    recentChanges: number;
    hasProxyCurl: boolean;
  };
}

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const adminUser = isAdmin(currentUser);

  // Change password state
  const [cpCurrent, setCpCurrent] = useState("");
  const [cpNew, setCpNew] = useState("");
  const [cpConfirm, setCpConfirm] = useState("");
  const cpMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/me/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: cpCurrent, newPassword: cpNew }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || "Failed to change password");
      }
      return r.json();
    },
    onSuccess: () => {
      setCpCurrent(""); setCpNew(""); setCpConfirm("");
      toast({ title: "Password changed", description: "Your password has been updated." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Sourcing API keys
  interface SourcingSettings {
    googleCseKeySet: boolean; googleCseCxSet: boolean; perplexityKeySet: boolean;
    googleCseKey: string; googleCseCx: string; perplexityKey: string;
  }
  const { data: sourcingSettings, refetch: refetchSourcing } = useQuery<SourcingSettings>({
    queryKey: ["/api/sourcing/settings"],
    queryFn: async () => {
      const r = await fetch("/api/sourcing/settings", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
  const [gKey, setGKey] = useState("");
  const [gCx, setGCx] = useState("");
  const [plxKey, setPlxKey] = useState("");
  const [showGKey, setShowGKey] = useState(false);
  const [showPlxKey, setShowPlxKey] = useState(false);
  const saveSourcingMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = {};
      if (gKey) body.googleCseKey = gKey;
      if (gCx) body.googleCseCx = gCx;
      if (plxKey) body.perplexityKey = plxKey;
      const r = await fetch("/api/sourcing/settings", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Failed to save");
      return r.json();
    },
    onSuccess: () => {
      refetchSourcing();
      queryClient.invalidateQueries({ queryKey: ["/api/sourcing/config"] });
      setGKey(""); setGCx(""); setPlxKey("");
      toast({ title: "Sourcing API keys saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  interface RediscoverySettings {
    anthropicApiKeySet: boolean;
    anthropicApiKey: string;
    envConfigured: boolean;
  }
  const { data: rediscoverySettings, refetch: refetchRediscoverySettings } = useQuery<RediscoverySettings>({
    queryKey: ["/api/rediscovery/settings"],
    queryFn: async () => {
      const r = await fetch("/api/rediscovery/settings", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
  const [anthropicKey, setAnthropicKey] = useState("");
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const saveRediscoveryMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/rediscovery/settings", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anthropicApiKey: anthropicKey }),
      });
      if (!r.ok) throw new Error("Failed to save Anthropic API key");
      return r.json();
    },
    onSuccess: () => {
      refetchRediscoverySettings();
      queryClient.invalidateQueries({ queryKey: ["/api/rediscovery/status"] });
      setAnthropicKey("");
      toast({ title: "Rediscovery API key saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // QuickBooks
  const { data: qbStatus } = useQuery<QBStatus>({ queryKey: ["/api/qb/status"] });

  const qbSyncMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/qb/sync");
      return r.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/qb/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      const synced = data?.synced ?? 0;
      const paid = data?.paid ?? 0;
      toast({
        title: "QB sync complete",
        description: `Synced ${synced} invoice${synced !== 1 ? "s" : ""} · ${paid} marked paid`,
      });
    },
    onError: (e: any) => toast({ title: "Sync failed", description: e.message, variant: "destructive" }),
  });

  const qbDisconnectMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/qb/disconnect", {});
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/qb/status"] });
      toast({ title: "QuickBooks disconnected" });
    },
    onError: (e: any) => toast({ title: "Disconnect failed", description: e.message, variant: "destructive" }),
  });

  // LinkedIn Sync
  const { data: linkedInStatus, refetch: refetchLinkedIn } = useQuery<LinkedInSyncStatus>({
    queryKey: ["/api/linkedin-sync/status"],
    refetchInterval: 30_000,
  });

  const linkedInSyncMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/linkedin-sync/run");
      return r.json();
    },
    onSuccess: () => {
      toast({
        title: "LinkedIn sync started",
        description: "Checking all candidate profiles in the background. This may take a few minutes.",
      });
      // Refresh status after a short delay
      setTimeout(() => refetchLinkedIn(), 5000);
    },
    onError: (e: any) => {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    },
  });

  // Loxo state
  const [loxoApiKey, setLoxoApiKey] = useState("");
  const [loxoSlug, setLoxoSlug] = useState("the-hiring-advisors-1");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; totalPeople?: number } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  // Load sync status on mount
  useEffect(() => {
    loadSyncStatus();
  }, []);

  async function loadSyncStatus() {
    try {
      const data = await apiRequest("GET", "/api/loxo/status");
      const status = await data.json();
      setSyncStatus(status);
    } catch (_) {}
  }

  async function handleSaveCredentials() {
    if (!loxoApiKey.trim()) {
      toast({ title: "API key required", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      await apiRequest("POST", "/api/loxo/credentials", {
        apiKey: loxoApiKey.trim(),
        slug: loxoSlug.trim(),
      });
      toast({ title: "Credentials saved", description: "Your Loxo API key has been stored securely." });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTestConnection() {
    // If no key entered yet, still try to test with saved key
    if (!loxoApiKey.trim()) {
      // Try to test with whatever is already saved
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      // Save first if key is present
      if (loxoApiKey.trim()) {
        await apiRequest("POST", "/api/loxo/credentials", {
          apiKey: loxoApiKey.trim(),
          slug: loxoSlug.trim(),
        });
      }
      const r = await apiRequest("GET", "/api/loxo/test");
      const data = await r.json();
      if (data.ok) {
        setTestResult({ ok: true, totalPeople: data.totalPeople });
        toast({
          title: "Connected!",
          description: `Found ${data.totalPeople?.toLocaleString()} people in your Loxo database.`,
        });
      } else {
        setTestResult({ ok: false });
        toast({ title: "Connection failed", description: data.error, variant: "destructive" });
      }
    } catch (e: any) {
      setTestResult({ ok: false });
      toast({ title: "Connection error", description: e.message, variant: "destructive" });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSyncNow() {
    setIsSyncing(true);
    setSyncProgress(0);
    setSyncMessage("Starting sync...");

    try {
      // Use EventSource for SSE streaming progress
      const baseUrl = (window as any).__PORT_5000__
        ? `${(window as any).__PORT_5000__}`
        : "";
      const url = `${baseUrl}/api/loxo/sync`;

      const eventSource = new EventSource(url);

      await new Promise<void>((resolve, reject) => {
        eventSource.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.error) {
              setSyncMessage(`Error: ${msg.error}`);
              eventSource.close();
              reject(new Error(msg.error));
              return;
            }
            if (msg.progress !== undefined) setSyncProgress(msg.progress);
            if (msg.message) setSyncMessage(msg.message);
            if (msg.phase === "complete") {
              setSyncStatus({
                lastSync: new Date().toISOString(),
                candidatesSynced: msg.candidatesSynced,
                jobsSynced: msg.jobsSynced,
                isRunning: false,
              });
              eventSource.close();
              resolve();
            }
          } catch (_) {}
        };
        eventSource.onerror = () => {
          eventSource.close();
          resolve(); // Connection closed after stream ends — treat as done
        };
      });

      // Invalidate all data caches so the app reloads with real data
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });

      toast({
        title: "Sync complete!",
        description: `${syncStatus?.candidatesSynced ?? ""} candidates and ${syncStatus?.jobsSynced ?? ""} jobs imported from Loxo.`,
      });
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  }

  function formatLastSync(iso: string | null) {
    if (!iso) return "Never";
    const d = new Date(iso);
    return d.toLocaleString();
  }

  // ── API Keys state ──────────────────────────────────────────────────
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyVisible, setNewKeyVisible] = useState<Record<string, boolean>>({});
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{ id: string; key: string; name: string } | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>(["candidate.created", "job.stage_changed", "placement.created"]);

  const { data: apiKeys = [], isLoading: keysLoading } = useQuery<Array<{
    id: string; name: string; key: string; active: boolean; createdAt: string; lastUsed?: string;
  }>>({ queryKey: ["/api/api-keys"] });

  const createKeyMutation = useMutation({
    mutationFn: async (name: string) => {
      const r = await apiRequest("POST", "/api/api-keys", { name });
      return r.json();
    },
    onSuccess: (data) => {
      setNewlyCreatedKey(data);
      setNewKeyName("");
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({ title: "API key created", description: "Copy it now — it won't be shown again." });
    },
    onError: (e: any) => toast({ title: "Failed to create key", description: e.message, variant: "destructive" }),
  });

  const revokeKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("POST", `/api/api-keys/${id}/revoke`, {});
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({ title: "Key revoked" });
    },
    onError: (e: any) => toast({ title: "Revoke failed", description: e.message, variant: "destructive" }),
  });

  function copyToClipboard(text: string, label = "Copied!") {
    navigator.clipboard.writeText(text).then(() => toast({ title: label }));
  }

  const WEBHOOK_EVENTS = [
    "candidate.created",
    "candidate.updated",
    "job.created",
    "job.stage_changed",
    "placement.created",
    "placement.invoice_updated",
    "interview.scheduled",
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display font-bold text-xl">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your account, integrations, and preferences
        </p>
      </div>

      {/* Profile */}
      <Card className="border border-card-border">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User size={24} className="text-primary" />
            </div>
            <div>
              <p className="font-semibold">{currentUser?.recruiterName ?? currentUser?.username ?? "—"}</p>
              <p className="text-sm text-muted-foreground">
                {adminUser ? "Admin — The Hiring Advisors" : "Recruiter — The Hiring Advisors"}
              </p>
            </div>
          </div>
          <Separator />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                defaultValue={currentUser?.recruiterName ?? currentUser?.username ?? ""}
                className="h-9 text-sm"
                data-testid="input-full-name"
                readOnly
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input
                defaultValue={currentUser?.email ?? ""}
                className="h-9 text-sm"
                data-testid="input-email"
                readOnly
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Company</Label>
              <Input defaultValue="The Hiring Advisors" className="h-9 text-sm" data-testid="input-company" readOnly />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Access Level</Label>
              <Input
                defaultValue={adminUser ? "Admin" : "Recruiter"}
                className="h-9 text-sm"
                data-testid="input-role"
                readOnly
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="border border-card-border">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Change Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Current Password</Label>
              <Input
                type="password"
                value={cpCurrent}
                onChange={e => setCpCurrent(e.target.value)}
                placeholder="••••••••"
                className="h-9 text-sm"
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">New Password</Label>
              <Input
                type="password"
                value={cpNew}
                onChange={e => setCpNew(e.target.value)}
                placeholder="••••••••"
                className="h-9 text-sm"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Confirm New Password</Label>
              <Input
                type="password"
                value={cpConfirm}
                onChange={e => setCpConfirm(e.target.value)}
                placeholder="••••••••"
                className="h-9 text-sm"
                autoComplete="new-password"
              />
            </div>
          </div>
          {cpNew && cpConfirm && cpNew !== cpConfirm && (
            <p className="text-xs text-destructive">Passwords do not match.</p>
          )}
          <Button
            size="sm"
            disabled={!cpCurrent || !cpNew || cpNew !== cpConfirm || cpMutation.isPending}
            onClick={() => cpMutation.mutate()}
          >
            {cpMutation.isPending ? "Updating…" : "Update Password"}
          </Button>
        </CardContent>
      </Card>

      {/* Loxo Integration Panel */}
      <Card className="border border-card-border">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Loxo prominent card */}
          <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Database size={20} className="text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Loxo ATS/CRM</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Sync your real candidates and jobs directly from Loxo</p>
                </div>
              </div>
              <Badge
                className={`text-xs border-0 flex-shrink-0 ${
                  testResult?.ok
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : testResult?.ok === false
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                }`}
                data-testid="badge-loxo-status"
              >
                {testResult?.ok ? "Connected" : testResult?.ok === false ? "Error" : "Ready to Connect"}
              </Badge>
            </div>

            {/* Sync status row */}
            {syncStatus && (
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground bg-background rounded-lg px-3 py-2.5 border border-border">
                <span>Last sync: <span className="font-medium text-foreground">{formatLastSync(syncStatus.lastSync)}</span></span>
                <span>Candidates: <span className="font-medium text-foreground">{syncStatus.candidatesSynced.toLocaleString()}</span></span>
                <span>Jobs: <span className="font-medium text-foreground">{syncStatus.jobsSynced.toLocaleString()}</span></span>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">API Key</Label>
                <Input
                  type="password"
                  placeholder="Paste your Loxo API key"
                  value={loxoApiKey}
                  onChange={(e) => setLoxoApiKey(e.target.value)}
                  className="h-9 text-sm font-mono"
                  data-testid="input-loxo-api-key"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Agency Slug</Label>
                <Input
                  type="text"
                  value={loxoSlug}
                  onChange={(e) => setLoxoSlug(e.target.value)}
                  className="h-9 text-sm font-mono"
                  data-testid="input-loxo-slug"
                />
              </div>
            </div>

            {/* Live progress bar */}
            {isSyncing && (
              <div className="space-y-2" data-testid="text-sync-status">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={11} className="animate-spin text-primary" />
                    {syncMessage}
                  </span>
                  <span>{syncProgress}%</span>
                </div>
                <Progress value={syncProgress} className="h-1.5" />
              </div>
            )}

            {/* Test result */}
            {testResult?.ok && !isSyncing && (
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                <Wifi size={12} />
                Connected — {testResult.totalPeople?.toLocaleString()} people in your Loxo database
              </div>
            )}
            {testResult?.ok === false && (
              <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                <WifiOff size={12} />
                Could not connect. Check your API key and slug.
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={handleSaveCredentials}
                disabled={isSaving || isSyncing || !loxoApiKey.trim()}
                data-testid="button-loxo-save"
              >
                {isSaving ? <Loader2 size={12} className="animate-spin" /> : null}
                Save Key
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={handleTestConnection}
                disabled={isTesting || isSyncing}
                data-testid="button-loxo-test"
              >
                {isTesting ? (
                  <><Loader2 size={12} className="animate-spin" /> Testing...</>
                ) : (
                  <><CheckCircle2 size={12} /> Test Connection</>
                )}
              </Button>
              <Button
                size="sm"
                className="gap-1.5 text-xs"
                onClick={handleSyncNow}
                disabled={isSyncing || isTesting}
                data-testid="button-loxo-sync"
              >
                {isSyncing ? (
                  <><Loader2 size={12} className="animate-spin" /> Syncing...</>
                ) : (
                  <><RefreshCw size={12} /> Sync Now</>
                )}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Sync imports up to 500 candidates and 250 jobs. Re-run anytime — existing records are updated, not duplicated.
            </p>
          </div>

          {/* Other integrations */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Other Integrations</p>
            {[
              { name: "Gmail", icon: Mail, connected: true, description: "Sync emails and calendar" },
              { name: "LinkedIn", icon: Linkedin, connected: true, description: "Import candidates and send InMails" },
              { name: "Calendar", icon: Calendar, connected: true, description: "Interview scheduling" },
            ].map((int) => (
              <div
                key={int.name}
                className="flex items-center justify-between py-2.5 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                    <int.icon size={16} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{int.name}</p>
                    <p className="text-xs text-muted-foreground">{int.description}</p>
                  </div>
                </div>
                {int.connected ? (
                  <Badge variant="secondary" className="gap-1 text-xs text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400">
                    <CheckCircle2 size={10} />
                    Connected
                  </Badge>
                ) : (
                  <Button size="sm" variant="outline" className="text-xs">Connect</Button>
                )}
              </div>
            ))}
          </div>

          {/* Coming Soon */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Coming Soon</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {comingSoonIntegrations.map((int) => (
                <div
                  key={int.name}
                  className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 opacity-60"
                  data-testid={`card-coming-soon-${int.name.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                    <Link2 size={14} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{int.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{int.description}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] flex-shrink-0 border-muted-foreground/30 text-muted-foreground">
                    Soon
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="border border-card-border">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Email notifications for new candidate matches", defaultChecked: true },
            { label: "Push notifications for interview reminders", defaultChecked: true },
            { label: "Weekly pipeline summary email", defaultChecked: true },
            { label: "Real-time alerts for high-priority opportunities", defaultChecked: false },
            { label: "Daily activity digest", defaultChecked: false },
          ].map((pref, i) => (
            <div key={i} className="flex items-center justify-between">
              <Label className="text-sm font-normal">{pref.label}</Label>
              <Switch defaultChecked={pref.defaultChecked} data-testid={`switch-notification-${i}`} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Team */}
      <Card className="border border-card-border">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users size={14} />
            Team Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User size={14} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Andrew</p>
                <p className="text-xs text-muted-foreground">Owner</p>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">Admin</Badge>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" data-testid="button-invite-member">
            <Users size={12} />
            Invite Team Member
          </Button>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card className="border border-card-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Key size={14} />
              API Keys
            </CardTitle>
            <a
              href="/api/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
              data-testid="link-api-docs"
            >
              <Code2 size={12} />
              View API Docs
              <ExternalLink size={10} />
            </a>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Generate API keys to integrate HireCommand with external tools, automations, and data sources.
            All authenticated endpoints are documented in the interactive Swagger UI.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Newly created key banner */}
          {newlyCreatedKey && (
            <div className="rounded-lg border border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700 p-4 space-y-2" data-testid="banner-new-api-key">
              <p className="text-xs font-semibold text-green-800 dark:text-green-300 flex items-center gap-1.5">
                <CheckCircle2 size={13} />
                New API key created — copy it now. You won't see it again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-white dark:bg-black/30 rounded px-3 py-1.5 border border-green-200 dark:border-green-700 text-green-900 dark:text-green-200 truncate">
                  {newlyCreatedKey.key}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs shrink-0 border-green-300"
                  onClick={() => copyToClipboard(newlyCreatedKey.key, "API key copied!")}
                  data-testid="button-copy-new-key"
                >
                  <Copy size={12} /> Copy
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-muted-foreground shrink-0"
                  onClick={() => setNewlyCreatedKey(null)}
                  data-testid="button-dismiss-new-key"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {/* Create new key */}
          <div className="flex gap-2">
            <Input
              placeholder="Key name (e.g. Zapier, n8n, Postman)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newKeyName.trim() && createKeyMutation.mutate(newKeyName.trim())}
              className="h-9 text-sm flex-1"
              data-testid="input-new-key-name"
            />
            <Button
              size="sm"
              className="gap-1.5 text-xs shrink-0"
              onClick={() => newKeyName.trim() && createKeyMutation.mutate(newKeyName.trim())}
              disabled={!newKeyName.trim() || createKeyMutation.isPending}
              data-testid="button-create-api-key"
            >
              {createKeyMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Generate Key
            </Button>
          </div>

          {/* Key list */}
          {keysLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 size={12} className="animate-spin" /> Loading keys...
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-6 text-center" data-testid="text-no-api-keys">
              <Key size={24} className="mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">No API keys yet. Generate one above to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {apiKeys.map((k) => (
                <div key={k.id} className="flex items-center gap-3 px-4 py-3 bg-background" data-testid={`row-api-key-${k.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{k.name}</p>
                      <Badge
                        className={`text-[10px] border-0 ${k.active ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}
                      >
                        {k.active ? "Active" : "Revoked"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <code className="text-[11px] font-mono text-muted-foreground">
                        {newKeyVisible[k.id] ? k.key : `${k.key.slice(0, 12)}${"•".repeat(20)}`}
                      </code>
                      <button
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                        onClick={() => setNewKeyVisible((prev) => ({ ...prev, [k.id]: !prev[k.id] }))}
                        data-testid={`button-toggle-key-${k.id}`}
                      >
                        {newKeyVisible[k.id] ? <EyeOff size={11} /> : <Eye size={11} />}
                      </button>
                    </div>
                    {k.createdAt && (
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                        Created {new Date(k.createdAt).toLocaleDateString()}
                        {k.lastUsed ? ` · Last used ${new Date(k.lastUsed).toLocaleDateString()}` : " · Never used"}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => copyToClipboard(k.key, "Key copied!")}
                      data-testid={`button-copy-key-${k.id}`}
                    >
                      <Copy size={13} />
                    </Button>
                    {k.active && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => revokeKeyMutation.mutate(k.id)}
                        disabled={revokeKeyMutation.isPending}
                        data-testid={`button-revoke-key-${k.id}`}
                      >
                        <Trash2 size={13} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Separator />

          {/* Quick start */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick Start</p>
            <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-1">
              <p className="text-[11px] font-mono text-muted-foreground">curl -H "X-Api-Key: hc_live_..." \</p>
              <p className="text-[11px] font-mono text-muted-foreground pl-4">https://your-domain/api/v1/candidates</p>
            </div>
            <p className="text-[11px] text-muted-foreground">
              All v1 endpoints support JSON. Pass <code className="text-xs bg-muted px-1 rounded">X-Api-Key</code> as a request header.
              Full documentation and code examples are available in the{" "}
              <a href="/api/docs" target="_blank" className="text-primary hover:underline">Swagger UI</a>.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* QuickBooks */}
      <Card className="border border-card-border" data-testid="card-quickbooks">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-green-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-[9px]">QB</span>
              </div>
              QuickBooks
            </CardTitle>
            {qbStatus?.connected && (
              <Badge className="text-xs border-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-1">
                <CheckCircle2 size={10} />
                Connected
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sync invoices and automatically mark them paid when clients pay through QuickBooks.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {qbStatus?.connected ? (
            <>
              {/* Connected state */}
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-sm text-green-700 dark:text-green-400">QB</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{qbStatus.companyName || "QuickBooks"}</p>
                    {qbStatus.lastSync && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Last sync: {new Date(qbStatus.lastSync).toLocaleString()}
                      </p>
                    )}
                    {qbStatus.tokenExpiry && (
                      <p className="text-[11px] text-muted-foreground">
                        Token expires: {new Date(qbStatus.tokenExpiry).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => qbSyncMutation.mutate()}
                    disabled={qbSyncMutation.isPending}
                    data-testid="button-qb-sync-now"
                  >
                    {qbSyncMutation.isPending ? (
                      <><Loader2 size={12} className="animate-spin" /> Syncing...</>
                    ) : (
                      <><RefreshCw size={12} /> Sync Now</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs text-destructive"
                    onClick={() => qbDisconnectMutation.mutate()}
                    disabled={qbDisconnectMutation.isPending}
                    data-testid="button-qb-disconnect"
                  >
                    {qbDisconnectMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
                    Disconnect
                  </Button>
                </div>
              </div>

              {/* QB Webhook URL */}
              <div className="space-y-2">
                <Label className="text-xs">QuickBooks Webhook URL</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[11px] font-mono bg-muted/50 border border-border rounded px-3 py-2 text-muted-foreground truncate" data-testid="text-qb-webhook-url">
                    {typeof window !== "undefined" ? window.location.origin : ""}/api/qb/webhook
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs shrink-0"
                    onClick={() => {
                      const url = `${window.location.origin}/api/qb/webhook`;
                      navigator.clipboard.writeText(url).then(() =>
                        toast({ title: "Webhook URL copied!" })
                      );
                    }}
                    data-testid="button-copy-qb-webhook"
                  >
                    <Copy size={12} /> Copy
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Register this webhook URL in your{" "}
                  <a
                    href="https://developer.intuit.com/app/developer/qbo/docs/develop/webhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    QuickBooks app settings
                  </a>{" "}
                  to enable real-time payment sync.
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Disconnected state */}
              <div className="rounded-lg border border-dashed border-border py-8 flex flex-col items-center gap-4 text-center">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                  <span className="font-bold text-base text-muted-foreground">QB</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Not connected to QuickBooks</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    Connect to automatically push invoices and sync payment status when clients pay.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={async () => {
                    try {
                      const r = await apiRequest("GET", "/api/qb/connect");
                      const { authUrl } = await r.json();
                      window.location.href = authUrl;
                    } catch (e: any) {
                      toast({ title: "Could not connect", description: e.message, variant: "destructive" });
                    }
                  }}
                  data-testid="button-connect-qb-settings"
                >
                  <ExternalLink size={12} />
                  Connect QuickBooks
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* LinkedIn Profile Sync */}
      <Card className="border border-card-border">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Linkedin size={14} />
            LinkedIn Profile Sync
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automatically checks every candidate's LinkedIn profile for changes every 2 weeks and updates their record.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Stat row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([
              { label: "With LinkedIn", value: linkedInStatus?.stats?.withLinkedIn ?? "—" },
              { label: "Never Synced", value: linkedInStatus?.stats?.neverSynced ?? "—" },
              { label: "Profiles Changed", value: linkedInStatus?.stats?.recentChanges ?? "—" },
              { label: "Last Run", value: linkedInStatus?.lastSync
                ? new Date(linkedInStatus.lastSync).toLocaleDateString()
                : "Never" },
            ] as { label: string; value: string | number }[]).map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-card-border bg-muted/30 p-3 text-center">
                <p className="text-lg font-bold tabular-nums">{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Last sync summary */}
          {linkedInStatus?.summary && (
            <div className="rounded-lg border border-card-border bg-muted/20 px-3 py-2 text-xs flex flex-wrap gap-x-4 gap-y-1">
              <span className="text-muted-foreground">Last run: <strong className="text-foreground">{new Date(linkedInStatus.summary.ranAt).toLocaleString()}</strong></span>
              <span className="text-green-600 dark:text-green-400 font-medium">{linkedInStatus.summary.updated} updated</span>
              <span className="text-muted-foreground">{linkedInStatus.summary.unchanged} unchanged</span>
              <span className="text-amber-600 dark:text-amber-400">{linkedInStatus.summary.skipped} skipped</span>
              {linkedInStatus.summary.errors > 0 && (
                <span className="text-red-500">{linkedInStatus.summary.errors} errors</span>
              )}
            </div>
          )}

          {/* Next scheduled run */}
          {linkedInStatus?.nextSync && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock size={11} />
              Next automatic sync: <strong className="text-foreground ml-0.5">{new Date(linkedInStatus.nextSync).toLocaleDateString()}</strong>
            </div>
          )}

          {/* Data source notice */}
          <div className={`rounded-lg border px-3 py-2.5 text-xs flex items-start gap-2 ${
            linkedInStatus?.stats?.hasProxyCurl
              ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400"
              : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400"
          }`}>
            {linkedInStatus?.stats?.hasProxyCurl
              ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
              : <AlertCircle size={13} className="shrink-0 mt-0.5" />}
            <div>
              {linkedInStatus?.stats?.hasProxyCurl ? (
                <><strong>ProxyCurl connected</strong> — live LinkedIn data enabled. Profiles will reflect real-time changes.</>
              ) : (
                <><strong>Using Loxo as data source.</strong> For real-time LinkedIn data, add a <code className="font-mono bg-black/10 dark:bg-white/10 px-1 rounded">PROXYCURL_API_KEY</code> environment variable. Without it, sync uses Loxo-mirrored fields only.</>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => linkedInSyncMutation.mutate()}
              disabled={linkedInSyncMutation.isPending}
              data-testid="button-linkedin-sync-run"
            >
              <RefreshCw size={12} className={linkedInSyncMutation.isPending ? "animate-spin" : ""} />
              {linkedInSyncMutation.isPending ? "Syncing…" : "Sync All Now"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => refetchLinkedIn()}
              data-testid="button-linkedin-sync-refresh"
            >
              <RefreshCw size={12} /> Refresh Status
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Sync runs automatically every 14 days for all candidates with a LinkedIn URL saved.
            Changes to title, company, location, email, or phone are detected and applied to the candidate record automatically.
            A timeline entry is added and the change history is visible on the candidate's profile.
          </p>
        </CardContent>
      </Card>

      {/* Sourcing API Keys — admin only */}
      {adminUser && (
        <Card className="border border-card-border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Globe size={14} />
              Sourcing APIs
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure API keys for AI-powered candidate sourcing. Keys are stored securely and used by the Source page.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Google CSE */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-bold text-blue-600 dark:text-blue-400 flex-shrink-0">G</div>
                <div>
                  <p className="text-sm font-medium">Google Custom Search (X-Ray)</p>
                  <p className="text-xs text-muted-foreground">LinkedIn X-Ray sourcing via Google CSE</p>
                </div>
                <Badge className={`ml-auto text-xs border-0 ${sourcingSettings?.googleCseKeySet && sourcingSettings?.googleCseCxSet ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                  {sourcingSettings?.googleCseKeySet && sourcingSettings?.googleCseCxSet ? "Configured" : "Not Set"}
                </Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">API Key {sourcingSettings?.googleCseKeySet && <span className="text-green-600 dark:text-green-400">(set)</span>}</Label>
                  <div className="relative">
                    <Input
                      type={showGKey ? "text" : "password"}
                      placeholder={sourcingSettings?.googleCseKeySet ? "••••••••••••• (update)" : "AIza..."}
                      value={gKey}
                      onChange={e => setGKey(e.target.value)}
                      className="h-9 text-sm font-mono pr-9"
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowGKey(v => !v)}
                    >
                      {showGKey ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Search Engine ID (CX) {sourcingSettings?.googleCseCxSet && <span className="text-green-600 dark:text-green-400">(set)</span>}</Label>
                  <Input
                    type="text"
                    placeholder={sourcingSettings?.googleCseCxSet ? "••••••••••••• (update)" : "017576662512468239146:omuauf..."}
                    value={gCx}
                    onChange={e => setGCx(e.target.value)}
                    className="h-9 text-sm font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Perplexity */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-sm font-bold text-purple-600 dark:text-purple-400 flex-shrink-0">P</div>
                <div>
                  <p className="text-sm font-medium">Perplexity AI</p>
                  <p className="text-xs text-muted-foreground">AI-ranked candidate discovery (sonar-pro)</p>
                </div>
                <Badge className={`ml-auto text-xs border-0 ${sourcingSettings?.perplexityKeySet ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                  {sourcingSettings?.perplexityKeySet ? "Configured" : "Not Set"}
                </Badge>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">API Key {sourcingSettings?.perplexityKeySet && <span className="text-green-600 dark:text-green-400">(set)</span>}</Label>
                <div className="relative">
                  <Input
                    type={showPlxKey ? "text" : "password"}
                    placeholder={sourcingSettings?.perplexityKeySet ? "••••••••••••• (update)" : "pplx-..."}
                    value={plxKey}
                    onChange={e => setPlxKey(e.target.value)}
                    className="h-9 text-sm font-mono pr-9"
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPlxKey(v => !v)}
                  >
                    {showPlxKey ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                size="sm"
                className="gap-1.5 text-xs"
                disabled={(!gKey && !gCx && !plxKey) || saveSourcingMutation.isPending}
                onClick={() => saveSourcingMutation.mutate()}
              >
                {saveSourcingMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
                Save API Keys
              </Button>
              <p className="text-[11px] text-muted-foreground">Leave a field blank to keep the existing value.</p>
            </div>

            <div className="rounded-lg bg-muted/40 border border-border p-3 text-[11px] text-muted-foreground space-y-1">
              <p className="font-medium text-foreground text-xs flex items-center gap-1.5"><Info size={11} /> Setup instructions</p>
              <p><strong>Google CSE:</strong> Create a Custom Search Engine at <code className="bg-muted px-1 rounded">programmablesearchengine.google.com</code>, set it to search the entire web, then get an API key from Google Cloud Console (Custom Search JSON API).</p>
              <p className="mt-1"><strong>Perplexity:</strong> Get an API key from <code className="bg-muted px-1 rounded">perplexity.ai/settings/api</code>. The sonar-pro model is used for best candidate discovery results.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rediscovery AI — admin only */}
      {adminUser && (
        <Card className="border border-card-border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles size={14} />
              Rediscovery AI
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Save the Anthropic API key used by AI Talent Rediscovery. Env vars still work, but this gives admins a visible in-app setup path.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">A</div>
                <div>
                  <p className="text-sm font-medium">Anthropic Claude</p>
                  <p className="text-xs text-muted-foreground">Required for Rediscovery analysis</p>
                </div>
                <Badge className={`ml-auto text-xs border-0 ${rediscoverySettings?.anthropicApiKeySet ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                  {rediscoverySettings?.anthropicApiKeySet ? "Configured" : "Not Set"}
                </Badge>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  API Key {rediscoverySettings?.anthropicApiKeySet && <span className="text-green-600 dark:text-green-400">(set{rediscoverySettings.envConfigured ? " via environment" : ""})</span>}
                </Label>
                <div className="relative">
                  <Input
                    type={showAnthropicKey ? "text" : "password"}
                    placeholder={rediscoverySettings?.anthropicApiKeySet ? "••••••••••••• (update)" : "sk-ant-..."}
                    value={anthropicKey}
                    onChange={e => setAnthropicKey(e.target.value)}
                    className="h-9 text-sm font-mono pr-9"
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAnthropicKey(v => !v)}
                  >
                    {showAnthropicKey ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                className="gap-1.5 text-xs"
                disabled={!anthropicKey || saveRediscoveryMutation.isPending}
                onClick={() => saveRediscoveryMutation.mutate()}
              >
                {saveRediscoveryMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
                Save Anthropic Key
              </Button>
              <p className="text-[11px] text-muted-foreground">Leave blank to keep the existing key.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Webhooks */}
      <Card className="border border-card-border">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Webhook size={14} />
            Webhooks
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Subscribe to real-time events. HireCommand will POST a signed JSON payload to your endpoint whenever the selected events fire.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Webhook URL */}
          <div className="space-y-1.5">
            <Label className="text-xs">Endpoint URL</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="https://your-server.com/webhooks/hirecommand"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="h-9 text-sm pl-8"
                  data-testid="input-webhook-url"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-xs shrink-0"
                disabled={!webhookUrl.trim()}
                onClick={() => toast({ title: "Webhook saved", description: `Subscribed to ${webhookEvents.length} events.` })}
                data-testid="button-save-webhook"
              >
                Save
              </Button>
            </div>
          </div>

          {/* Event selector */}
          <div className="space-y-2">
            <Label className="text-xs">Events to Subscribe</Label>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {WEBHOOK_EVENTS.map((evt) => (
                <label
                  key={evt}
                  className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-muted/40"
                  data-testid={`checkbox-webhook-${evt}`}
                >
                  <input
                    type="checkbox"
                    checked={webhookEvents.includes(evt)}
                    onChange={(e) =>
                      setWebhookEvents((prev) =>
                        e.target.checked ? [...prev, evt] : prev.filter((x) => x !== evt)
                      )
                    }
                    className="rounded"
                  />
                  <code className="text-[11px] font-mono text-muted-foreground">{evt}</code>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 border border-border p-3 text-[11px] text-muted-foreground space-y-1">
            <p className="font-medium text-foreground text-xs">Payload signature</p>
            <p>Every request includes an <code className="bg-muted px-1 rounded">X-HireCommand-Signature</code> header — HMAC-SHA256 of the raw body, signed with your API key. Verify on your server before processing.</p>
          </div>
        </CardContent>
      </Card>

      {/* User Management — admin only */}
      {adminUser && <UserManagementCard />}
    </div>
  );
}

// ── User Management (admin only) ──────────────────────────────────────────────

interface AppUser {
  id: number;
  username: string;
  email: string | null;
  role: string;
  recruiterName: string | null;
}

function UserManagementCard() {
  const { toast } = useToast();
  const { data: users = [], refetch } = useQuery<AppUser[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const r = await fetch("/api/users", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load users");
      return r.json();
    },
  });

  const [creating, setCreating] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRecruiter, setNewRecruiter] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [newPass, setNewPass] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: newEmail,
          username: newEmail,
          password: newPass,
          role: newRole,
          recruiterName: newRecruiter || null,
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || "Failed to create user");
      }
      return r.json();
    },
    onSuccess: () => {
      refetch();
      setCreating(false);
      setNewEmail(""); setNewName(""); setNewRecruiter(""); setNewRole("user"); setNewPass("");
      toast({ title: "User created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) => {
      const r = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      if (!r.ok) throw new Error("Failed to reset password");
    },
    onSuccess: () => toast({ title: "Password reset" }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function handleReset(user: AppUser) {
    const pw = window.prompt(`Enter new password for ${user.email ?? user.username}:`);
    if (pw) resetMutation.mutate({ id: user.id, password: pw });
  }

  return (
    <Card className="border border-card-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">User Management</CardTitle>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setCreating(v => !v)}>
            <Plus size={12} />
            Add User
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {creating && (
          <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/20">
            <p className="text-xs font-medium">New User</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@example.com" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Recruiter Name</Label>
                <Input value={newRecruiter} onChange={e => setNewRecruiter(e.target.value)} placeholder="e.g. Andrew" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Temporary Password</Label>
                <Input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="••••••••" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Role</Label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  className="h-8 text-sm w-full rounded-md border border-input bg-background px-2"
                >
                  <option value="user">Recruiter</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => createMutation.mutate()} disabled={!newEmail || !newPass || createMutation.isPending}>
                {createMutation.isPending ? "Creating…" : "Create"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </div>
        )}

        <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between px-4 py-3 bg-background">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {(u.recruiterName ?? u.username)[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{u.recruiterName ?? u.username}</p>
                  <p className="text-xs text-muted-foreground">{u.email ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-[10px]">
                  {u.role === "admin" ? "Admin" : "Recruiter"}
                </Badge>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleReset(u)}>
                  Reset PW
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
