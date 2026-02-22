

# Display Conversation ID in v1 and Save It With Episode Data

## What Changes

### 1. Show conversation ID on screen (v1 StoryMode)
A small, unobtrusive bar at the bottom of the story screen that displays the `conv_` ID as soon as it's captured. This gives you immediate confirmation the session is properly connected and tracked.

### 2. Save conversation ID with episode data
Store the `conversationId` in the `story_episodes` table so you can look up any episode's full conversation in ElevenLabs later.

### 3. Fix TTS overrides causing instant disconnect
Remove the `tts` overrides (`stability`, `similarityBoost`, `speed`) from v1's `startSession` call -- same fix we discovered in v2.

## Technical Details

### Database Migration
Add a `conversation_id` text column to `story_episodes`:

```sql
ALTER TABLE story_episodes ADD COLUMN conversation_id text;
```

### `src/pages/StoryMode.tsx`
1. **Remove TTS overrides** from `startSession` (lines 344-349) -- keeps only `agent` overrides which are allowed.
2. **Add state** for `conversationId` (currently only stored in a ref, need a reactive state to display it).
3. **Display conversation ID** at the bottom of the screen -- a small fixed bar showing `conv_XXXX` when available, hidden otherwise.
4. **Pass `conversationId` to `summarize-story`** so it gets saved with the episode.

### `supabase/functions/summarize-story/index.ts`
Accept the optional `conversationId` field from the request body and include it in the `story_episodes` insert.

### Flow
1. Session connects
2. `conversation_initiation_metadata` message arrives with `conversation_id`
3. ID is stored in ref (for API calls) AND state (for display)
4. Bottom bar shows `conv_XXXX`
5. When session ends, `conversationId` is sent alongside the transcript to `summarize-story`
6. Edge function saves it into `story_episodes.conversation_id`

