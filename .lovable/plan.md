
# Extreme Logging + Fix Reconnect Starting New Conversation

## Problem 1: Reconnect starts a new conversation
When the ElevenLabs WebSocket drops unexpectedly, `onDisconnect` calls `startConversation()`, which requests a **new signed URL** and creates an entirely new session. The previous `conversationId` is lost, the agent has no memory, and the story restarts from scratch.

Unfortunately, ElevenLabs does not support reconnecting to an existing conversation -- once a WebSocket drops, that session is gone. So the best we can do is:
- Pass the **same prompt with previous context** so the new session continues where the old one left off
- Log extensively so we can diagnose *why* disconnects happen

## Problem 2: Insufficient logging
We need detailed logging at every step to diagnose the 1m28s disconnect.

## Changes (all in `src/pages/StoryMode.tsx`)

### 1. Add extreme logging throughout

Add `console.log` / `console.warn` at these points:
- `onConnect`: log conversation status, timestamp, whether this is a reconnect
- `onDisconnect`: log the disconnect details object, elapsed seconds, `isStoppedRef` value, `hasStartedRef` value
- `onError`: log full error object
- `onMessage`: log every message type and key fields (not full payload to avoid noise)
- `startConversation`: log when starting, whether it's a reconnect attempt, the signed URL (truncated)
- `sayGoodnight` / auto-silence: log each step
- Silence timer: log when silence detection starts, when it fires
- `isSpeaking` changes: log transitions

### 2. Improve reconnect to carry context forward

When auto-reconnecting after an unexpected disconnect:
- Capture the current transcript so far (already in `transcriptRef.current`)
- On the reconnect call to `startConversation`, build a prompt that includes a "RECONNECTION CONTEXT" section with the transcript so far, telling the agent to **continue from where it left off** without repeating
- Track reconnect count to prevent infinite reconnect loops (max 3 attempts)
- Log the reconnect attempt number

### 3. Add reconnect attempt counter

- New ref: `reconnectCountRef = useRef(0)`
- Reset to 0 on successful `onConnect`
- Increment on each reconnect attempt in `onDisconnect`
- Stop retrying after 3 attempts and show an error toast instead

### Technical detail

In `onDisconnect` (line 201-215), change from:
```
setTimeout(() => {
  if (!isStoppedRef.current) {
    savedRef.current = true;
    startConversation();
  }
}, 2000);
```
to:
```
reconnectCountRef.current += 1;
const attempt = reconnectCountRef.current;
console.warn(`[RECONNECT] Attempt ${attempt}/3, elapsed: ${secondsSinceConnect}s, transcript lines: ${transcriptRef.current.length}`);
if (attempt > 3) {
  console.error("[RECONNECT] Max attempts reached, giving up");
  // show error, stop
  return;
}
setTimeout(() => {
  if (!isStoppedRef.current) {
    savedRef.current = true;
    startConversation(); // will use updated storyPrompt with reconnection context
  }
}, 2000);
```

In `startConversation`, when `reconnectCountRef.current > 0`, append reconnection context to the prompt:
```
const reconnectContext = reconnectCountRef.current > 0 && transcriptRef.current.length > 0
  ? `\n\nRECONNECTION: The connection was interrupted. Here is the story so far — continue EXACTLY from where you left off, do NOT repeat anything:\n${transcriptRef.current.slice(-10).join("\n")}`
  : "";
```

This way, even though it's technically a new session, the agent picks up where it left off.
