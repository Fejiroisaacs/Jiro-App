# Jiro Public Landing Page: UI/UX Design Specification

## 1. Overview & Objectives
Currently, the root URL (`/`) directs users immediately to a login/registration view. This creates high friction for potential users who want to understand the platform's value before committing.

**The Goal**: Design a visually striking, narrative-driven public landing page that showcases the Jiro platform as an elegant, unified "Command Center for your life" featuring its sub-modules (Culinara, Journaly, Jym, Echo).

---

## 2. Target Audience & Value Proposition
- **Audience**: Individuals looking for an aesthetic, minimalist, all-in-one personal management system that is free of clutter and ads.
- **Core Promise**: "Everything you need to orchestrate your life, beautifully integrated into one modular dashboard."

---

## 3. Page Structure & Information Architecture

### A. Navigation (App Header)
- **Left**: Minimalist Jiro Logo
- **Right**: 
  - `Log In` (Subtle ghost button / text link)
  - `Get Started` (High-contrast, primary CTA button)

### B. Hero Section (The Hook)
- **Tagline**: "Your Life, Unified." or "A modular command center for the intentional life."
- **Subtext**: A brief 1-2 sentence description emphasizing privacy, aesthetics, and organization.
- **CTAs**: Primary: "Start Building" / Secondary: "Explore Modules"
- **Visual Asset**: A large, beautifully framed product mockup showcasing the central Dashboard ("The Dock") hovering elegantly with subtle depth/shadows. On scroll, parts of the UI could gently separate or float (parallax) to show modularity.

### C. The Module Showcase (The "Bento Box" or Alternating Grids)
Instead of overwhelming the user, we break down the modules visually. A CSS Grid "Bento Box" layout works perfectly here to display the ecosystem.

1. **Culinara (The Kitchen Library)**
   - *Visual*: A clean recipe card showing "The Standard" vs "The Trials".
   - *Copy*: "Perfect your recipes. Track every trial until you find the gold standard."
2. **Journaly (The Reflection Space)**
   - *Visual*: A calendar view showcasing a streak banner and colorful mood chips.
   - *Copy*: "Private reflections or shared journals. Track your mood, write daily, and see your streak grow."
3. **Jym (The Fitness Tracker)**
   - *Visual*: A workout log or progression chart.
   - *Copy*: "Log sets, track volume, and visualize your strength journey."
4. **Echo (The Reminder System)**
   - *Visual*: A sleek, grouped notification center.
   - *Copy*: "Never miss a beat. Smart reminders that seamlessly integrate with your workflow."

### D. Features & Micro-Interactions Details
- **Cross-Module Sync**: Emphasize that these aren't isolated apps. The "Global Notification Center" brings alerts from all modules into one place.
- **Theming Presentation**: A dynamic section where the user can click theme names ("Earth", "Clay", "Sand", "Forest") to watch the landing page's colors smoothly transition. This highlights the customizability of the workspace.

### E. Social Proof / Final CTA
- **Bottom Hook**: "Ready to organize your chaos?"
- **Final CTA**: Large, inviting input field: `[ Enter your email ] [ Join Jiro ]`
- **Footer**: Standard links (Privacy, Terms, About, Contact).

---

## 4. UI/UX & Mobile Optimizations

### Aesthetics & Typography
- **Background**: Start with a warm, off-white or deep minimalist dark mode (e.g., `var(--bg-canvas)` from your design tokens). Use subtle radial gradients in the background to draw focus to the product mockups.
- **Typography**: Large, bold, tracking-tight sans-serif headers (e.g., Inter, Outfit) mixed with high-legibility body text. 

### Animations & Micro-interactions
- **Scroll Reveal**: Elements should gently fade and slide up (`transform: translateY(20px)`) as they enter the viewport to avoid a static, flat feel.
- **Hover States**: The Bento Box module cards should have a soft scale (`scale: 1.02`) and increased shadow on hover to feel tactile and interactive.

### Mobile Experience
- The Hero image needs to crop smartly or switch to a portrait-oriented mobile mockup.
- The Bento Box grid must collapse gracefully into a 1-column stack.
- The navigation should hide behind a clean hamburger menu, but keep the primary `Get Started` CTA visible in the header if space permits, or pin it to a bottom sticky bar.
