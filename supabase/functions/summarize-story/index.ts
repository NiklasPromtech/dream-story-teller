import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { storyId, transcript, previousSummary } = await req.json();

    if (!storyId || !transcript) {
      throw new Error("storyId and transcript are required");
    }

    // Use Lovable AI to generate a summary
    const aiResponse = await fetch(
      `https://ukemnjdclpmrqaumhkuf.supabase.co/functions/v1/ai`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `You are a story summarizer. Given a bedtime story transcript, create a concise summary (max 500 words) that captures:
1. Main characters and their personalities/relationships
2. Key plot points and world details
3. Any recurring themes, jokes, or elements the child seemed to enjoy
4. Where the story left off

This summary will be used to continue the story in future sessions, so focus on details that help maintain continuity. Write in present tense as a reference document, not as a story.${
                previousSummary
                  ? `\n\nPrevious episodes summary:\n${previousSummary}`
                  : ""
              }`,
            },
            {
              role: "user",
              content: `Here is the transcript of the latest bedtime story episode:\n\n${transcript}`,
            },
          ],
          model: "google/gemini-2.5-flash",
        }),
      }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI summarization error:", errorText);
      throw new Error("Failed to generate summary");
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content || "";

    // Save summary to database
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: updateError } = await supabaseAdmin
      .from("stories")
      .update({ story_summary: summary })
      .eq("id", storyId);

    if (updateError) {
      console.error("Failed to save summary:", updateError);
      throw new Error("Failed to save summary");
    }

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Summarize error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
