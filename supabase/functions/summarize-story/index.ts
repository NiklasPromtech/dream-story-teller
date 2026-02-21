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
    const { storyId, transcript, previousSummary, episodeNumber } = await req.json();

    if (!storyId || !transcript) {
      throw new Error("storyId and transcript are required");
    }

    // Use Lovable AI proxy to generate a structured summary
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `You are a story summarizer. Given a bedtime story transcript, return a JSON object with this exact structure (no markdown, no code fences, just raw JSON):

{
  "summary": "A concise summary (max 300 words) of what happened this episode. Write in present tense.",
  "session_name": "A short, evocative title for this episode (3-6 words)",
  "characters": [
    { "name": "Character Name", "description": "One sentence describing who they are and their role" }
  ]${!previousSummary ? `,
  "story_name": "A catchy, short series title for the whole storyline (3-8 words). Think Netflix show name.",
  "story_description": "A single sentence tagline/synopsis for the whole storyline. Enticing and brief."` : ""}
}

Focus on:
1. Key plot points and where the story left off
2. All named characters with clear descriptions
3. Recurring themes or elements the child enjoyed
4. Details that help maintain continuity${
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
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse the structured JSON response
    let parsed: { summary: string; session_name: string; characters: Array<{ name: string; description: string }>; story_name?: string; story_description?: string };
    try {
      // Strip any markdown code fences if present
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse AI JSON, falling back:", parseErr);
      parsed = {
        summary: rawContent,
        session_name: "Untitled Episode",
        characters: [],
      };
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Insert episode record
    const { error: episodeError } = await supabaseAdmin
      .from("story_episodes")
      .insert({
        story_id: storyId,
        episode_number: episodeNumber || 1,
        session_name: parsed.session_name,
        summary: parsed.summary,
        characters: parsed.characters,
        transcript,
      });

    if (episodeError) {
      console.error("Failed to save episode:", episodeError);
      throw new Error("Failed to save episode");
    }

    // Build cumulative summary for the parent story
    const cumulativeSummary = previousSummary
      ? `${previousSummary}\n\nEpisode ${episodeNumber || 1} - ${parsed.session_name}:\n${parsed.summary}`
      : `Episode ${episodeNumber || 1} - ${parsed.session_name}:\n${parsed.summary}`;

    // Update the parent story with cumulative summary (and name/description for first episode)
    const storyUpdate: Record<string, unknown> = { story_summary: cumulativeSummary };
    if (!previousSummary && parsed.story_name) {
      storyUpdate.story_name = parsed.story_name;
    }
    if (!previousSummary && parsed.story_description) {
      storyUpdate.story_description = parsed.story_description;
    }
    const { error: updateError } = await supabaseAdmin
      .from("stories")
      .update(storyUpdate)
      .eq("id", storyId);

    if (updateError) {
      console.error("Failed to update story summary:", updateError);
      throw new Error("Failed to update story summary");
    }

    // Increment episode_count only after successful save
    const { error: countError } = await supabaseAdmin
      .from("stories")
      .update({ episode_count: episodeNumber || 1 })
      .eq("id", storyId);

    if (countError) {
      console.error("Failed to update episode count:", countError);
    }

    return new Response(JSON.stringify({ 
      summary: parsed.summary,
      session_name: parsed.session_name,
      characters: parsed.characters,
      story_name: parsed.story_name,
      story_description: parsed.story_description,
    }), {
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
