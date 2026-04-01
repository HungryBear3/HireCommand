import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
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
} from "lucide-react";

const integrations = [
  { name: "Gmail", icon: Mail, connected: true, description: "Sync emails and calendar" },
  { name: "LinkedIn", icon: Linkedin, connected: true, description: "Import candidates and send InMails" },
  { name: "Calendar", icon: Calendar, connected: true, description: "Interview scheduling" },
  { name: "Loxo", icon: Link2, connected: true, description: "Talent intelligence and sourcing" },
];

const comingSoonIntegrations = [
  { name: "LinkedIn Recruiter", description: "Advanced recruiter seat integration" },
  { name: "QuickBooks", description: "Invoice and billing automation" },
  { name: "Google Workspace", description: "Docs, Sheets, and Drive sync" },
  { name: "Mailchimp", description: "Email campaign management" },
];

export default function Settings() {
  const { toast } = useToast();

  // Loxo state
  const [loxoApiKey, setLoxoApiKey] = useState("");
  const [loxoSlug, setLoxoSlug] = useState("the-hiring-advisors-1");
  const [isTesting, setIsTesting] = useState(false);
  const [syncStep, setSyncStep] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  function handleTestConnection() {
    setIsTesting(true);
    setTimeout(() => {
      setIsTesting(false);
      toast({
        title: "Connection successful!",
        description: "Found 1,247 candidates in your Loxo database.",
      });
    }, 1400);
  }

  async function handleSyncNow() {
    setIsSyncing(true);
    const steps = [
      "Syncing candidates...",
      "Syncing jobs...",
      "Syncing activities...",
      "Sync complete!",
    ];
    for (let i = 0; i < steps.length; i++) {
      setSyncStep(steps[i]);
      await new Promise((res) => setTimeout(res, 900));
    }
    setIsSyncing(false);
    setSyncStep(null);
    toast({
      title: "Sync complete!",
      description: "All Loxo data has been synchronized successfully.",
    });
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
                  <p className="text-xs text-muted-foreground mt-0.5">Sync candidates, jobs, and activities from your Loxo workspace</p>
                </div>
              </div>
              <Badge
                className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 flex-shrink-0"
                data-testid="badge-loxo-status"
              >
                Ready to Connect
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">API Key</Label>
                <Input
                  type="password"
                  placeholder="Enter your Loxo API key"
                  value={loxoApiKey}
                  onChange={(e) => setLoxoApiKey(e.target.value)}
                  className="h-9 text-sm"
                  data-testid="input-loxo-api-key"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Agency Slug</Label>
                <Input
                  type="text"
                  value={loxoSlug}
                  onChange={(e) => setLoxoSlug(e.target.value)}
                  className="h-9 text-sm"
                  data-testid="input-loxo-slug"
                />
              </div>
            </div>

            {syncStep && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background rounded-md px-3 py-2 border border-border" data-testid="text-sync-status">
                <Loader2 size={12} className="animate-spin text-primary flex-shrink-0" />
                {syncStep}
              </div>
            )}

            <div className="flex gap-2">
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
                  "Test Connection"
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
                  "Sync Now"
                )}
              </Button>
            </div>
          </div>

          {/* Existing simple integrations */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Connected Services</p>
            {integrations.map((int) => (
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
                  <Button size="sm" variant="outline" className="text-xs">
                    Connect
                  </Button>
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
