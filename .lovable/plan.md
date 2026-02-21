

# Mobile-First Design Polish

## Current Issues (from screenshots)

1. **Topic Detail page** - The layout works but could feel more immersive for a bedtime story app. The character cards, synopsis, and episodes are functional but a bit utilitarian.

2. **Episode Prompt Dialog** - Fixed in last edit (now shows story name). But the dialog itself uses default desktop styling -- on mobile it could feel more native with bottom-sheet behavior.

3. **Home Page** - Story description gets truncated. The story cards could breathe more. The delete/play buttons feel a bit cramped side-by-side.

4. **General** - No safe-area padding for notched phones (iPhone). The "Play Next Episode" button sits at the bottom of content but doesn't feel anchored like a proper mobile CTA.

## Planned Changes

### 1. Safe area insets for notched phones
Add `env(safe-area-inset-*)` padding to the app so content doesn't hide behind notches or home indicators on modern iPhones.

### 2. Home Page (`Index.tsx`) improvements
- Add bottom safe-area padding so the "Start Story" button clears the home indicator
- Let the story description text wrap to 2 lines instead of truncating at 1
- Slightly larger touch targets on the play/delete buttons

### 3. Topic Detail Page (`TopicDetail.tsx`) improvements
- Make the "Play Next Episode" button sticky at the bottom of the screen with a subtle gradient fade, so it's always reachable without scrolling to the very end
- Add safe-area bottom padding
- Slightly more vertical spacing between sections for easier thumb scrolling
- For first-episode character cards, add staggered entrance animations for a more delightful reveal

### 4. Episode Prompt Dialog (`EpisodePromptDialog.tsx`)
- Switch from `Dialog` to `Drawer` (using the existing vaul-based drawer component) on mobile so it slides up from the bottom like a native action sheet -- much more natural on phones
- Keep dialog behavior on desktop as fallback

### 5. Global CSS (`index.css`)
- Add viewport meta support for safe areas
- Ensure smooth scrolling on iOS (`-webkit-overflow-scrolling: touch`)

## Technical Details

### Files to modify

- **`index.html`**: Add `viewport-fit=cover` to the viewport meta tag for safe area support
- **`src/index.css`**: Add safe-area padding utilities and smooth scrolling
- **`src/pages/Index.tsx`**: 2-line description, bottom safe padding, slightly improved touch targets
- **`src/pages/TopicDetail.tsx`**: Sticky bottom CTA with gradient fade, staggered character animations, safe-area padding, more breathing room
- **`src/components/EpisodePromptDialog.tsx`**: Use `Drawer` component on mobile (via `useIsMobile` hook), keep `Dialog` on desktop
- **`src/components/ui/drawer.tsx`**: Already exists (vaul), no changes needed

### Sticky CTA approach (TopicDetail)
The "Play Next Episode" button will be positioned with `sticky bottom-0` inside a wrapper with a gradient background (`bg-gradient-to-t from-background`) so it fades into the content above. This keeps it always accessible without covering content.

### Drawer on mobile (EpisodePromptDialog)
Use the existing `useIsMobile` hook. On mobile, render vaul's `Drawer` component instead of the radix `Dialog`. Same content inside, just a different container -- slides up from bottom, feels native, easy to dismiss with a swipe.

### Staggered character animations
For first-episode character cards, add incremental `transition={{ delay: index * 0.1 }}` to the existing `motion.div` so they cascade in one by one.
