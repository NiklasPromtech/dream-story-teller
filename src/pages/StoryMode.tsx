import { useCallback, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useConversation } from "@elevenlabs/react";
import { motion } from "framer-motion";
import { Moon, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const StoryMode = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { topic, length } = (location.state as { topic: string; length: string }) || {};
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [connectionFailed, setConnectionFailed] = useState(false);

  const conversation = useConversation({
    onConnect: () => {
      console.log("Connected to storyteller");
      setHasStarted(true);
    },
    onDisconnect: () => {
      console.log("Disconnected from storyteller");
    },
    onError: (error) => {
      console.error("Conversation error:", error);
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Could not connect to the storyteller. Please try again.",
      });
    },
  });

  // Redirect if no topic
  useEffect(() => {
    if (!topic) navigate("/");
  }, [topic, navigate]);

  const startConversation = useCallback(async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    setConnectionFailed(false);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const { data, error } = await supabase.functions.invoke("elevenlabs-conversation-token", {
        body: { topic, length },
      });

      if (error || !data?.token) {
        throw new Error(error?.message || "No token received");
      }

      await conversation.startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
      });
    } catch (err: any) {
      console.error("Failed to start:", err);
      setConnectionFailed(true);
      const isPermissionError = err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError";
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
    await conversation.endSession();
    navigate("/");
  }, [conversation, navigate]);

  // Auto-start on mount
  useEffect(() => {
    if (topic && !hasStarted && !isConnecting) {
      startConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic]);

  const isActive = conversation.status === "connected";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      {/* Subtle moon glow */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
        className="relative"
      >
        {/* Glow ring */}
        <motion.div
          animate={{
            scale: conversation.isSpeaking ? [1, 1.3, 1] : [1, 1.1, 1],
            opacity: conversation.isSpeaking ? [0.3, 0.6, 0.3] : [0.1, 0.2, 0.1],
          }}
          transition={{ duration: conversation.isSpeaking ? 1.5 : 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full bg-primary/20 blur-3xl"
          style={{ width: 200, height: 200, left: -60, top: -60 }}
        />

        <motion.div
          animate={{
            scale: conversation.isSpeaking ? [1, 1.05, 1] : 1,
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Moon className="h-20 w-20 text-muted-foreground/30" />
        </motion.div>
      </motion.div>

      {/* Status text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-8 text-sm text-muted-foreground/50"
      >
        {connectionFailed
          ? "Something went wrong"
          : isConnecting
            ? "Preparing your story…"
            : isActive
              ? conversation.isSpeaking
                ? "Telling your story…"
                : "Listening…"
              : "Connecting…"}
      </motion.p>

      {/* Retry / Stop buttons */}
      <div className="mt-16 flex gap-4">
        {connectionFailed && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={startConversation}
            className="flex h-14 items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-6 text-sm text-primary transition-all hover:bg-primary/20"
          >
            Retry
          </motion.button>
        )}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: connectionFailed ? 0 : 2 }}
          onClick={stopConversation}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-border/50 bg-card/50 text-muted-foreground/50 transition-all hover:border-destructive/50 hover:text-destructive/80"
          aria-label="Stop story"
        >
          <Square className="h-5 w-5 fill-current" />
        </motion.button>
      </div>
    </div>
  );
};

export default StoryMode;
