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

    const ELEVENLABS_AGENT_ID = Deno.env.get("ELEVENLABS_AGENT_ID");
    if (!ELEVENLABS_AGENT_ID) {
      throw new Error("ELEVENLABS_AGENT_ID is not configured");
    }

    const { topic, length, age } = await req.json();
    const childAge = age || 4;

    // Build age-appropriate prompt override
    const agePrompt = `You are a gentle bedtime storyteller for a ${childAge}-year-old child. Use simple vocabulary and sentence structures appropriate for age ${childAge}. ${
      childAge <= 3
        ? "Use very short sentences, simple words, repetition, and animal sounds. Keep it extremely simple and soothing."
        : childAge <= 5
          ? "Use short sentences, familiar words, and playful language. Avoid any scary or complex concepts."
          : childAge <= 8
            ? "You can use moderately complex sentences and introduce some imaginative vocabulary, but keep things age-appropriate and calming."
            : "You can use richer vocabulary and more detailed storytelling, but keep the tone warm and bedtime-appropriate."
    } The story theme is: ${topic || "a magical adventure"}. Story length: ${length || "medium"}.`;

    // Get conversation token with overrides
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${ELEVENLABS_AGENT_ID}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("ElevenLabs token error:", response.status, text);
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const { token } = await response.json();

    return new Response(JSON.stringify({ token, overrides: { prompt: agePrompt } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Token generation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
