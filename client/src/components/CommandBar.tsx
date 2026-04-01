import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Users,
  Briefcase,
  FileText,
  Sparkles,
  Send,
  BarChart3,
  Globe,
  Settings,
  LayoutDashboard,
  Bot,
  TrendingUp,
  Mic,
  Search,
} from "lucide-react";
import { useVoiceInput } from "@/components/VoiceCommand";

export default function CommandBar() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const { listening, toggle: toggleVoice } = useVoiceInput(
    useCallback((text: string) => setSearch(text), [])
  );

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const navigate = (path: string) => {
    setLocation(path);
    setOpen(false);
    setSearch("");
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <div className="flex items-center border-b px-3">
        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        <input
          className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Type a command or search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-command-bar"
        />
        <button
          onClick={toggleVoice}
          className={`p-1.5 rounded-md transition-colors ml-1 ${
            listening ? "text-red-500 animate-pulse" : "text-muted-foreground hover:text-primary"
          }`}
          data-testid="button-command-voice"
          title="Voice input"
        >
          <Mic size={14} />
        </button>
      </div>
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => navigate("/")} data-testid="cmd-dashboard">
            <LayoutDashboard size={14} className="mr-2" />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => navigate("/candidates")} data-testid="cmd-candidates">
            <Users size={14} className="mr-2" />
            Search candidates...
          </CommandItem>
          <CommandItem onSelect={() => navigate("/jobs")} data-testid="cmd-jobs">
            <Briefcase size={14} className="mr-2" />
            Search jobs...
          </CommandItem>
          <CommandItem onSelect={() => navigate("/opportunities")} data-testid="cmd-opportunities">
            <TrendingUp size={14} className="mr-2" />
            Opportunities
          </CommandItem>
          <CommandItem onSelect={() => navigate("/outreach")} data-testid="cmd-outreach">
            <Send size={14} className="mr-2" />
            Outreach
          </CommandItem>
          <CommandItem onSelect={() => navigate("/market-intelligence")} data-testid="cmd-market-intel">
            <Globe size={14} className="mr-2" />
            Market Intelligence
          </CommandItem>
          <CommandItem onSelect={() => navigate("/reports")} data-testid="cmd-reports">
            <BarChart3 size={14} className="mr-2" />
            Reports
          </CommandItem>
          <CommandItem onSelect={() => navigate("/settings")} data-testid="cmd-settings">
            <Settings size={14} className="mr-2" />
            Settings
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="AI Actions">
          <CommandItem onSelect={() => navigate("/ai")} data-testid="cmd-ai-assistant">
            <Bot size={14} className="mr-2" />
            Open AI Assistant
          </CommandItem>
          <CommandItem onSelect={() => { setOpen(false); }} data-testid="cmd-generate-summary">
            <Sparkles size={14} className="mr-2" />
            Generate summary...
          </CommandItem>
          <CommandItem onSelect={() => { setOpen(false); }} data-testid="cmd-draft-outreach">
            <FileText size={14} className="mr-2" />
            Draft outreach...
          </CommandItem>
          <CommandItem onSelect={() => { setOpen(false); }} data-testid="cmd-create-note">
            <FileText size={14} className="mr-2" />
            Create note...
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
