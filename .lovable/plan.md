

# Swedish Language Support + Replace Resume with Next Episode

## Changes

### 1. Add Swedish language support
Pass `language: "sv"` instead of `"en"` in the `startSession` overrides. Since the app doesn't yet have a language selector, we'll add a `language` field to the `location.state` so the calling page can specify it. Default remains `"en"`. The story prompt will also be updated to instruct the agent to tell the story in Swedish when `language === "sv"`.

### 2. Replace "Resume" button with "Next Episode" after Goodnight
Remove the Resume button from the post-goodnight screen. Replace it with a "Next Episode" button that saves the current episode and starts a new one (reusing the existing `startNextEpisode` logic). The "Back" button stays as-is (disabled while saving).

The post-goodnight screen will show:
- "Saving your episode..." message while save is in progress
- Once saved: "Next Episode" button + "Back" button

## Technical Details

### `src/pages/StoryMode.tsx`

1. **Language from location state**: Add `language` to the destructured `location.state` (defaulting to `"en"`). Pass it into `startSession` overrides.

2. **Story prompt**: When `language === "sv"`, prepend "Tell the story in Swedish." to the prompt.

3. **Remove Resume button** from the `isStopped` section (lines 559-566).

4. **Add "Next Episode" button** in its place -- calls `startNextEpisode` with the current `length` value. Disabled while `savingEpisode` is true.

5. **Update helper text** -- remove the "Resuming will start a new connection" message, replace with something like "Your episode has been saved" once saving completes.

### Calling pages (Index.tsx, TopicDetail.tsx)
No changes needed immediately -- they'll default to `"en"`. When you want to test Swedish, you can pass `language: "sv"` in the navigation state.

### No database changes needed
Language is a runtime parameter, not stored per-story.

