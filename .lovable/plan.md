

# Prevent Navigation From Cancelling Story Save

## The Problem
When you press "Goodnight", the save process (`fetch-transcript` + `summarize-story`) takes 5-10 seconds. If you press the "Go back to main menu" button on the intermediate screen before this finishes, navigating away unmounts the component and cancels the in-flight network requests. The database never gets updated.

## The Fix
Two changes to make this bulletproof:

### 1. Disable the "Go back" button until save completes
Add a `savingEpisode` state that is `true` while `saveSummary` is running. The "Go back to main menu" button will show a spinner and be disabled until the save finishes. This is the simplest, most reliable approach -- the user sees clear feedback that saving is in progress.

### 2. Move the save logic outside the component lifecycle
As a safety net, run the `saveSummary` logic in a way that won't be cancelled by navigation. Use a "fire-and-forget" pattern where the critical network calls (fetch-transcript + summarize-story) are detached from the component's lifecycle so even if the user navigates away, the save completes.

## Technical Details

### `src/pages/StoryMode.tsx`

1. **Add `savingEpisode` state** -- tracks whether the save is in progress.

2. **Update `sayGoodnight`** -- set `savingEpisode = true` before calling `saveSummary`, set it to `false` after completion. Only then allow navigation.

3. **Update the intermediate "session ended" screen** -- the "Go back to main menu" button shows a loading spinner and is disabled while `savingEpisode` is true. Once saving completes, the button becomes active (or we auto-navigate).

4. **Safety net: detach the save from component lifecycle** -- wrap the fetch-transcript + summarize-story calls so they complete even if the component unmounts. This means using a promise that isn't tied to component state updates.

### UI Changes
- The intermediate screen button changes from "Go back to main menu" to "Saving episode..." (with spinner) while save is in progress
- Once complete, it either auto-navigates home or shows the active "Go back to main menu" button

