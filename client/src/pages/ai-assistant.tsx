import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
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

const suggestionChips = [
  { label: "Find candidates", icon: Users },
  { label: "Draft outreach", icon: Mail },
  { label: "Pipeline summary", icon: BarChart3 },
  { label: "Interview prep", icon: FileText },
];

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Ask me to search candidates, summarize pipeline, find client contacts, prep for interviews, or draft outreach from live CRM data.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const { listening, toggle: toggleVoice } = useVoiceInput((text) => setInput(text));

  const handleSend = async () => {
    const message = input.trim();
    if (!message || isSending) return;

    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setInput("");
    setIsSending(true);

    try {
      const response = await apiRequest("POST", "/api/ai-assistant", { message });
      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.content || "I searched the CRM, but did not get a usable response.",
          cards: data.cards,
          email: data.email,
        },
      ]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: error?.message || "AI assistant request failed. Please try again.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
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
            placeholder={isSending ? "Searching live CRM data..." : "Ask about your candidates, pipeline, or business..."}
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
        <Button onClick={handleSend} size="icon" data-testid="button-send-message" disabled={isSending || !input.trim()}>
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
}
