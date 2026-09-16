# Social Accountability Hub: UI/UX Design Plan

Based on the `ui-ux-designer` principles, this document outlines the interface architecture, user flows, and component requirements to integrate the "Social Accountability Hub" into the Jiro ecosystem.

## 1. Design Strategy & Principles
*   **Opt-in by Default (Privacy-First UX):** Social features should never force visibility. All sharing dialogues default to "Private" with explicit "Share to Feed" toggles.
*   **Cross-Platform Consistency:** The experience must flow seamlessly between the mobile bottom-nav constraint and the expansive desktop sidebar layout.
*   **Atomic Components:** Reuse existing design tokens (the earthy palette, soft shadows, rounded corners) to make the social features feel like a native extension of Jiro, not a bolted-on app.

---

## 2. Core User Flows

### Flow A: The Unified Activity Feed
*The central hub where users see what their friends are doing.*

*   **Location:** Home Dashboard.
*   **Flow:** 
    1. User lands on Dashboard.
    2. A new segmented control (Tabs) appears at the top: `[ Personal Overview | Community Feed ]`.
    3. Clicking `Community Feed` displays a vertically scrolling list of cards.
    4. Each card contains: Profile Avatar, User Name, Timestamp, Activity Type (Icon: Jym, Culinara, Journaly), and the Payload (e.g., "Hit a 100kg Bench").
    5. Bottom of the card features Reaction buttons (🔥, 💪) and a simple Comment toggle.

### Flow B: Friending & User Discovery
*How users connect with each other.*

*   **Location:** Settings / Profile area.
*   **Flow:**
    1. User navigates to a new "Network" or "Friends" section from the sidebar/bottom nav.
    2. A search bar allows querying by Username or Display Name.
    3. Results show Avatar, Name, and an `[Add Friend]` button.
    4. A "Pending Requests" tab manages incoming connections.

### Flow C: Publishing a Workout / Recipe
*How data gets from sub-apps to the feed.*

*   **Location:** End of a Jym Session / Saving a Recipe in Culinara.
*   **Flow:**
    1. User completes a workout or saves a recipe.
    2. The standard success modal appears, but now includes a toggle switch: `"Share to Community Feed"`.
    3. (Optional) A text area appears below the toggle: `"Add a note... (e.g., 'Felt great today!')"`.
    4. Tapping "Finish" publishes the event to the feed asynchronously.

---

## 3. Platform-Specific UI Architectures

### 📱 Mobile UI Implementation (Viewport: < 768px)
*   **Dashboard Feed:** The `Community Feed` is accessible via a sticky tab bar integrated *just below* the global header (where the dark mode toggle is). The feed itself is an infinite vertical scroll.
*   **Card Design:** Feed cards will be full-width (minus standard 16px padding on edges) to maximize read space for activity descriptions.
*   **Reactions:** Inline horizontal scroll for reactions to save vertical space.
*   **Navigation:** Friends management is added to the "Settings" bottom-nav route to prevent adding a 6th icon to the bottom bar (which would crowd touch targets).

### 💻 Desktop UI Implementation (Viewport: > 1024px)
*   **Dashboard Feed:** The dashboard transitions to a split-screen or multi-column layout. The left column (60%) retains the standard "Personal Overview" App Center grid. The right column (40%) becomes a persistent, scrolling `Community Feed`. This utilizes previously identified "dead space" on desktop effectively.
*   **Card Design:** Cards are boxed within the 40% column. Hover states on cards reveal exact timestamps and detailed stats.
*   **Navigation:** The global Sidebar gains a dedicated "Community" icon between "Dashboard" and the sub-apps, opening a dedicated page for friend discovery, leaderboards, and challenges.

---

## 4. Component Requirements (Design System Checklist)

To implement this, we need to design/build the following Atomic components:

- [ ] **Data Display:** `ActivityFeedCard` (Variations for Jym, Culinara, generic achievements).
- [ ] **Inputs:** `VisibilityToggle` (Private/Public switch with clear active/inactive states based on the earthy palette).
- [ ] **Data Display:** `UserListItem` (Avatar, Name, action button for adding/removing friends).
- [ ] **Navigation:** `SubNavTabs` (For switching between Personal/Community on mobile).
- [ ] **Interactive:** `ReactionToolbar` (Micro-interactions for liking/reacting to feed posts).

> **Proposed Next Step:** Before touching code, we should refine the database schema for the Feed and Friendships to support these flows gracefully. Does this UI/UX direction match your vision for the social features?
