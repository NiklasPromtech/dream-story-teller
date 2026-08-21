# Dream Story Teller

A bedtime-story generator I built for my two young kids. It writes a fresh story on demand and voices it out loud with the [ElevenLabs](https://elevenlabs.io) API — so instead of robotic text-to-speech, they hear it in a natural voice they actually want to listen to.

**Live app:** https://dream-story-teller.lovable.app

## What it does

- **Story as conversation** — you tell it a story, back and forth, rather than filling in a form
- **Memory across episodes** — when a story finishes, the app skims everything that was said, extracts the characters and what happened, and stores it. The next episode remembers the previous stories and the characters in them, so it genuinely feels like the *next* chapter rather than a fresh start. You can also give feedback that shapes where the next episode goes.
- **Natural narration** — each story is voiced with ElevenLabs, so it's read aloud in a real voice, not robotic TTS
- Simple, kid-friendly interface — made to be used at bedtime, by a parent with a phone in one hand

The memory piece is what makes it fun: continuity across sessions turns a one-off story generator into an ongoing, evolving world.

## How it's built

- **Frontend:** TypeScript / React (built with [Lovable](https://lovable.dev))
- **Backend:** Supabase — edge functions handle the ElevenLabs and generation API calls, so keys stay server-side and never reach the browser
- **Voice:** ElevenLabs API for text-to-speech

## Why I built it

Partly for my kids, partly to feel first-hand what it takes to integrate ElevenLabs well — the difference between "robotic" and "a voice a child wants to hear" is enormous, and the models have crossed it. This started as a family project and turned into genuine appreciation for how far ahead the voice quality is.

---

*One of a number of things I've built — mostly AI-powered tools, data systems, and small apps that solve a real problem. Built solo, shipped live.*
