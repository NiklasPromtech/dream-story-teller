import { useCallback, useState, useRef, useEffect } from "react";
import { useConversation } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Mic, MicOff, Send, Play, Square, Download, FileText } from "lucide-react";

interface EventLogEntry {
  timestamp: string;
  type: string;
  payload: string;
}

const StoryModeV2 = () => {
  // -- Pre-session config state --
  const [prompt, setPrompt] = useState(
    `You are a gentle, warm bedtime storyteller for a 4-year-old child. Tell a bedtime story about a magical adventure. The story should be about 3 minutes long when spoken aloud. Start telling the story immediately.`
  );
  const [language, setLanguage] = useState("en");
  const [stability, setStability] = useState(0.6);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [speed, setSpeed] = useState(0.95);
  const [topic, setTopic] = useState("a magical adventure");
  const [age, setAge] = useState(4);
  const [length, setLength] = useState("short");

  // -- Session state --
  const [isConnecting, setIsConnecting] = useState(false);
  const [signedUrlResponse, setSignedUrlResponse] = useState<string | null>(null);
  const [startPayload, setStartPayload] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  const [textMessage, setTextMessage] = useState("");
  const [micMuted, setMicMuted] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventLogEndRef = useRef<HTMLDivElement>(null);

  // -- Post-session state --
  const [fetchTranscriptResult, setFetchTranscriptResult] = useState<string | null>(null);
  const [summarizeResult, setSummarizeResult] = useState<string | null>(null);
  const [isFetchingTranscript, setIsFetchingTranscript] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [storyId, setStoryId] = useState<string | null>(null);

  // -- Collapsible state --
  const [preOpen, setPreOpen] = useState(true);
  const [liveOpen, setLiveOpen] = useState(true);
  const [postOpen, setPostOpen] = useState(true);

  // Auto-scroll event log
  useEffect(() => {
    eventLogEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [eventLog]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const addEvent = useCallback((type: string, payload: unknown) => {
    setEventLog((prev) => [
      ...prev,
      {
        timestamp: new Date().toISOString().split("T")[1].slice(0, 12),
        type,
        payload: JSON.stringify(payload, null, 2),
      },
    ]);
  }, []);

  const conversation = useConversation({
    micMuted,
    onConnect: () => {
      addEvent("CONNECTED", {});
      setElapsedSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => (prev !== null ? prev + 1 : 0));
      }, 1000);
    },
    onDisconnect: (details: any) => {
      addEvent("DISCONNECTED", details || {});
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    },
    onError: (error) => {
      addEvent("ERROR", { error: String(error) });
    },
    onDebug: (info: any) => {
      addEvent("DEBUG", info);
    },
    onMessage: (message: any) => {
      addEvent(message.type || "UNKNOWN", message);
      if (message.type === "conversation_initiation_metadata") {
        const convId = message.conversation_initiation_metadata_event?.conversation_id;
        if (convId) setConversationId(convId);
      }
    },
  });

  const startSession = useCallback(async () => {
    setIsConnecting(true);
    setSignedUrlResponse(null);
    setStartPayload(null);
    setConversationId(null);
    setEventLog([]);
    setElapsedSeconds(null);
    setFetchTranscriptResult(null);
    setSummarizeResult(null);

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      addEvent("MIC_PERMISSION", { granted: true });

      const { data, error } = await supabase.functions.invoke(
        "elevenlabs-conversation-token",
        { body: { topic, length, age } }
      );

      if (error || !data?.signed_url) {
        addEvent("TOKEN_ERROR", { error: error?.message || "No signed_url" });
        setIsConnecting(false);
        return;
      }

      setSignedUrlResponse(JSON.stringify(data, null, 2));
      addEvent("SIGNED_URL_RECEIVED", { signed_url: data.signed_url.slice(0, 80) + "..." });

      const overrides = {
        agent: {
          prompt: { prompt },
          language,
        },
        tts: {
          stability,
          similarityBoost,
          speed,
        },
      };

      const payload = { signedUrl: "...", overrides };
      setStartPayload(JSON.stringify(payload, null, 2));
      addEvent("START_SESSION_PAYLOAD", payload);

      await conversation.startSession({
        signedUrl: data.signed_url,
        overrides,
      });
    } catch (err: any) {
      addEvent("START_ERROR", { error: err?.message || String(err) });
    } finally {
      setIsConnecting(false);
    }
  }, [conversation, prompt, language, stability, similarityBoost, speed, topic, length, age, addEvent]);

  const endSession = useCallback(async () => {
    try {
      const convId = conversation.getId();
      if (convId) setConversationId(convId);
    } catch (e) {}
    addEvent("END_SESSION_REQUESTED", {});
    try {
      await conversation.endSession();
    } catch (e: any) {
      addEvent("END_SESSION_ERROR", { error: e?.message });
    }
  }, [conversation, addEvent]);

  const sendText = useCallback(() => {
    if (!textMessage.trim()) return;
    conversation.sendUserMessage(textMessage.trim());
    addEvent("SENT_TEXT", { text: textMessage.trim() });
    setTextMessage("");
  }, [conversation, textMessage, addEvent]);

  const fetchTranscript = useCallback(async () => {
    if (!conversationId) return;
    setIsFetchingTranscript(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-transcript", {
        body: { conversationId },
      });
      const result = error ? { error: error.message } : data;
      setFetchTranscriptResult(JSON.stringify(result, null, 2));
      addEvent("FETCH_TRANSCRIPT_RESPONSE", result);
    } catch (err: any) {
      setFetchTranscriptResult(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setIsFetchingTranscript(false);
    }
  }, [conversationId, addEvent]);

  const summarize = useCallback(async () => {
    if (!conversationId) return;
    setIsSummarizing(true);

    // Create a story record first if we don't have one
    let sid = storyId;
    if (!sid) {
      try {
        const { data } = await supabase
          .from("stories")
          .insert({ topic, length, age })
          .select("id")
          .single();
        if (data) {
          sid = data.id;
          setStoryId(data.id);
        }
      } catch (e) {
        addEvent("CREATE_STORY_ERROR", { error: String(e) });
      }
    }

    // First fetch transcript
    try {
      const { data: transcriptData } = await supabase.functions.invoke("fetch-transcript", {
        body: { conversationId },
      });

      const transcript = transcriptData?.transcript || "";
      addEvent("SUMMARIZE_TRANSCRIPT", { length: transcript.length });

      const { data, error } = await supabase.functions.invoke("summarize-story", {
        body: {
          storyId: sid,
          transcript,
          previousSummary: "",
          episodeNumber: 1,
        },
      });
      const result = error ? { error: error.message } : data;
      setSummarizeResult(JSON.stringify(result, null, 2));
      addEvent("SUMMARIZE_RESPONSE", result);
    } catch (err: any) {
      setSummarizeResult(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setIsSummarizing(false);
    }
  }, [conversationId, storyId, topic, length, age, addEvent]);

  const isConnected = conversation.status === "connected";
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 max-w-4xl mx-auto font-mono text-sm">
      <h1 className="text-xl font-bold mb-4">🛠 ElevenLabs Debug Dashboard (v2)</h1>

      {/* ========== PRE-SESSION ========== */}
      <Collapsible open={preOpen} onOpenChange={setPreOpen} className="mb-4">
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer flex flex-row items-center gap-2">
              {preOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <CardTitle className="text-base">1. Pre-Session Configuration</CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Topic</Label>
                  <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
                </div>
                <div>
                  <Label>Age</Label>
                  <Input type="number" value={age} onChange={(e) => setAge(Number(e.target.value))} min={1} max={12} />
                </div>
                <div>
                  <Label>Length</Label>
                  <Input value={length} onChange={(e) => setLength(e.target.value)} placeholder="test|short|medium|long" />
                </div>
              </div>

              <div>
                <Label>Prompt (sent as agent.prompt.prompt override)</Label>
                <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={6} className="font-mono text-xs" />
              </div>

              <div>
                <Label>Language (agent.language)</Label>
                <Input value={language} onChange={(e) => setLanguage(e.target.value)} className="w-32" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>TTS Stability: {stability.toFixed(2)}</Label>
                  <Slider value={[stability]} onValueChange={([v]) => setStability(v)} min={0} max={1} step={0.01} />
                </div>
                <div>
                  <Label>TTS Similarity Boost: {similarityBoost.toFixed(2)}</Label>
                  <Slider value={[similarityBoost]} onValueChange={([v]) => setSimilarityBoost(v)} min={0} max={1} step={0.01} />
                </div>
                <div>
                  <Label>TTS Speed: {speed.toFixed(2)}</Label>
                  <Slider value={[speed]} onValueChange={([v]) => setSpeed(v)} min={0.5} max={2.0} step={0.05} />
                </div>
              </div>

              <Button onClick={startSession} disabled={isConnecting || isConnected} className="gap-2">
                <Play className="h-4 w-4" />
                {isConnecting ? "Connecting…" : "Start Session"}
              </Button>

              {startPayload && (
                <div>
                  <Label className="text-muted-foreground">startSession payload:</Label>
                  <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-48">{startPayload}</pre>
                </div>
              )}

              {signedUrlResponse && (
                <div>
                  <Label className="text-muted-foreground">Signed URL response:</Label>
                  <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-32">{signedUrlResponse}</pre>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ========== LIVE SESSION ========== */}
      <Collapsible open={liveOpen} onOpenChange={setLiveOpen} className="mb-4">
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer flex flex-row items-center gap-2">
              {liveOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <CardTitle className="text-base">2. Live Session</CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Status bar */}
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
                  {conversation.status}
                </span>
                <span>Speaking: <strong>{conversation.isSpeaking ? "YES" : "no"}</strong></span>
                {conversationId && <span>ConvID: <code className="bg-muted px-1 rounded">{conversationId}</code></span>}
                {elapsedSeconds !== null && <span>Elapsed: {formatTime(elapsedSeconds)}</span>}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                <Button
                  variant={micMuted ? "destructive" : "secondary"}
                  size="sm"
                  onClick={() => setMicMuted(!micMuted)}
                  className="gap-1"
                >
                  {micMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                  {micMuted ? "Muted" : "Unmuted"}
                </Button>

                <Button variant="destructive" size="sm" onClick={endSession} disabled={!isConnected} className="gap-1">
                  <Square className="h-3 w-3" />
                  End Session
                </Button>
              </div>

              {/* Text input */}
              <div className="flex gap-2">
                <Input
                  value={textMessage}
                  onChange={(e) => setTextMessage(e.target.value)}
                  placeholder="Send a text message to the agent…"
                  onKeyDown={(e) => e.key === "Enter" && sendText()}
                  disabled={!isConnected}
                />
                <Button size="sm" onClick={sendText} disabled={!isConnected || !textMessage.trim()}>
                  <Send className="h-3 w-3" />
                </Button>
              </div>

              {/* Event log */}
              <div>
                <Label className="text-muted-foreground">Event Log ({eventLog.length} events)</Label>
                <ScrollArea className="h-64 border rounded bg-muted/50">
                  <div className="p-2 space-y-1">
                    {eventLog.length === 0 && (
                      <p className="text-muted-foreground text-xs italic">No events yet. Start a session.</p>
                    )}
                    {eventLog.map((entry, i) => (
                      <details key={i} className="text-xs">
                        <summary className="cursor-pointer hover:bg-muted rounded px-1">
                          <span className="text-muted-foreground">{entry.timestamp}</span>{" "}
                          <span className="font-semibold">{entry.type}</span>
                        </summary>
                        <pre className="pl-4 text-xs overflow-auto max-h-32 whitespace-pre-wrap">{entry.payload}</pre>
                      </details>
                    ))}
                    <div ref={eventLogEndRef} />
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ========== POST-SESSION ========== */}
      <Collapsible open={postOpen} onOpenChange={setPostOpen} className="mb-4">
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer flex flex-row items-center gap-2">
              {postOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <CardTitle className="text-base">3. Post-Session</CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="text-xs text-muted-foreground">
                Conversation ID: {conversationId ? <code className="bg-muted px-1 rounded">{conversationId}</code> : "—"}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchTranscript}
                  disabled={!conversationId || isFetchingTranscript}
                  className="gap-1"
                >
                  <Download className="h-3 w-3" />
                  {isFetchingTranscript ? "Fetching…" : "Fetch Transcript"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={summarize}
                  disabled={!conversationId || isSummarizing}
                  className="gap-1"
                >
                  <FileText className="h-3 w-3" />
                  {isSummarizing ? "Summarizing…" : "Summarize & Save"}
                </Button>
              </div>

              {fetchTranscriptResult && (
                <div>
                  <Label className="text-muted-foreground">fetch-transcript response:</Label>
                  <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-64 whitespace-pre-wrap">{fetchTranscriptResult}</pre>
                </div>
              )}

              {summarizeResult && (
                <div>
                  <Label className="text-muted-foreground">summarize-story response:</Label>
                  <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-64 whitespace-pre-wrap">{summarizeResult}</pre>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
};

export default StoryModeV2;
