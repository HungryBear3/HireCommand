import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
} from "lucide-react";

const comingSoonIntegrations = [
  { name: "LinkedIn Recruiter", description: "Advanced recruiter seat integration" },
  { name: "QuickBooks", description: "Invoice and billing automation" },
  { name: "Google Workspace", description: "Docs, Sheets, and Drive sync" },
  { name: "Mailchimp", description: "Email campaign management" },
];

interface SyncStatus {
  lastSync: string | null;
  candidatesSynced: number;
  jobsSynced: number;
  isRunning: boolean;
}

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
              <p className="font-semibold">Andrew</p>
              <p className="text-sm text-muted-foreground">Managing Partner — The Hiring Advisors</p>
            </div>
          </div>
          <Separator />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Full Name</Label>
              <Input defaultValue="Andrew" className="h-9 text-sm" data-testid="input-full-name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input defaultValue="andrew@thehiringadvisors.com" className="h-9 text-sm" data-testid="input-email" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Company</Label>
              <Input defaultValue="The Hiring Advisors" className="h-9 text-sm" data-testid="input-company" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Input defaultValue="Managing Partner" className="h-9 text-sm" data-testid="input-role" />
            </div>
          </div>
          <Button size="sm" data-testid="button-save-profile">Save Changes</Button>
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
    </div>
  );
}
