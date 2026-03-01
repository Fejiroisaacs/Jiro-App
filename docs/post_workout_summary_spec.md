# Post-Workout Celebration Screen: Design Specification

This document captures the finalized design decisions and requirements for the new post-workout "Summary" screen in the Jym app, resulting from the brainstorming phase.

## 1. Understanding Summary
*   **What:** An immersive, highly visual post-workout wrap-up screen that celebrates completion, plus a button to generate a shareable image of the summary.
*   **Why:** To reward user effort, build habit reinforcement, and encourage organic growth via social sharing.
*   **Who:** Any user who successfully finishes a session in the `session-player`.
*   **Key Constraints:** Needs to look great on mobile, must have a clear "Done/Return to Dashboard" exit path, and the image generation needs to be reliable and properly formatted for modern social media (e.g., Instagram Stories).
*   **Explicit Non-goals:** We are *not* building an in-app social feed. The sharing functionality targets external platforms.

## 2. Assumptions
*   We will use a client-side library (like `html2canvas` or similar) to generate the shareable image to avoid server-side rendering costs.
*   The summary relies entirely on data already available at the end of the session (PRs hit, total volume, time elapsed, heaviest sets).
*   The device supports the Web Share API for native sharing, falling back to a "Download Image" prompt if unsupported.

## 3. Final Design Layout ("Data-Driven Celebration")

The screen will be a hybrid of a highly visual celebration and hard data, optimized for both the in-app experience and social sharing. 

### A. The In-App View (Scrollable)

1.  **Header:** A bold, visual header (e.g., "Workout Complete!") over a vibrant background gradient or graphic (potentially colored by the primary muscle group trained).
2.  **Quick Stats Row:** Three prominent metrics horizontally: Duration, Total Volume, and Total Sets.
3.  **Muscle Group Breakdown:** A horizontal multi-colored bar chart or donut chart showing the percentage of volume assigned to each muscle group worked during that session.
4.  **PR / Top Lifts List:** A scrollable list showing exactly *one* highlight per exercise:
    *   If a PR was hit, show the best PR for that exercise (e.g., "Bench Press: PR - 225 lbs x 5").
    *   If no PR was hit, show the heaviest weight lifted for that exercise (e.g., "Squat: Heaviest Set - 315 lbs x 3").
5.  **Footer Actions:** 
    *   Primary: "Share" button (icon + text).
    *   Secondary: "Return to Dashboard" button.

### B. The Shareable Image View (Capped & Optimized)

When the user taps "Share", the generated image will be a streamlined version of the in-app view to ensure it fits perfectly within standard mobile aspect ratios (like Instagram Stories) without scrolling or clutter.

*   **Difference from In-App View:** The PR / Top Lifts List (Section 4 above) will be strictly capped at the **Top 3 Lifts**, sorted by the highest absolute weight lifted (regardless of reps).

## 4. Decision Log

| Decision | Alternatives Considered | Rationale |
| :--- | :--- | :--- |
| **Overall aesthetic:** Immersive and highly visual (Option B) vs. Quick/dismissible toast. | A simple toast/modal confirming the session was saved. | A celebratory screen better rewards the physical effort of a workout, builds habit loops, and encourages organic social sharing, matching industry standards (Strava, Spotify Wrapped). |
| **Sharing Mechanism:** Generating an image vs. In-app feed only. | Keeping all data strictly inside Jym. | A generated image directly taps into users' desire to share their hard work on platforms like Instagram, serving as free marketing for Jym. |
| **Data representation:** Hybrid visual + hard data breakdown. | purely Gamified (badges/XP) or purely Analytical (dense text lists). | serious lifters want to see their volume and muscle breakdown, but social media requires it to look visually appealing ("sexy"). The hybrid approach provides the best of both. |
| **Shareable Image Length:** Capped at Top 3 lifts (by absolute weight). | Showing all exercises, letting the image grow vertically indefinitely. | Social media platforms (like Instagram Stories) heavily favor standard aspect ratios (9:16). A permanently long, scrolling image would be cropped awkwardly or unreadable on external platforms. |

---
*This document signals the completion of the brainstorming phase. Ready for Implementation Handoff.*
