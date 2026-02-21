import { useCallback, useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useConversation } from "@elevenlabs/react";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Square, Home, Play, Timer, Send, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const LENGTH_MINUTES: Record<string, number> = {
  short: 3,
  medium: 7,
  long: 15,
};

const StoryMode = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { topic, length, age, storyId, episodeCount, isNew, previousSummary } =
    (location.state as {
      topic: string;
      length: string;
      age?: number;
      storyId?: string;
      episodeCount?: number;
      isNew: boolean;
      previousSummary?: string;
    }) || {};
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [connectionFailed, setConnectionFailed] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [fadeReady, setFadeReady] = useState(false);
  const [sleepRemaining, setSleepRemaining] = useState<number | null>(null);
  const [secondsSinceConnect, setSecondsSinceConnect] = useState<number | null>(null);
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [currentStoryId, setCurrentStoryId] = useState<string | undefined>(storyId);
  const savedRef = useRef(false);
  const sleepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectTimeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const wrapUpSentRef = useRef(false);
  const transcriptRef = useRef<string[]>([]);
  const summarySentRef = useRef(false);
  const currentStoryIdRef = useRef<string | undefined>(storyId);
  const isStoppedRef = useRef(false);
  const sleepRemainingRef = useRef<number>(0);

  // Fade-to-black entrance: brief black overlay then reveal
  useEffect(() => {
    const t = setTimeout(() => setFadeReady(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Sleep timer
  const startSleepTimer = useCallback((minutes: number) => {
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    sleepRemainingRef.current = minutes * 60;
    setSleepRemaining(sleepRemainingRef.current);
    sleepTimerRef.current = setInterval(() => {
      sleepRemainingRef.current -= 1;
      setSleepRemaining(sleepRemainingRef.current);
      if (sleepRemainingRef.current <= 0) {
        if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
        sleepTimerRef.current = null;
        setSleepRemaining(null);
      }
    }, 1000);
  }, []);

  // Wrap-up nudge and auto-stop
  useEffect(() => {
    if (sleepRemaining === 60 && !wrapUpSentRef.current && !isStoppedRef.current) {
      wrapUpSentRef.current = true;
      conversation.sendUserMessage("You have about 1 minute left. Please start wrapping up the story with a gentle, satisfying ending now.");
    }
    if (sleepRemaining === 0 && !isStoppedRef.current) {
      isStoppedRef.current = true;
      setIsStopped(true);
      conversation.endSession();
      toast({ title: "Goodnight 🌙", description: "The story has ended. Sweet dreams!" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleepRemaining]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
      if (connectTimeRef.current) clearInterval(connectTimeRef.current);
    };
  }, []);

  const extendStory = useCallback((minutes: number) => {
    const addSeconds = minutes * 60;
    sleepRemainingRef.current += addSeconds;
    setSleepRemaining(sleepRemainingRef.current);
    // Restart the interval if it was already cleared (timer hit 0)
    if (!sleepTimerRef.current) {
      sleepTimerRef.current = setInterval(() => {
        sleepRemainingRef.current -= 1;
        setSleepRemaining(sleepRemainingRef.current);
        if (sleepRemainingRef.current <= 0) {
          if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
          sleepTimerRef.current = null;
          setSleepRemaining(null);
        }
      }, 1000);
    }
    toast({ title: `+${minutes} min`, description: `Story extended by ${minutes} minutes.` });
  }, [toast]);


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
            episode_count: (episodeCount || 1) + 1,
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
    const transcript = transcriptRef.current.join("\n");
    if (!sid || !transcript) {
      console.log("saveSummary skipped: no storyId or transcript", { sid, transcriptLen: transcript.length });
      return;
    }
    summarySentRef.current = true;
    try {
      console.log("Calling summarize-story for storyId:", sid);
      const { data, error } = await supabase.functions.invoke("summarize-story", {
        body: { 
          storyId: sid, 
          transcript, 
          previousSummary: previousSummary || "",
          episodeNumber: episodeCount ? (isNew ? 1 : (episodeCount + 1)) : 1,
        },
      });
      if (error) {
        console.error("Summarize-story error:", error);
      } else {
        console.log("Story summary saved:", data);
      }
    } catch (err) {
      console.error("Failed to save summary:", err);
    }
  }, [previousSummary, episodeCount, isNew]);

  const ageLabel = age || 4;
  const durationMinutes = LENGTH_MINUTES[length] || 7;
  const storyPrompt = `You are a gentle, warm bedtime storyteller for a ${ageLabel}-year-old child. ${
    ageLabel <= 3
      ? "Use very short sentences, simple words, repetition, and animal sounds. Keep it extremely simple and soothing."
      : ageLabel <= 5
        ? "Use short sentences, familiar words, and playful language. Avoid any scary or complex concepts."
        : ageLabel <= 8
          ? "You can use moderately complex sentences and introduce some imaginative vocabulary, but keep things age-appropriate and calming."
          : "You can use richer vocabulary and more detailed storytelling, but keep the tone warm and bedtime-appropriate."
  } Tell a bedtime story about: ${topic || "a magical adventure"}. IMPORTANT: The story MUST be exactly ${durationMinutes} minutes long when spoken aloud. Pace yourself carefully — begin winding down the story naturally as you approach the end. Do NOT ask questions or wait for input. Start telling the story immediately.${
    previousSummary
      ? `\n\nIMPORTANT CONTINUITY: This is a continuing story. Here is what happened in previous episodes — use these characters, relationships, and world details to continue the story naturally:\n${previousSummary}`
      : ""
  }`;

  const conversation = useConversation({
    onConnect: () => {
      console.log("Connected to storyteller");
      setHasStarted(true);
      setConnectionFailed(false);
      saveStory();
      wrapUpSentRef.current = false;
      summarySentRef.current = false;
      transcriptRef.current = [];
      // Auto-start sleep timer based on story length
      const mins = LENGTH_MINUTES[length] || 7;
      startSleepTimer(mins);
      // Track time since connect for contextual buttons
      setSecondsSinceConnect(0);
      if (connectTimeRef.current) clearInterval(connectTimeRef.current);
      connectTimeRef.current = setInterval(() => {
        setSecondsSinceConnect((prev) => (prev !== null ? prev + 1 : null));
      }, 1000);
    },
    onDisconnect: () => {
      console.log("Disconnected from storyteller");
      saveSummary();
      if (!isStoppedRef.current && hasStarted) {
        setConnectionFailed(true);
        toast({
          variant: "destructive",
          title: "Connection Lost",
          description: "The storyteller disconnected. Tap retry to reconnect.",
        });
      }
    },
    onError: (error) => {
      console.error("Conversation error:", error);
      setConnectionFailed(true);
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Could not connect to the storyteller. Please try again.",
      });
    },
    onMessage: (message: any) => {
      if (message.type === "agent_response") {
        transcriptRef.current.push(`Storyteller: ${message.agent_response_event?.agent_response || ""}`);
      } else if (message.type === "user_transcript") {
        transcriptRef.current.push(`Child: ${message.user_transcription_event?.user_transcript || ""}`);
      }
    },
  });

  const triggerStartStory = useCallback(() => {
    conversation.sendUserMessage(`Please start telling the story now.`);
  }, [conversation]);

  const extendStoryVoice = useCallback((minutes: number) => {
    extendStory(minutes);
    conversation.sendUserMessage(`Please make the story ${minutes} minutes longer.`);
  }, [conversation, extendStory]);

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
      console.log("Connecting via WebSocket...");
      await conversation.startSession({
        signedUrl: data.signed_url,
        overrides: {
          agent: {
            prompt: {
              prompt: storyPrompt,
            },
            firstMessage: previousSummary
              ? `Welcome back! Let me continue our story about ${topic || "a magical adventure"} from where we left off...`
              : `Okay, let me tell you a wonderful bedtime story about ${topic || "a magical adventure"}...`,
          },
        },
      });
    } catch (err: any) {
      console.error("Failed to start:", err);
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
  }, [conversation, topic, length, isConnecting, toast]);

  const stopConversation = useCallback(async () => {
    isStoppedRef.current = true;
    setIsStopped(true);
    saveSummary();
    await conversation.endSession();
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    sleepTimerRef.current = null;
    setSleepRemaining(null);
  }, [conversation, saveSummary]);

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
    // Connection timeout: if still not connected after 20s, show retry
    const timeout = setTimeout(() => {
      if (!hasStarted && conversation.status !== "connected" && !isStopped && !connectionFailed) {
        setConnectionFailed(true);
        toast({
          variant: "destructive",
          title: "Connection Timeout",
          description: "Taking too long to connect. Tap retry to try again.",
        });
      }
    }, 20000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic]);

  const isActive = conversation.status === "connected";

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

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
        {/* Sleep timer display */}
        <AnimatePresence>
          {sleepRemaining !== null && sleepRemaining > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed top-6 right-6 flex items-center gap-2 text-xs text-muted-foreground/40"
            >
              <Timer className="h-3 w-3" />
              {formatTime(sleepRemaining)}
            </motion.div>
          )}
        </AnimatePresence>

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
                    : "Listening…"
                  : "Connecting…"}
        </motion.p>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5 }}
          className="mt-16 flex flex-col items-center gap-4"
        >
          {isStopped && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <button
                onClick={resumeConversation}
                className="flex h-14 items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-6 text-sm text-primary transition-all hover:bg-primary/20"
              >
                <Play className="h-4 w-4" />
                Resume
              </button>
              <button
                onClick={goHome}
                className="flex h-14 items-center gap-2 rounded-full border border-border/50 bg-card/50 px-6 text-sm text-muted-foreground transition-all hover:border-primary/30 hover:text-foreground"
              >
                <Home className="h-4 w-4" />
                New Story
              </button>
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
              {secondsSinceConnect !== null && secondsSinceConnect <= 10 && (
                <button
                  onClick={triggerStartStory}
                  className="flex h-10 items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-5 text-xs text-primary transition-all hover:bg-primary/20"
                >
                  <Play className="h-3 w-3" />
                  Start Story
                </button>
              )}
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
    </>
  );
};

export default StoryMode;
