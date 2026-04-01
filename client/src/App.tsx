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
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
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
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
