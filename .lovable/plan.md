
# Debug Dashboard (v2) for ElevenLabs Conversations

## Overview

A new `/v2` page that gives you full transparency into every aspect of the ElevenLabs conversation lifecycle: what we send, what happens during, and what we get back.

## What You'll See

### 1. Pre-Session Panel (Configuration)
- Editable fields for **all** override parameters sent to `startSession`:
  - **Prompt** (full text area)
  - **Language** (e.g. "en")
  - **TTS Stability** (slider, 0-1)
  - **TTS Similarity Boost** (slider, 0-1)
  - **TTS Speed** (slider, 0.5-2.0)
  - **Topic**, **Age**, **Length** selectors (same as home page)
- A "Start Session" button that shows the exact JSON payload being sent before connecting
- The signed URL response displayed once fetched

### 2. Live Session Panel (During Conversation)
- **Connection status** (connected/disconnected/connecting)
- **isSpeaking** indicator
- **Mute/Unmute toggle** (not push-to-talk, a simple toggle for easier debugging)
- **Text input** for sending messages to the agent
- **Live event log**: every `onMessage` event displayed in a scrollable log with timestamp, event type, and full payload (JSON)
- **Conversation ID** displayed as soon as it's captured
- **Elapsed time** counter

### 3. Post-Session Panel (After End)
- "End Session" button with clear labeling
- **Raw transcript** assembled from events
- **Fetch Transcript** button to manually call the `fetch-transcript` edge function and display its response
- **Summarize** button to manually trigger `summarize-story` and display the full response (summary, story_name, story_description, characters)
- All API responses shown as formatted JSON

## Layout

Single-page scrollable layout with three collapsible sections. No fancy animations -- plain, functional, developer-tool style using existing UI components (Card, Tabs, Textarea, Slider, Input, Button, ScrollArea).

## Technical Details

### New Files
- `src/pages/StoryModeV2.tsx` -- the debug dashboard page

### Modified Files
- `src/App.tsx` -- add route `/v2` pointing to `StoryModeV2`

### Architecture
- Uses the same `useConversation` hook from `@elevenlabs/react`
- Calls the same `elevenlabs-conversation-token` edge function for signed URL
- Calls the same `fetch-transcript` and `summarize-story` edge functions
- No new edge functions needed
- All state visible on screen; no hidden logic
- Event log captures every `onMessage` with `JSON.stringify(message)` and a timestamp
- Story is saved to DB same as production flow, but each step is triggered manually with visible output

### Key Differences from Production StoryMode
- No auto-start -- you press "Start" manually
- No auto-end on silence
- No auto-reconnect on disconnect
- Mute is a toggle, not push-to-talk
- Every API call result is displayed as raw JSON
- Manual "Save Episode" and "Fetch Transcript" buttons instead of automatic flow
