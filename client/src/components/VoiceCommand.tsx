import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, X, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type VoiceState = "idle" | "listening" | "processing" | "result";

interface VoiceResult {
  understood: string;
  action: string;
}

function parseVoiceCommand(transcript: string): VoiceResult {
  const t = transcript.toLowerCase();
  if (t.includes("sarah") || t.includes("chen")) {
    return { understood: `Adding note to Sarah Chen`, action: "Navigate to candidate profile and open notes editor" };
  }
  if (t.includes("david") || t.includes("okafor")) {
    return { understood: `Generating summary for David Okafor`, action: "Opening AI candidate brief with career analysis" };
  }
  if (t.includes("summary") || t.includes("brief")) {
    return { understood: `Generating candidate brief`, action: "Opening AI-powered candidate summary panel" };
  }
  if (t.includes("search") && (t.includes("vp") || t.includes("finance") || t.includes("cfo"))) {
    return { understood: `Searching for finance candidates`, action: "Filtering candidates by finance leadership roles" };
  }
  if (t.includes("texas") || t.includes("dallas") || t.includes("houston") || t.includes("austin")) {
    return { understood: `Searching for candidates in Texas`, action: "Applying location filter: Texas" };
  }
  if (t.includes("market") || t.includes("intelligence")) {
    return { understood: `Opening Market Intelligence`, action: "Navigating to talent flows and market data" };
  }
  if (t.includes("outreach") || t.includes("email") || t.includes("draft")) {
    return { understood: `Drafting outreach message`, action: "Opening AI outreach composer with context" };
  }
  if (t.includes("pipeline") || t.includes("report")) {
    return { understood: `Generating pipeline report`, action: "Building real-time pipeline analytics view" };
  }
  return { understood: `Processing: "${transcript}"`, action: "Analyzing request and determining best action..." };
}

export default function VoiceCommand() {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<VoiceResult | null>(null);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setSupported(false);
  }, []);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      setTranscript(text);
    };

    recognition.onend = () => {
      setState("processing");
      setTimeout(() => {
        setState("result");
      }, 800);
    };

    recognition.onerror = () => {
      setState("idle");
      setTranscript("");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setState("listening");
    setTranscript("");
    setResult(null);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const processCommand = useCallback(() => {
    const r = parseVoiceCommand(transcript);
    setResult(r);
    setState("result");
  }, [transcript]);

  const close = useCallback(() => {
    recognitionRef.current?.stop();
    setState("idle");
    setTranscript("");
    setResult(null);
  }, []);

  if (!supported) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="icon"
          className="h-12 w-12 rounded-full bg-muted text-muted-foreground cursor-not-allowed shadow-lg"
          disabled
          title="Voice not supported in this browser"
          data-testid="button-voice-unsupported"
        >
          <MicOff size={20} />
        </Button>
      </div>
    );
  }

  if (state === "idle") {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="icon"
          onClick={startListening}
          className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 transition-all hover:scale-105"
          data-testid="button-voice-command"
        >
          <Mic size={20} />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80">
      <Card className="border border-card-border shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-primary/5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              state === "listening" ? "bg-red-500 animate-pulse" : "bg-primary"
            )} />
            <span className="text-xs font-medium">
              {state === "listening" ? "Listening..." : state === "processing" ? "Processing..." : "Command Result"}
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={close} data-testid="button-voice-close">
            <X size={12} />
          </Button>
        </div>

        <CardContent className="p-4 space-y-3">
          {/* Waveform animation */}
          {state === "listening" && (
            <div className="flex items-center justify-center gap-1 h-10">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-1 bg-primary rounded-full"
                  style={{
                    animation: `voiceWave 0.6s ease-in-out ${i * 0.1}s infinite alternate`,
                    height: "8px",
                  }}
                />
              ))}
            </div>
          )}

          {/* Processing spinner */}
          {state === "processing" && (
            <div className="flex items-center justify-center h-10">
              <Loader2 size={20} className="text-primary animate-spin" />
            </div>
          )}

          {/* Transcript */}
          {transcript && (
            <div className="text-sm text-foreground bg-muted/50 rounded-md px-3 py-2">
              "{transcript}"
            </div>
          )}

          {/* Controls */}
          {state === "listening" && (
            <Button
              size="sm"
              variant="destructive"
              className="w-full gap-2"
              onClick={stopListening}
              data-testid="button-voice-stop"
            >
              <Square size={12} /> Stop Recording
            </Button>
          )}

          {state === "processing" && transcript && (
            <Button
              size="sm"
              className="w-full gap-2"
              onClick={processCommand}
              data-testid="button-voice-process"
            >
              Process Command
            </Button>
          )}

          {/* Result card */}
          {state === "result" && result && (
            <div className="space-y-2">
              <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                <p className="text-sm font-medium text-primary">{result.understood}</p>
                <p className="text-xs text-muted-foreground">{result.action}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 text-xs" onClick={close} data-testid="button-voice-done">
                  Done
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={startListening} data-testid="button-voice-retry">
                  New Command
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function useVoiceInput(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggle = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      onTranscript(text);
    };

    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [listening, onTranscript]);

  return { listening, toggle };
}
