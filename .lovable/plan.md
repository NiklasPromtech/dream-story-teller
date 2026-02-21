
# Story Topics, Episodes, and Character Tracking

## Overview
Transform the current flat story list into a richer system where stories are grouped as "topics" (series), each containing multiple episodes (sessions). Each episode stores structured data including a summary, characters, and a session name -- all extracted by the AI summarizer.

## What Changes

### 1. New Database Table: `story_episodes`
A new table to store individual episode/session data, while `stories` becomes the "topic/series" table.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| story_id | uuid (FK -> stories.id) | Which topic this belongs to |
| episode_number | integer | Auto-incremented per story |
| session_name | text | AI-generated episode title |
| summary | text | Episode-specific summary |
| characters | jsonb | Array of {name, description} |
| transcript | text | Raw transcript for reference |
| created_at | timestamptz | |

The existing `stories` table keeps `topic`, `length`, `age`, `episode_count`, `story_summary` (now becomes a rolling cumulative summary), and `last_played_at`.

### 2. Update the Summarize Edge Function
Change the AI prompt to return structured JSON instead of plain text:

```text
{
  "summary": "What happened this episode...",
  "session_name": "The Shadow Academy Opens",
  "characters": [
    { "name": "Sonic", "description": "A fast blue hedgehog who loves adventure" },
    { "name": "Shadow", "description": "Sonic's rival who runs an academy for kids" }
  ]
}
```

The edge function will:
- Parse the structured JSON from the AI
- Insert a new row into `story_episodes` with the episode data
- Update the parent `stories.story_summary` with the cumulative summary (combining previous + new)

### 3. New Pages and Navigation

**Home page (`/`)** -- Topics list:
- Shows story topics as cards (like now, but as "series")
- Each card shows: topic name, episode count, age, last played, and a small character avatar row
- Tapping a topic goes to the Topic Detail page
- "Continue" button still available for quick access to start next episode

**Topic Detail page (`/story/:id`)** -- New page:
- Header with topic name, age, total episodes
- **Characters section**: Shows all unique characters across all episodes with name and description. Tapping a character shows which episodes they appeared in.
- **Episodes list**: Scrollable list of past episodes showing session name, date, and a brief summary preview
- "Play Next Episode" button at the bottom
- Option to replay from any specific episode's context

**Story Mode (`/story-mode`)** -- Existing page, minor updates:
- After session ends, saves structured episode data instead of just a plain summary

### 4. Character Tracking
Characters are extracted per-episode and stored in the `story_episodes.characters` JSONB column. On the Topic Detail page, characters are aggregated across all episodes to build a "cast" view. Tapping a character shows their description and lists which episodes they appeared in.

---

## Technical Details

### Database Migration
```sql
CREATE TABLE story_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  episode_number integer NOT NULL DEFAULT 1,
  session_name text,
  summary text,
  characters jsonb DEFAULT '[]'::jsonb,
  transcript text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE story_episodes ENABLE ROW LEVEL SECURITY;
-- Public read/insert/update policies (matching stories table pattern)
```

### Edge Function Changes (`summarize-story/index.ts`)
- Update the AI system prompt to request structured JSON output
- Parse the JSON response
- Insert into `story_episodes` table
- Update cumulative `stories.story_summary`

### New Files
- `src/pages/TopicDetail.tsx` -- Topic detail page with episodes list and character gallery
- Update `src/App.tsx` -- Add route for `/topic/:id`
- Update `src/pages/Index.tsx` -- Refactor to show topics as series cards, link to topic detail
- Update `src/pages/StoryMode.tsx` -- Pass episode data to edge function, handle structured response

### Route Structure
```
/              -- Home (topic list + new story setup)
/topic/:id     -- Topic detail (episodes, characters)
/story         -- Story playback mode (existing)
```
