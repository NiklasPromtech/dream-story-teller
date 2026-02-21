
# 🌙 Bedtime Story Voice Agent

A voice-first AI storytelling app designed for bedtime. Parents set up the story on a dark, calming screen, then put the phone down while the AI tells the story aloud — like a personal storyteller for kids.

---

## Page 1: Home / Story Setup (Dark Theme)
- Clean, dark-themed screen with minimal UI — easy on the eyes in a dark bedroom
- **Story topic input**: Text field or quick-pick cards (e.g., "Space adventure", "Underwater kingdom", "Dragons", or type your own)
- **Story length selector**: Short (~3 min), Medium (~7 min), Long (~15 min)
- **Big "Start Story" button** to begin

## Page 2: Story Mode (Minimal Screen)
- Screen dims to near-black with just a subtle animated glow or moon icon — no distracting visuals
- **Live conversational voice agent** (powered by ElevenLabs) tells the story aloud
- The child (or parent) can:
  - **Interrupt anytime** to ask questions about the story ("What color is the dragon?") and the agent answers naturally, then continues
  - **Ask for a new episode** ("Tell me another one!") and the agent starts a new story in the same theme
  - **Say "stop"** or tap a simple button to end the story
- A small, unobtrusive **stop button** visible on screen as a fallback

## Voice Agent Behavior
- Speaks in a warm, soothing storytelling voice appropriate for bedtime
- Adjusts story length based on the parent's selection
- Remembers the story context so questions get relevant answers
- Can generate follow-up episodes continuing the same characters/world
- Keeps content age-appropriate and calming

## Technical Approach
- **ElevenLabs Conversational AI Agent** for real-time voice interaction (speech-to-speech)
- **Lovable Cloud** backend with edge functions for secure token generation
- **Lovable AI** to power the story generation with a carefully crafted storytelling prompt
- No accounts for now — can be added later
- Dark theme throughout with minimal, calming UI
