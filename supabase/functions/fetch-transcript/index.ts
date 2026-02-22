import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    const { conversationId } = await req.json();
    if (!conversationId) {
      throw new Error("conversationId is required");
    }

    // ElevenLabs may take a moment to process the conversation after it ends.
    // Retry a few times with a delay.
    let transcript = "";
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      attempts++;
      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
        { headers: { "xi-api-key": ELEVENLABS_API_KEY } }
      );

      if (!response.ok) {
        const text = await response.text();
        console.error(`ElevenLabs API error (attempt ${attempts}):`, response.status, text);
        // Don't retry on 404 — conversation doesn't exist
        if (response.status === 404) {
          return new Response(JSON.stringify({ transcript: "", status: "not_found" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const data = await response.json();
      console.log("Conversation status:", data.status, "transcript entries:", data.transcript?.length || 0);

      if (data.status === "done" && data.transcript && data.transcript.length > 0) {
        // Build transcript from the conversation data
        transcript = data.transcript
          .map((entry: { role: string; message: string }) => {
            const speaker = entry.role === "agent" ? "Storyteller" : "Child";
            return `${speaker}: ${entry.message}`;
          })
          .join("\n");
        break;
      }

      // If still processing, wait and retry
      if (attempts < maxAttempts) {
        console.log(`Conversation not ready yet (status: ${data.status}), retrying in 3s...`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    if (!transcript.trim()) {
      console.log("No transcript found after all attempts");
      return new Response(JSON.stringify({ transcript: "", status: "empty" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ transcript, status: "ok" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Fetch transcript error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
