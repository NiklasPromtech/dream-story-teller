

# Home Page Improvements: Grouping, Episode Prompts, and Deletion

## Overview
Three changes to improve the home page experience:
1. Group similar story topics together visually
2. Add an "episode prompt" step before starting the next episode
3. Allow deleting duplicate or empty story topics

---

## 1. Group Stories by Topic

Currently the home page shows every story as a separate row, even if they have the same (or very similar) topic names. Instead, group stories that share the same topic name together.

**How it works:**
- Stories with identical topic names are grouped into one card
- The card shows the topic name, total episodes across all entries, and the most recent play date
- Tapping the card opens the most recent story's Topic Detail page
- The play button continues the most recent story in the group
- If there are multiple entries (duplicates), a small indicator like "2 series" appears so the user knows there are duplicates they may want to clean up

---

## 2. Episode Prompt Before Playing

When the user taps the Play button (to continue an existing story), instead of immediately jumping into StoryMode, show a small prompt screen asking:

> "Anything particular you want this episode to be about?"

With two options:
- A text input where they can type a theme/idea (e.g., "they go on a camping trip")
- A "Just continue" button that skips straight to the story

The typed episode theme gets passed to StoryMode and appended to the story prompt so the AI incorporates it.

**Where this appears:**
- On the home page when pressing the Play button on an existing story
- On the Topic Detail page when pressing "Play Next Episode"

**Implementation:** A simple dialog/modal rather than a new page, keeping the flow lightweight.

---

## 3. Delete Story Topics

Add a delete option to story topics on the home page. Since there's no DELETE RLS policy on the `stories` table, one needs to be added.

**How it works:**
- Long-press or swipe-to-delete would be complex on web; instead, add a small trash icon that appears on each story card
- Tapping it shows a confirmation dialog
- Deleting a story cascades to delete its episodes (already configured via `ON DELETE CASCADE`)
- After deletion, the list refreshes

---

## Technical Details

### Database Migration
```sql
-- Add DELETE policy for stories table
CREATE POLICY "Allow public delete" ON public.stories FOR DELETE USING (true);

-- Add DELETE policy for story_episodes table  
CREATE POLICY "Allow public delete episodes" ON public.story_episodes FOR DELETE USING (true);
```

### File Changes

**`src/pages/Index.tsx`**
- Group `pastStories` by topic name before rendering
- Show grouped cards with episode count aggregated
- Add trash icon button on each story card with confirmation dialog
- Add the episode prompt dialog (triggered by Play button)
- Pass the optional `episodeTheme` to StoryMode navigation state

**`src/pages/TopicDetail.tsx`**
- Add the same episode prompt dialog before "Play Next Episode"
- Pass `episodeTheme` to StoryMode navigation state

**`src/pages/StoryMode.tsx`**
- Accept optional `episodeTheme` from navigation state
- Append it to the story prompt: "The child's parent would like this episode to focus on: [theme]"

### New Component
**`src/components/EpisodePromptDialog.tsx`**
- Reusable dialog used by both Index and TopicDetail
- Text input with placeholder "e.g., they go on a camping trip"
- "Just continue" button and "Start" button
- Calls `onStart(theme?: string)` callback

### Route/Navigation
No new routes needed. The dialog appears inline on existing pages.

