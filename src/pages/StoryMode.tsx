import { useCallback, useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useConversation } from "@elevenlabs/react";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Square, Home, Play, Send, MessageSquare, BookOpen, SkipForward, Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";


const StoryMode = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { topic, length, age, storyId, episodeCount, isNew, previousSummary, episodeTheme, language } =
    (location.state as {
      topic: string;
      length: string;
      age?: number;
      storyId?: string;
      episodeCount?: number;
      isNew: boolean;
      previousSummary?: string;
      episodeTheme?: string;
      language?: string;
    }) || {};
  const storyLanguage = language || "en";
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [connectionFailed, setConnectionFailed] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [fadeReady, setFadeReady] = useState(false);
  const [secondsSinceConnect, setSecondsSinceConnect] = useState<number | null>(null);
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [currentStoryId, setCurrentStoryId] = useState<string | undefined>(storyId);
  const [liveTranscript, setLiveTranscript] = useState<string[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef(false);
  const hasStartedRef = useRef(false);
  const connectTimeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef<string[]>([]);
  const summarySentRef = useRef(false);
  const currentStoryIdRef = useRef<string | undefined>(storyId);
  const isStoppedRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasSpeakingRef = useRef(false);
  const nextEpisodeRef = useRef(false);
  const conversationIdRef = useRef<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const reconnectCountRef = useRef(0);
  const connectStartTimeRef = useRef<number | null>(null);
  const [micMuted, setMicMuted] = useState(true);
  const [savingEpisode, setSavingEpisode] = useState(false);

  // Fade-to-black entrance: brief black overlay then reveal
  useEffect(() => {
    const t = setTimeout(() => setFadeReady(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (connectTimeRef.current) clearInterval(connectTimeRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);


  // Auto-scroll transcript to bottom
  useEffect(() => {
    if (showTranscript) {
      transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [liveTranscript, showTranscript]);


  // Save or update story in DB when conversation starts
  const saveStory = useCallback(async () => {
    if (savedRef.current) return;
    savedRef.current = true;
    try {
      if (isNew) {
        const { data } = await supabase.from("stories").insert({ topic, length, age: age || 4 }).select("id").single();
        if (data) {
          setCurrentStoryId(data.id);
          currentStoryIdRef.current = data.id;
        }
      } else if (storyId) {
        await supabase
          .from("stories")
          .update({
            last_played_at: new Date().toISOString(),
          })
          .eq("id", storyId);
      }
    } catch (err) {
      console.error("Failed to save story:", err);
    }
  }, [isNew, storyId, topic, length, episodeCount, age]);

  // Save summary when story ends
  const saveSummary = useCallback(async () => {
    if (summarySentRef.current) return;
    const sid = currentStoryIdRef.current;
    
    // Try local transcript first
    let transcript = transcriptRef.current.join("\n");
    
    // If local transcript is empty, fetch from ElevenLabs API
    if (!transcript.trim() && conversationIdRef.current) {
      console.log("Local transcript empty, fetching from ElevenLabs API. conversationId:", conversationIdRef.current);
      try {
        const { data, error } = await supabase.functions.invoke("fetch-transcript", {
          body: { conversationId: conversationIdRef.current },
        });
        if (error) {
          console.error("fetch-transcript error:", error);
        } else if (data?.transcript) {
          transcript = data.transcript;
          console.log("Fetched transcript from API, length:", transcript.length);
        }
      } catch (err) {
        console.error("Failed to fetch transcript:", err);
      }
    }
    
    if (!sid || !transcript.trim()) {
      console.log("saveSummary skipped: no storyId or transcript", { sid, transcriptLen: transcript.length });
      return;
    }
    summarySentRef.current = true;
    console.log("Calling summarize-story for storyId:", sid, "transcript length:", transcript.length);
    try {
      const { data, error } = await supabase.functions.invoke("summarize-story", {
        body: { 
          storyId: sid, 
          transcript, 
          previousSummary: previousSummary || "",
          episodeNumber: episodeCount ? (isNew ? 1 : (episodeCount + 1)) : 1,
          conversationId: conversationIdRef.current,
        },
      });
      if (error) {
        console.error("Summarize-story error:", error);
        toast({ variant: "destructive", title: "Save failed", description: "Could not save the episode summary. The transcript was still recorded." });
        summarySentRef.current = false; // Allow retry
      } else {
        console.log("Story summary saved:", data);
        toast({ title: "Episode saved ✨", description: "Your story episode has been saved." });
      }
    } catch (err) {
      console.error("Failed to save summary:", err);
      summarySentRef.current = false; // Allow retry
    }
  }, [previousSummary, episodeCount, isNew, toast]);

  const ageLabel = age || 4;
  const durationMinutes = length === "test" ? 0.17 : length === "short" ? 3 : length === "long" ? 15 : 7;
  const languageInstruction = storyLanguage === "sv" ? "IMPORTANT: Tell the entire story in Swedish. All narration, dialogue, and goodnight messages must be in Swedish.\n\n" : "";
  const storyPrompt = `${languageInstruction}You are a gentle, warm bedtime storyteller for a ${ageLabel}-year-old child. ${
    ageLabel <= 3
      ? "Use very short sentences, simple words, repetition, and animal sounds. Keep it extremely simple and soothing."
      : ageLabel <= 5
        ? "Use short sentences, familiar words, and playful language. Avoid any scary or complex concepts."
        : ageLabel <= 8
          ? "You can use moderately complex sentences and introduce some imaginative vocabulary, but keep things age-appropriate and calming."
          : "You can use richer vocabulary and more detailed storytelling, but keep the tone warm and bedtime-appropriate."
  } Tell a bedtime story about: ${topic || "a magical adventure"}. IMPORTANT: The story MUST be exactly ${durationMinutes} minutes long when spoken aloud. Pace yourself carefully — begin winding down the story naturally as you approach the end. Do NOT ask questions or wait for input. Do NOT prompt the listener with questions like "are you there?" or "shall I continue?" — just tell the story continuously. When the story reaches its natural end, say a warm goodnight message like "Goodnight, sweet dreams" and then STOP TALKING. Do not continue after saying goodnight. If the child or parent says anything like "goodnight", "I'm done", "that's enough", or "thank you", immediately wrap up with a brief gentle closing and stop. Start telling the story immediately.${
    previousSummary
      ? `\n\nIMPORTANT CONTINUITY: This is a continuing story. Here is what happened in previous episodes — use these characters, relationships, and world details to continue the story naturally:\n${previousSummary}`
      : ""
  }${
    episodeTheme
      ? `\n\nThe child's parent would like this episode to focus on: ${episodeTheme}`
      : ""
  }`;

  const conversation = useConversation({
    micMuted,
    onConnect: () => {
      const isReconnect = reconnectCountRef.current > 0;
      console.log(`[CONNECT] Connected to storyteller | timestamp: ${new Date().toISOString()} | isReconnect: ${isReconnect} | reconnectAttempt: ${reconnectCountRef.current} | transcriptLines: ${transcriptRef.current.length}`);
      reconnectCountRef.current = 0; // Reset on successful connect
      connectStartTimeRef.current = Date.now();
      setHasStarted(true);
      hasStartedRef.current = true;
      setConnectionFailed(false);
      saveStory();
      if (!transcriptRef.current.length) {
        summarySentRef.current = false;
      }
      setSecondsSinceConnect(0);
      if (connectTimeRef.current) clearInterval(connectTimeRef.current);
      connectTimeRef.current = setInterval(() => {
        setSecondsSinceConnect((prev) => (prev !== null ? prev + 1 : null));
      }, 1000);
      // Immediately prompt the AI to start narrating
      setTimeout(() => {
        console.log(`[CONNECT] Sending initial story prompt | isReconnect: ${isReconnect}`);
        conversation.sendUserMessage(isReconnect ? "Continue the story from where you left off." : "Please start telling the story now.");
      }, 500);
    },
    onDisconnect: (details: any) => {
      const elapsedMs = connectStartTimeRef.current ? Date.now() - connectStartTimeRef.current : 0;
      const elapsedSec = (elapsedMs / 1000).toFixed(1);
      console.warn(`[DISCONNECT] timestamp: ${new Date().toISOString()} | elapsed: ${elapsedSec}s | isStopped: ${isStoppedRef.current} | hasStarted: ${hasStartedRef.current} | transcriptLines: ${transcriptRef.current.length} | conversationId: ${conversationIdRef.current}`);
      console.warn(`[DISCONNECT] details:`, details);
      if (!isStoppedRef.current && hasStartedRef.current) {
        reconnectCountRef.current += 1;
        const attempt = reconnectCountRef.current;
        console.warn(`[RECONNECT] Attempt ${attempt}/3 | elapsed: ${elapsedSec}s | transcriptLines: ${transcriptRef.current.length}`);
        if (attempt > 3) {
          console.error("[RECONNECT] Max attempts (3) reached, giving up");
          toast({
            variant: "destructive",
            title: "Connection Lost",
            description: "Could not reconnect after 3 attempts. Please go back and try again.",
          });
          isStoppedRef.current = true;
          setIsStopped(true);
          return;
        }
        toast({
          title: `Reconnecting… (attempt ${attempt}/3)`,
          description: "The storyteller dropped briefly. Reconnecting now.",
        });
        setTimeout(() => {
          if (!isStoppedRef.current) {
            savedRef.current = true;
            startConversation();
          }
        }, 2000);
      }
    },
    onError: (error: any) => {
      const elapsedMs = connectStartTimeRef.current ? Date.now() - connectStartTimeRef.current : 0;
      console.error(`[ERROR] timestamp: ${new Date().toISOString()} | elapsed: ${(elapsedMs / 1000).toFixed(1)}s | isStopped: ${isStoppedRef.current} | status: ${conversation.status}`);
      console.error(`[ERROR] Full error:`, error);
      setConnectionFailed(true);
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Could not connect to the storyteller. Please try again.",
      });
    },
    onMessage: (message: any) => {
      // Log every message type with key fields
      if (message.type === "conversation_initiation_metadata") {
        const convId = message.conversation_initiation_metadata_event?.conversation_id;
        console.log(`[MSG] type: conversation_initiation_metadata | conversationId: ${convId}`);
        if (convId) {
          conversationIdRef.current = convId;
          setConversationId(convId);
        }
      } else if (message.type === "agent_response") {
        const text = message.agent_response_event?.agent_response || "";
        console.log(`[MSG] type: agent_response | length: ${text.length} | preview: "${text.slice(0, 80)}…"`);
      } else if (message.type === "agent_response_correction") {
        console.log(`[MSG] type: agent_response_correction`);
      } else if (message.type === "user_transcript") {
        const text = message.user_transcription_event?.user_transcript || "";
        console.log(`[MSG] type: user_transcript | text: "${text.slice(0, 80)}"`);
      } else {
        console.log(`[MSG] type: ${message.type}`);
      }
      if (message.type === "agent_response") {
        const text = message.agent_response_event?.agent_response || "";
        if (text.trim()) {
          transcriptRef.current.push(`Storyteller: ${text}`);
          setLiveTranscript((prev) => [...prev, text]);
        }
      } else if (message.type === "agent_response_correction") {
        const text = message.agent_response_correction_event?.corrected_agent_response || "";
        if (text.trim()) {
          transcriptRef.current.push(`Storyteller: ${text}`);
          setLiveTranscript((prev) => [...prev, text]);
        }
      } else if (message.type === "user_transcript") {
        const text = message.user_transcription_event?.user_transcript || "";
        if (text.trim()) {
          transcriptRef.current.push(`Child: ${text}`);
        }
      }
    },
  });

  const triggerStartStory = useCallback(() => {
    conversation.sendUserMessage(`Please start telling the story now.`);
   }, [conversation]);

  const extendStoryVoice = useCallback((minutes: number) => {
    conversation.sendUserMessage(`Please make the story ${minutes} minutes longer.`);
    toast({ title: `+${minutes} min`, description: `Story extended by ${minutes} minutes.` });
  }, [conversation, toast]);

  const sayGoodnight = useCallback(async () => {
    console.log(`[GOODNIGHT] Initiating goodnight | transcriptLines: ${transcriptRef.current.length} | storyId: ${currentStoryIdRef.current} | conversationId: ${conversationIdRef.current}`);
    toast({ title: "Goodnight 🌙", description: "Saving your story…" });
    isStoppedRef.current = true;
    setIsStopped(true);
    setSavingEpisode(true);
    // Capture conversation ID before ending session
    try {
      const convId = conversation.getId();
      if (convId) conversationIdRef.current = convId;
    } catch (e) { /* getId may not be available */ }
    try { await conversation.endSession(); } catch (e) { console.error("endSession error:", e); }
    console.log("sayGoodnight: calling saveSummary directly, transcript lines:", transcriptRef.current.length, "storyId:", currentStoryIdRef.current, "conversationId:", conversationIdRef.current);
    // Detach save from component lifecycle — runs even if user navigates away
    const savePromise = saveSummary();
    savePromise.finally(() => setSavingEpisode(false));
    await savePromise;
    navigate("/");
  }, [conversation, toast, saveSummary, navigate]);

  const startNextEpisode = useCallback(async (nextLength: string) => {
    toast({ title: "Next episode ⏭️", description: "Saving this episode and starting the next…" });
    isStoppedRef.current = true;
    setIsStopped(true);
    try {
      const convId = conversation.getId();
      if (convId) conversationIdRef.current = convId;
    } catch (e) { /* getId may not be available */ }
    try { await conversation.endSession(); } catch (e) { console.error("endSession error:", e); }
    console.log("startNextEpisode: calling saveSummary directly, transcript lines:", transcriptRef.current.length, "storyId:", currentStoryIdRef.current, "conversationId:", conversationIdRef.current);
    await saveSummary();
    const sid = currentStoryIdRef.current;
    if (!sid) { navigate("/"); return; }
    const { data: story } = await supabase.from("stories").select("*").eq("id", sid).single();
    if (!story) { navigate("/"); return; }
    navigate("/story", {
      replace: true,
      state: {
        topic,
        length: nextLength,
        age,
        storyId: sid,
        episodeCount: story.episode_count,
        isNew: false,
        previousSummary: story.story_summary,
      },
    });
    window.location.reload();
  }, [conversation, toast, navigate, topic, age, saveSummary]);

  const sendTextMessage = useCallback(() => {
    if (!textInput.trim()) return;
    conversation.sendUserMessage(textInput.trim());
    setTextInput("");
  }, [conversation, textInput]);

  const toggleTextInput = useCallback(() => {
    setShowTextInput((prev) => {
      if (!prev) setTimeout(() => textInputRef.current?.focus(), 100);
      return !prev;
    });
  }, []);

  useEffect(() => {
    if (!topic) navigate("/");
  }, [topic, navigate]);

  const startConversation = useCallback(async () => {
    if (isConnecting) return;
    const isReconnect = reconnectCountRef.current > 0;
    console.log(`[START] Starting conversation | isReconnect: ${isReconnect} | attempt: ${reconnectCountRef.current} | transcriptLines: ${transcriptRef.current.length}`);
    setIsConnecting(true);
    setConnectionFailed(false);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const { data, error } = await supabase.functions.invoke(
        "elevenlabs-conversation-token",
        { body: { topic, length, age: age || 4 } }
      );
      if (error || !data?.signed_url) {
        throw new Error(error?.message || "No signed URL received");
      }
      console.log(`[START] Got signed URL (${data.signed_url.slice(0, 60)}…) | isReconnect: ${isReconnect}`);
      
      // Build prompt with reconnection context if needed
      const reconnectContext = isReconnect && transcriptRef.current.length > 0
        ? `\n\nRECONNECTION: The connection was interrupted. Here is the story so far — continue EXACTLY from where you left off, do NOT repeat anything:\n${transcriptRef.current.slice(-10).join("\n")}`
        : "";
      const finalPrompt = storyPrompt + reconnectContext;
      if (isReconnect) {
        console.log(`[START] Reconnect prompt appended with ${transcriptRef.current.slice(-10).length} transcript lines`);
      }
      
      console.log(`[START] Connecting via WebSocket...`);
      await conversation.startSession({
        signedUrl: data.signed_url,
        overrides: {
          agent: {
            prompt: {
              prompt: finalPrompt,
            },
            language: storyLanguage,
          },
        },
      });
    } catch (err: any) {
      console.error("[START] Failed to start:", err);
      setConnectionFailed(true);
      const isPermissionError =
        err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError";
      toast({
        variant: "destructive",
        title: isPermissionError ? "Microphone Required" : "Connection Failed",
        description: isPermissionError
          ? "Please allow microphone access to use the storyteller."
          : "Could not start the story. Tap retry to try again.",
      });
    } finally {
      setIsConnecting(false);
    }
  }, [conversation, topic, length, isConnecting, toast, storyPrompt, storyLanguage, age]);

  const stopConversation = useCallback(async () => {
    isStoppedRef.current = true;
    setIsStopped(true);
    await conversation.endSession();
    // saveSummary is called from onDisconnect when isStoppedRef is true
  }, [conversation]);

  const goHome = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const resumeConversation = useCallback(async () => {
    isStoppedRef.current = false;
    setIsStopped(false);
    savedRef.current = true;
    await startConversation();
  }, [startConversation]);

  // Auto-start and connection timeout
  useEffect(() => {
    if (!topic) return;
    if (!hasStarted && !isConnecting) {
      startConversation();
    }
    // Connection timeout: if still not connected after 30s, show retry
    const timeout = setTimeout(() => {
      if (!hasStartedRef.current && !isStoppedRef.current) {
        setConnectionFailed(true);
        toast({
          variant: "destructive",
          title: "Connection Timeout",
          description: "Taking too long to connect. Tap retry to try again.",
        });
      }
    }, 30000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic]);

  const isActive = conversation.status === "connected";

  // Auto-end session after prolonged silence (story naturally finished)
  useEffect(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (conversation.isSpeaking) {
      console.log(`[SPEAKING] isSpeaking=true | elapsed: ${secondsSinceConnect}s`);
      wasSpeakingRef.current = true;
    } else if (
      wasSpeakingRef.current &&
      conversation.status === "connected" &&
      !isStoppedRef.current &&
      secondsSinceConnect !== null &&
      secondsSinceConnect > 30
    ) {
      console.log(`[SILENCE] Agent stopped speaking | elapsed: ${secondsSinceConnect}s | starting 15s silence timer`);
      // AI stopped speaking after having spoken — wait 15s of silence then auto-end
      silenceTimerRef.current = setTimeout(async () => {
        if (!isStoppedRef.current && !conversation.isSpeaking) {
          console.log(`[SILENCE] 15s silence timer fired — auto-ending session | elapsed: ${secondsSinceConnect}s`);
          isStoppedRef.current = true;
          setIsStopped(true);
          setSavingEpisode(true);
          try {
            const convId = conversation.getId();
            if (convId) conversationIdRef.current = convId;
          } catch (e) { /* getId may not be available */ }
          try { await conversation.endSession(); } catch (e) { console.error("endSession error:", e); }
          const savePromise = saveSummary();
          savePromise.finally(() => setSavingEpisode(false));
          await savePromise;
          navigate("/");
        }
      }, 15000);
    }
  }, [conversation.isSpeaking, conversation.status, secondsSinceConnect, conversation]);


  return (
    <>
      {/* Fade-from-black overlay */}
      <AnimatePresence>
        {!fadeReady && (
          <motion.div
            key="fade-overlay"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="fixed inset-0 z-50 bg-background"
          />
        )}
      </AnimatePresence>

      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">

        {/* Moon glow */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2, delay: 1 }}
          className="relative"
        >
          <motion.div
            animate={{
              scale: conversation.isSpeaking ? [1, 1.3, 1] : [1, 1.1, 1],
              opacity: conversation.isSpeaking ? [0.3, 0.6, 0.3] : [0.1, 0.2, 0.1],
            }}
            transition={{
              duration: conversation.isSpeaking ? 1.5 : 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute inset-0 rounded-full bg-primary/20 blur-3xl"
            style={{ width: 200, height: 200, left: -60, top: -60 }}
          />
          <motion.div
            animate={{ scale: conversation.isSpeaking ? [1, 1.05, 1] : 1 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Moon className="h-20 w-20 text-muted-foreground/30" />
          </motion.div>
        </motion.div>

        {/* Status */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="mt-8 text-sm text-muted-foreground/50"
        >
          {isStopped
            ? "Story paused"
            : connectionFailed
              ? "Something went wrong"
              : isConnecting
                ? "Preparing your story…"
                : isActive
                  ? conversation.isSpeaking
                    ? "Telling your story…"
                    : micMuted
                      ? "Hold mic to speak"
                      : "Listening…"
                  : "Connecting…"}
        </motion.p>

        {/* Live transcript */}
        <AnimatePresence>
          {showTranscript && liveTranscript.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 w-full max-w-md"
            >
              <ScrollArea className="h-40 rounded-xl border border-border/30 bg-card/30 px-4 py-3">
                <div className="space-y-2">
                  {liveTranscript.map((line, i) => (
                    <motion.p
                      key={i}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm leading-relaxed text-muted-foreground/70"
                    >
                      {line}
                    </motion.p>
                  ))}
                  <div ref={transcriptEndRef} />
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5 }}
          className="mt-16 flex flex-col items-center gap-4"
        >
          {isStopped && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
              <p className="text-xs text-muted-foreground/50 max-w-[250px] text-center">
                {savingEpisode
                  ? "Saving your episode…"
                  : "Your episode has been saved ✨"}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => startNextEpisode(length)}
                  disabled={savingEpisode}
                  className="flex h-14 items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-6 text-sm text-primary transition-all hover:bg-primary/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <SkipForward className="h-4 w-4" />
                  Next Episode
                </button>
                <button
                  onClick={goHome}
                  disabled={savingEpisode}
                  className="flex h-14 items-center gap-2 rounded-full border border-border/50 bg-card/50 px-6 text-sm text-muted-foreground transition-all hover:border-primary/30 hover:text-foreground active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {savingEpisode ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="h-4 w-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full"
                    />
                  ) : (
                    <Home className="h-4 w-4" />
                  )}
                  {savingEpisode ? "Saving…" : "Back"}
                </button>
              </div>
            </motion.div>
          )}

          {connectionFailed && !isStopped && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <button
                onClick={startConversation}
                className="flex h-14 items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-6 text-sm text-primary transition-all hover:bg-primary/20"
              >
                Retry
              </button>
              <button
                onClick={goHome}
                className="flex h-14 items-center gap-2 rounded-full border border-border/50 bg-card/50 px-6 text-sm text-muted-foreground transition-all hover:border-primary/30 hover:text-foreground"
              >
                <Home className="h-4 w-4" />
                Back
              </button>
            </motion.div>
          )}

          {!isStopped && !connectionFailed && isActive && !conversation.isSpeaking && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-wrap justify-center gap-2 mb-4"
            >
              {secondsSinceConnect !== null && secondsSinceConnect > 10 && (
                <>
                  {[3, 6, 9].map((m) => (
                    <button
                      key={m}
                      onClick={() => extendStoryVoice(m)}
                      className="flex h-10 items-center gap-1 rounded-full border border-border/50 bg-card/50 px-4 text-xs text-muted-foreground transition-all hover:border-primary/30 hover:text-foreground"
                    >
                      +{m} min
                    </button>
                  ))}
                  {[
                    { label: "3m", value: "short" },
                    { label: "7m", value: "medium" },
                    { label: "15m", value: "long" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => startNextEpisode(opt.value)}
                      className="flex h-10 items-center gap-1.5 rounded-full border border-border/50 bg-card/50 px-4 text-xs text-muted-foreground transition-all hover:border-primary/30 hover:text-foreground"
                    >
                      <SkipForward className="h-3 w-3" />
                      Next {opt.label}
                    </button>
                  ))}
                  <button
                    onClick={sayGoodnight}
                    className="flex h-10 items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-5 text-xs text-primary transition-all hover:bg-primary/20"
                  >
                    <Moon className="h-3 w-3" />
                    Goodnight
                  </button>
                </>
              )}
            </motion.div>
          )}

          {!isStopped && !connectionFailed && isActive && (
            <AnimatePresence>
              {showTextInput && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={(e) => { e.preventDefault(); sendTextMessage(); }}
                  className="flex w-full max-w-xs items-center gap-2 mb-4"
                >
                  <input
                    ref={textInputRef}
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Type a message…"
                    className="flex-1 rounded-full border border-border/50 bg-card/50 px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!textInput.trim()}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/50 bg-primary/10 text-primary transition-all hover:bg-primary/20 disabled:opacity-30"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          )}

          {!isStopped && !connectionFailed && (
            <div className="flex items-center gap-3">
              {isActive && (
                <button
                  onClick={toggleTextInput}
                  className={`flex h-14 w-14 items-center justify-center rounded-full border transition-all ${
                    showTextInput
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border/50 bg-card/50 text-muted-foreground/50 hover:border-primary/30 hover:text-muted-foreground"
                  }`}
                  aria-label="Toggle text input"
                >
                  <MessageSquare className="h-5 w-5" />
                </button>
              )}
              {isActive && (
                <button
                  onPointerDown={() => setMicMuted(false)}
                  onPointerUp={() => setMicMuted(true)}
                  onPointerLeave={() => setMicMuted(true)}
                  className={`flex h-14 w-14 items-center justify-center rounded-full border transition-all ${
                    !micMuted
                      ? "border-primary/50 bg-primary/10 text-primary scale-110"
                      : "border-border/50 bg-card/50 text-muted-foreground/50 hover:border-primary/30 hover:text-muted-foreground"
                  }`}
                  aria-label="Hold to talk"
                >
                  <Mic className="h-5 w-5" />
                </button>
              )}
              {isActive && (
                <button
                  onClick={() => setShowTranscript((p) => !p)}
                  className={`flex h-14 w-14 items-center justify-center rounded-full border transition-all ${
                    showTranscript
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border/50 bg-card/50 text-muted-foreground/50 hover:border-primary/30 hover:text-muted-foreground"
                  }`}
                  aria-label="Toggle transcript"
                >
                  <BookOpen className="h-5 w-5" />
                </button>
              )}
              <button
                onClick={stopConversation}
                className="flex h-14 w-14 items-center justify-center rounded-full border border-border/50 bg-card/50 text-muted-foreground/50 transition-all hover:border-destructive/50 hover:text-destructive/80"
                aria-label="Stop story"
              >
                <Square className="h-5 w-5 fill-current" />
              </button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Conversation ID bar */}
      {conversationId && (
        <div className="fixed bottom-2 left-0 right-0 flex justify-center pointer-events-none z-40">
          <span className="text-[10px] text-muted-foreground/30 font-mono select-all pointer-events-auto">
            {conversationId}
          </span>
        </div>
      )}
    </>
  );
};

export default StoryMode;
