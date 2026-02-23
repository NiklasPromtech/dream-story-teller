

# Auto-Save After Goodnight Becomes Visible

## What this solves
When the AI narrator says "goodnight" and stops speaking, the control buttons appear (including the Goodnight button). If the user doesn't tap anything within a few seconds, the AI continues talking — but without continuity from the previous episode. This feels jarring. 

This change adds a 5-second auto-trigger: once the Goodnight button is visible for 5 seconds, the app automatically saves the episode and returns the user to the home screen — exactly as if they had tapped the Goodnight button.

## How it works

1. **Track when the button panel becomes visible** — The buttons appear when `!conversation.isSpeaking` and the session has been active for >10 seconds. When these conditions become true, start a 5-second timer.

2. **After 5 seconds, auto-trigger `sayGoodnight()`** — This saves the transcript, summarizes the episode, ends the session, and navigates home.

3. **Cancel the timer if the user interacts** — If the user clicks any button (extend time, next episode, goodnight, or sends a text message), cancel the auto-save timer so it doesn't fire unexpectedly.

4. **Cancel if speaking resumes** — If the AI starts speaking again before the 5 seconds are up, cancel the timer.

## Technical details (all in `src/pages/StoryMode.tsx`)

- Add a new ref: `autoGoodnightTimerRef = useRef<NodeJS.Timeout | null>(null)`
- Add a helper to clear the timer: `clearAutoGoodnight()`
- Add a `useEffect` that watches `conversation.isSpeaking`, `isActive`, `isStopped`, and `secondsSinceConnect`:
  - When the button panel conditions are met (`!isSpeaking && isActive && !isStopped && secondsSinceConnect > 10`), start a 5-second timeout that calls `sayGoodnight()`
  - When any condition becomes false, clear the timer
  - Clean up on unmount
- Call `clearAutoGoodnight()` inside the click handlers for: extend buttons, next episode buttons, text message send, and the goodnight button itself
- Add logging: `[AUTO-GOODNIGHT] Timer started`, `[AUTO-GOODNIGHT] Timer cancelled (reason)`, `[AUTO-GOODNIGHT] Triggering auto-save`

