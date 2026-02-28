# Journaly Calendar Modal: UI/UX Design Specification

## 1. Overview & User Flow
This specification covers the interaction model for viewing daily journal entries directly from the Calendar/Week View. 

**The User Journey:**
1. **Trigger**: User clicks on a specific day in the calendar grid.
2. **Day View Modal**: A modal opens over a blurred background displaying all entries for that day.
3. **Expand Entry**: Clicking an individual entry card within the modal smoothly expands it for deep reading.
4. **Edit**: An "Edit" button in the expanded view routes the user to the full Journal Editor.

---

## 2. Interface Anatomy

### A. The Backdrop & Modal Container
- **Backdrop effect**: A subtle `backdrop-filter: blur(4px)` combined with a semi-transparent dark overlay (e.g., `rgba(0,0,0,0.4)` on light mode, darker on dark mode). This isolates the user's focus.
- **Modal Container**: 
  - Desktop: Centered dialog box, max-width around `600px`, soft drop shadow `0 10px 25px rgba(0,0,0,0.1)`.
  - Mobile: Transitions seamlessly into a **Bottom Sheet** that slides up and can be dismissed via swipe-down gesture.
  - **Header**: Sticky at the top, displaying the formatted date (e.g., *Thursday, Oct 12*) and a clear 'X' close button.

### B. Daily Entry List (Default Modal State)
Inside the modal, multiple entries for the day are stacked organically.
- **Entry Card Design**:
  - **Header**: Mood chip and optional Title.
  - **Body**: Text excerpt (notes) of the entry. Keep line height generous (`1.5`).
  - **Images**: Displayed below the text in a masonry or fixed-height horizontal scrolling grid. Images should have soft rounded corners.
- **Hover/Tap Affordance**: Cards lightly elevate on hover (`transform: translateY(-2px)`) with a subtle border highlight to indicate clickability.

### C. Expanded Entry View (Detail State)
When a user clicks an entry card inside the modal:
- **Transition**: The selected card expands to fill the modal body (using a smooth spring animation), while other cards fade out. A "Back" button appears in the modal header to return to the list of the day's entries.
- **Content**: Full text is revealed without truncation. Images can be tapped to view full-screen.
- **Call-to-Action (CTA)**: A primary floating or clearly anchored **"Edit Entry"** button is revealed. Clicking this closes the modal and pushes the user to `/journal/:id/edit`.

---

## 3. UI/UX & Mobile Optimizations

### Interactions & Micro-animations
- **Entrance**: Modal scales up slightly (`0.95` -> `1.0`) while fading in `opacity: 0 -> 1` over `200ms` using an `ease-out` timing function.
- **Expansion**: The card-to-detail transition should utilize CSS View Transitions API or spatial morphing where the card's boundaries expand smoothly.
- **Haptic Feedback (Mobile)**: Slight vibration when the modal snaps into place or when a swipe-to-close gesture is completed.

### Accessibility (a11y)
- **Focus Trap**: Once the modal is open, keyboard `Tab` navigation must be trapped within the modal elements.
- **Keyboard Dismiss**: The `Escape` key must immediately close the modal.
- **Semantic HTML**: Use `<dialog>` or apply `role="dialog"` and `aria-modal="true"`. Ensure the date header uses an `h2` with an ID referenced by `aria-labelledby`.
- **Target Sizes**: The close button, individual cards, and edit buttons must be a minimum of 44x44px.

### Visual Polish
- Follow the Journaly earthy color palette (warm canvas background, forest/clay primary accents).
- Keep borders thin (`1px solid var(--border-color)`) and rely on whitespace/padding (e.g., `var(--space-md)` or `var(--space-lg)`) to separate content within the modal.
