# Context
Act as an expert UX/UI developer specializing in Angular and modern CSS architectures. We are refactoring the landing page of "Jiro", a personal life-management command center. 

The current implementation is functional but feels like a generic SaaS template. The goal is to elevate it to a premium, highly tactile, and personal "Earth & Clay" aesthetic. 

# Design System Constraints
* **Theme:** "Earth & Clay". It must feel physical, grounded, and elegant. No neon, no generic blue links, no standard SaaS drop-shadows.
* **Color Palette (Strictly Enforce):**
    * Background/Canvas: `--jiro-cream` (#F5F0E8) or `--jiro-sand` (#D4C5A9)
    * Primary Text/Cards: `--jiro-maroon` (#7A3B2E) and `--jiro-brown` (#5C4033)
    * Accents/Success: `--jiro-green` (#4A6741)
    * Alerts/Achievements (like PR badges): `--jiro-burnt-orange` (#C1582A)
* **Typography:** * Use `Newsreader` (serif) strictly for the main `h1` hero title and major section headers to give an editorial feel.
    * Use `DM Sans` (sans-serif) for all UI elements, card content, and micro-copy.

# Refactoring Directives

Implement the following three major upgrades to the existing Angular component and CSS. Strip out any compiled `_ngcontent` tags from the raw code I provide.

### 1. The Reactive 3D Hero Mockup
The current `.l-dashboard-mockup` uses a static CSS transform. Replace this with a dynamic, mouse-tracking effect. 

**TypeScript Implementation (`landing.component.ts`):**
Add a template reference variable `#dashboardMockup` to the `.l-dashboard-mockup` div in the HTML, and implement this listener:

```typescript
import { Component, HostListener, ElementRef, ViewChild } from '@angular/core';

@Component({
  // ... component metadata
})
export class LandingComponent {
  @ViewChild('dashboardMockup') dashboardMockup!: ElementRef;

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.dashboardMockup) return;

    const { clientX, clientY } = event;
    const { innerWidth, innerHeight } = window;

    // Calculate mouse position relative to screen center (-1 to 1)
    const xPos = (clientX / innerWidth - 0.5) * 2;
    const yPos = (clientY / innerHeight - 0.5) * 2;

    // Limit rotation to a subtle 10 degrees max
    const rotateX = yPos * -10;
    const rotateY = xPos * 10;

    // Apply the dynamic transform, keeping the base scale and slight Z-tilt
    this.dashboardMockup.nativeElement.style.transform = 
      `rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(2deg) scale(0.95)`;
  }
}
```

CSS Requirement: Add transition: transform 0.1s ease-out; to .l-dashboard-mockup so the movement is smooth and non-jittery.

2. Tactile Bento Cards (The "Glass Glare" Effect)
The current .l-card elements in the .l-bento grid just translate up by -2px on hover. Make them feel like physical objects interacting with light.

Behavior: 1. On mousemove over a .l-card, calculate the cursor's local X and Y coordinates relative to the card.
2. Update CSS variables (e.g., --mouse-x, --mouse-y) dynamically on that specific card element using Angular or inline styles.
3. Use an ::after pseudo-element on .l-card with a radial-gradient that tracks those coordinates. The gradient should be a faint white overlay creating a "sheen" that moves across the dark maroon cards.

3. Staggered Animations & Micro-interactions
Strip out the raw CSS keyframe _ngcontent-ng-c2318527254_fadeUp for the grid and replace it with Angular's native @angular/animations.

Angular Animations (landing.component.ts):
Import the animation functions and add this trigger to the component's @Component decorator. Apply [@bentoEntrance] to the .l-bento grid container in the HTML.

```typescript
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';

export const bentoAnimation = trigger('bentoEntrance', [
  transition(':enter', [
    query('.l-card', [
      style({ opacity: 0, transform: 'translateY(40px) scale(0.98)' })
    ], { optional: true }),
    
    query('.l-card', [
      stagger('120ms', [
        animate('600ms cubic-bezier(0.16, 1, 0.3, 1)', 
          style({ opacity: 1, transform: 'translateY(0) scale(1)' })
        )
      ])
    ], { optional: true })
  ])
]);
```

PR Badge Pulse (styles.css / component CSS):
Target the .mjym-pr-badge inside the Jym card mockup. Add this subtle, continuous CSS pulse animation using --jiro-burnt-orange to make the PR achievement feel alive.

```CSS
@keyframes prPulse {
  0% { 
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--jiro-burnt-orange) 60%, transparent); 
  }
  70% { 
    box-shadow: 0 0 0 10px transparent; 
  }
  100% { 
    box-shadow: 0 0 0 0 transparent; 
  }
}

.mjym-pr-badge {
  animation: prPulse 2.5s infinite cubic-bezier(0.16, 1, 0.3, 1);
}
```



If the you need clarification on the Glass Glare effect, you can Use event.clientX - rect.left and event.clientY - rect.top inside a (mousemove) binding on the .l-card elements to set the CSS variables for the ::after radial gradient.