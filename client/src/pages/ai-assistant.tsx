import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, User, Sparkles, Mail, Users, BarChart3, FileText, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceInput } from "@/components/VoiceCommand";

interface Message {
  role: "user" | "assistant";
  content: string;
  cards?: CandidateCard[];
  email?: string;
}

interface CandidateCard {
  name: string;
  title: string;
  score: number;
  reason: string;
}

const sampleConversation: Message[] = [
  {
    role: "user",
    content: "Who are my strongest CFO candidates for the Acme Corp search?",
  },
  {
    role: "assistant",
    content: "Based on the Acme Health Solutions CFO requirements (PE-backed healthcare, $400M revenue, exit prep), here are your top 3 matches:",
    cards: [
      {
        name: "Sarah Chen",
        title: "CFO — Meridian Health Partners",
        score: 96,
        reason: "Led $200M debt refinancing. Direct PE healthcare experience. Currently in 2nd interview stage.",
      },
      {
        name: "Jennifer Park",
        title: "CFO — Summit Capital Portfolio Co",
        score: 94,
        reason: "Managed PE exit at $800M valuation. Strong turnaround and cost optimization track record.",
      },
      {
        name: "Patricia Huang",
        title: "CFO — Vanguard Industrial Solutions",
        score: 93,
        reason: "Led 3 successful PE exits. Exceptional carve-out experience, though in industrial rather than healthcare.",
      },
    ],
  },
  {
    role: "user",
    content: "Draft an outreach email to Sarah Chen about the CFO role",
  },
  {
    role: "assistant",
    content: "Here's a personalized outreach draft based on Sarah's background and the Acme Health role:",
    email: `Subject: Confidential CFO Opportunity — PE-Backed Healthcare IT ($400M Revenue)

Hi Sarah,

I hope this finds you well. I've been following Meridian Health Partners' impressive growth, and your work on the $200M debt refinancing caught my attention.

I'm working exclusively with a Thoma Bravo portfolio company in the healthcare IT space — $400M in revenue, growing rapidly, and preparing for a potential exit within 18-24 months. They're seeking a CFO who brings exactly the kind of PE-backed healthcare finance leadership you've demonstrated at Meridian.

Given your experience with complex capital structures and your Deloitte advisory background, I believe this could be a compelling next chapter. The compensation package is highly competitive with significant equity upside tied to the exit.

Would you be open to a confidential conversation this week? I can share more details about the specific opportunity and the PE sponsor's value creation thesis.

Best regards,
Andrew
The Hiring Advisors`,
  },
];

const suggestionChips = [
  { label: "Find candidates", icon: Users },
  { label: "Draft outreach", icon: Mail },
  { label: "Pipeline summary", icon: BarChart3 },
  { label: "Interview prep", icon: FileText },
];

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>(sampleConversation);
  const [input, setInput] = useState("");
  const { listening, toggle: toggleVoice } = useVoiceInput((text) => setInput(text));

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: input },
      {
        role: "assistant",
        content: "I'm analyzing your request across your CRM data, candidate pipeline, and activity history. In the full version, I would provide real-time insights powered by your complete recruitment database.",
      },
    ]);
    setInput("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      {/* Header */}
      <div className="mb-4">
        <h1 className="font-display font-bold text-xl flex items-center gap-2">
          <Sparkles size={18} className="text-primary" />
          AI Assistant
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Ask anything about your candidates, pipeline, or business development
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}>
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                msg.role === "assistant" ? "bg-primary/10" : "bg-muted"
              )}
            >
              {msg.role === "assistant" ? (
                <Bot size={14} className="text-primary" />
              ) : (
                <User size={14} className="text-muted-foreground" />
              )}
            </div>
            <div className={cn("max-w-[80%] space-y-3", msg.role === "user" && "text-right")}>
              <div
                className={cn(
                  "inline-block rounded-lg px-3.5 py-2.5 text-sm",
                  msg.role === "assistant"
                    ? "bg-card border border-card-border text-left"
                    : "bg-primary text-primary-foreground"
                )}
              >
                {msg.content}
              </div>

              {/* Candidate Cards */}
              {msg.cards && (
                <div className="space-y-2">
                  {msg.cards.map((card, j) => (
                    <Card key={j} className="border border-card-border text-left">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold">{card.name}</span>
                          <Badge className="text-[10px] bg-primary/10 text-primary border-0">
                            {card.score}% match
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">{card.title}</p>
                        <p className="text-xs text-muted-foreground">{card.reason}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Email Draft */}
              {msg.email && (
                <Card className="border border-card-border text-left">
                  <CardContent className="p-3">
                    <pre className="text-xs whitespace-pre-wrap font-sans text-muted-foreground leading-relaxed">
                      {msg.email}
                    </pre>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="gap-1.5 text-xs" data-testid="button-send-email">
                        <Send size={11} /> Send
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs">
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs">
                        Copy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Suggestion Chips */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {suggestionChips.map((chip) => (
          <Button
            key={chip.label}
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7"
            onClick={() => setInput(chip.label)}
            data-testid={`chip-${chip.label.toLowerCase().replace(/\s/g, "-")}`}
          >
            <chip.icon size={11} />
            {chip.label}
          </Button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about your candidates, pipeline, or business..."
            className="pr-10"
            data-testid="input-ai-chat"
          />
          <button
            onClick={toggleVoice}
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors",
              listening ? "text-red-500 animate-pulse" : "text-muted-foreground hover:text-primary"
            )}
            data-testid="button-ai-voice"
            title={listening ? "Stop recording" : "Voice input"}
          >
            <Mic size={14} />
          </button>
        </div>
        <Button onClick={handleSend} size="icon" data-testid="button-send-message">
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
}
