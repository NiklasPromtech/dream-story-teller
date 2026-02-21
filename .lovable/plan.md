

# AI-Generated Story Names and Descriptions

## Problem
When a story is created, the home page shows the raw topic prompt (e.g., "Tell me a story about dragons who live in a volcano and have to save their baby dragon from an evil wizard") as the title. This can be very long and isn't very appealing. Instead, the AI should generate a proper storyline name and short description after the first episode.

## Changes

### 1. Database: Add `story_name` and `story_description` columns to `stories`

```sql
ALTER TABLE public.stories
  ADD COLUMN story_name text,
  ADD COLUMN story_description text;
```

These are nullable so existing stories keep working. The home page falls back to `topic` when `story_name` is not yet set.

### 2. Edge Function: Return storyline metadata on Episode 1

Update `supabase/functions/summarize-story/index.ts`:

- When `episodeNumber === 1` (or there's no `previousSummary`), add two extra fields to the AI prompt:
  - `"story_name"`: A catchy, short series title (3-8 words), like a Netflix show name
  - `"story_description"`: A one-sentence tagline/synopsis for the whole storyline

- After parsing, if it's the first episode, update the `stories` table with `story_name` and `story_description` alongside the existing `story_summary` update.

- Return the new fields in the response so the client can use them immediately if needed.

### 3. Home Page (`Index.tsx`): Display story name and description

- Show `story.story_name` as the card title, falling back to `story.topic` if not yet generated
- Show `story.story_description` as a subtitle line under the title (if available)
- This replaces the potentially very long raw prompt with a clean, AI-generated name

### 4. Topic Detail Page (`TopicDetail.tsx`): Use story name as heading

- Display `story.story_name` as the page heading (fall back to `story.topic`)
- Show `story.story_description` as a subtitle below the heading
- Add the "Synopsis" section using `story.story_summary` (the cumulative episode summaries)

## Technical Details

### Updated AI prompt structure (for episode 1 only)

The JSON schema requested from the AI will include two extra fields when it's the first episode:

```json
{
  "summary": "...",
  "session_name": "...",
  "characters": [...],
  "story_name": "The Dragon's Cradle",
  "story_description": "A family of volcano dragons must outwit an ancient wizard to rescue their youngest hatchling."
}
```

For subsequent episodes, these fields are omitted from the prompt (the story already has its name).

### Files changed

- **Database migration**: Add two columns to `stories`
- **`supabase/functions/summarize-story/index.ts`**: Conditionally request and save storyline name/description for first episodes
- **`src/pages/Index.tsx`**: Display `story_name` with fallback to `topic`, show `story_description`
- **`src/pages/TopicDetail.tsx`**: Use `story_name` as heading, add description and synopsis sections
- **`src/integrations/supabase/types.ts`**: Will auto-update after migration
