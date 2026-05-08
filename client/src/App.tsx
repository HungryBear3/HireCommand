import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import AppSidebar from "@/components/AppSidebar";
import VoiceCommand from "@/components/VoiceCommand";
import CommandBar from "@/components/CommandBar";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Candidates from "@/pages/candidates";
import Jobs from "@/pages/jobs";
import Opportunities from "@/pages/opportunities";
import Outreach from "@/pages/outreach";
import AIAssistant from "@/pages/ai-assistant";
import Reports from "@/pages/reports";
import MarketIntelligence from "@/pages/market-intelligence";
import IntelligenceHub from "@/pages/intelligence-hub";
import Settings from "@/pages/settings";
import Interviews from "@/pages/interviews";
import ClientPortal from "@/pages/client-portal";
import Revenue from "@/pages/revenue";
import Source from "@/pages/source";
import Invoices from "@/pages/invoices";
import Scheduling from "@/pages/scheduling";
import TalentRediscovery from "@/pages/rediscovery";
import Login from "@/pages/login";
import { useCurrentUser } from "@/lib/auth";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/candidates" component={Candidates} />
      <Route path="/jobs" component={Jobs} />
      <Route path="/opportunities" component={Opportunities} />
      <Route path="/outreach" component={Outreach} />
      <Route path="/ai" component={AIAssistant} />
      <Route path="/reports" component={Reports} />
      <Route path="/market-intelligence" component={MarketIntelligence} />
      <Route path="/intelligence" component={IntelligenceHub} />
      <Route path="/interviews" component={Interviews} />
      <Route path="/source" component={Source} />
      <Route path="/clients" component={ClientPortal} />
      <Route path="/revenue" component={Revenue} />
      <Route path="/invoices" component={Invoices} />
      <Route path="/settings" component={Settings} />
      <Route path="/scheduling" component={Scheduling} />
      <Route path="/rediscovery" component={TalentRediscovery} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <AuthGate>
            <div className="flex min-h-screen">
              <Router hook={useHashLocation}>
                <AppSidebar />
                <main className="flex-1 ml-[220px] p-6 overflow-auto">
                  <AppRouter />
                </main>
                <VoiceCommand />
                <CommandBar />
              </Router>
            </div>
          </AuthGate>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
