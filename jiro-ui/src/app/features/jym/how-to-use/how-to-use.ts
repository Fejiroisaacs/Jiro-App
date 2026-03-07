import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'jym-how-to-use',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <div class="content-wrapper">
        <header class="page-header">
          <h1>How to Use: Jym App</h1>
          <p class="subtitle">Welcome to the Jym module. This guide will walk you through the core features of the fitness application, from setting up your first exercise to sharing your routines with the community.</p>
        </header>

        <div class="table-of-contents">
          <h3>Quick Links</h3>
          <nav>
            <a href="#dashboard" (click)="scrollTo('dashboard', $event)">1. The Dashboard (Home)</a>
            <a href="#managing-splits" (click)="scrollTo('managing-splits', $event)">2. Managing Your Splits</a>
            <a href="#exercise-library" (click)="scrollTo('exercise-library', $event)">3. The Exercise Library</a>
            <a href="#body-weight" (click)="scrollTo('body-weight', $event)">4. Body Weight Tracking</a>
            <a href="#discover-share" (click)="scrollTo('discover-share', $event)">5. Discover & Share (Community)</a>
            <a href="#additional-features" (click)="scrollTo('additional-features', $event)">6. Additional Pro Features</a>
          </nav>
        </div>

        <section class="guide-section" id="dashboard">
          <h2>1. The Dashboard (Home)</h2>
          <p>When you first open the Jym app, you'll land on the Dashboard. This is your high-level overview of your current fitness journey.</p>
          <ul>
            <li><strong>Current Active Series:</strong> If you are currently running a training program (e.g., "Summer Cut Split"), it will be highlighted here, showing your progress in weeks or sessions.</li>
            <li><strong>Activity Heatmap:</strong> A calendar view showing your workout frequency and consistency over time.</li>
            <li><strong>Muscle Breakdown:</strong> A dynamic chart providing visual feedback on your training volume distribution across different muscle groups.</li>
            <li><strong>Quick Stats & Recents:</strong> A summary of your recent workouts and any personal records broken.</li>
            <li><strong>Bottom Navigation:</strong> Use the bottom tab bar to quickly jump to Home, Culinara, Jym, or Settings. Within Jym, use the textured file folder tabs at the top to navigate sub-views.</li>
          </ul>
          <img src="/images/jym-guide/jym_dashboard_view_1771964994121.png" alt="Jym Dashboard" class="guide-img" loading="lazy" />
        </section>

        <hr class="divider" />

        <section class="guide-section" id="managing-splits">
          <h2>2. Managing Your Splits</h2>
          <p>A <strong>Split</strong> is a collection of workout days (Routines) that you cycle through.</p>
          <ul>
            <li><strong>Viewing Splits:</strong> Click the "Splits" tab to view all your custom routines.</li>
            <li><strong>Creating a Split:</strong> Click the <code>+ New Split</code> button. Give it a name, description, and some descriptive tags.</li>
            <li><strong>Public Sharing:</strong> You can choose to make any split <strong>Public</strong>. Public splits will be visible and available for the entire Jiro community to import from the <strong>Discover</strong> page.</li>
          </ul>
          <img src="/images/jym-guide/jym_splits_view_1771965001478.png" alt="Jym Splits List" class="guide-img" loading="lazy" />

          <div class="sub-section">
            <h3>Building a Routine</h3>
            <p>Once a split is created, click the <code>Build</code> button on its index card to open the Split Detail view.</p>
            <ul>
              <li><strong>Adding Days:</strong> A split is made up of "Routines" (Days). You can add a day (e.g., "Push Day" or "Upper Body").</li>
              <li><strong>Adding Exercises:</strong> For each day, click <code>+ Add Exercise</code>. You can select from your Library and assign specific target sets and reps.</li>
              <li><strong>Reordering:</strong> Use the drag handles to reorder the exercises within a day to perfectly structure your workout flow.</li>
            </ul>
            <img src="/images/jym-guide/jym_split_detail_view_1771985352516.png" alt="Jym Split Detail / Builder" class="guide-img" loading="lazy" />
          </div>

          <div class="sub-section">
            <h3>Starting a Workout Session</h3>
            <p>Once a Split is set up, you can start a live workout straight from the Splits page.</p>
            <ul>
              <li>Click <code>Start</code> on the index card of your chosen split and select the routine (e.g., <em>Push</em>) for the day.</li>
              <li><strong>The Session Player:</strong> A live workout interface will overlay, showing a session timer, your target exercises, and letting you log physical weights, reps, and RPE as you progress.</li>
              <li><strong>Micro-logging:</strong> You can quickly log your Body Weight or add session notes directly within the active player without losing your workout context.</li>
              <li><strong>Completion Summary:</strong> Once finished, conclude the session to record the data. The Session Summary provides a breakdown of your total duration, volume lifted, muscle focus, and automatically highlights any newly broken PRs.</li>
            </ul>
            <img src="/images/jym-guide/jym_session_player_view_1771988024345.png" alt="Jym Session Player View" class="guide-img" loading="lazy" />
          </div>

          <div class="sub-section">
            <h3>Creating and Managing a Series</h3>
            <p>A <strong>Series</strong> is an active commitment to a Split over a period of time, allowing you to track progression cumulatively.</p>
            <ul>
              <li><strong>Start a Series:</strong> Click the <code>Series</code> button on any split from the Splits list. You will be prompted with three duration options:
                <ol>
                  <li><strong>Fixed Weeks:</strong> Set a target number of weeks (e.g., an 8-Week block).</li>
                  <li><strong>Session Count:</strong> Target a specific number of total workouts.</li>
                  <li><strong>Open-ended:</strong> Run the split indefinitely until you explicitly decide to end it.</li>
                </ol>
              </li>
            </ul>
            <img src="/images/jym-guide/jym_series_create_modal_1771987968120.png" alt="Jym Series Create Modal" class="guide-img" loading="lazy" />

            <ul>
              <li><strong>Active Series View:</strong> Once created, you can access your active series from the Dashboard. The Series Detail page provides macro analytics for the block:
                <ul>
                  <li><strong>Progress Tracking:</strong> Shows sessions completed versus your target duration.</li>
                  <li><strong>Volume Distribution:</strong> A chart detailing aggregate session volume over time, helping you visualize and manage fatigue accumulation.</li>
                </ul>
              </li>
            </ul>
            <img src="/images/jym-guide/jym_series_detail_view_1771987996447.png" alt="Jym Series Detail View" class="guide-img" loading="lazy" />
          </div>
        </section>

        <hr class="divider" />

        <section class="guide-section" id="exercise-library">
          <h2>3. The Exercise Library</h2>
          <p>The Exercise Library is your personal database of movements.</p>
          <ul>
            <li><strong>Filtering:</strong> Use the search bar or the muscle group chips to quickly find specific exercises.</li>
            <li><strong>Adding Custom Exercises:</strong> Click the <code>+</code> button in the top right to define a new movement. You can select the primary muscle group (e.g., "Chest") and append specific technique notes. The app uses an intelligent PR tracker, so recording exercises consistently is key.</li>
            <li><strong>Exercise Details & Est. 1RM Tracking:</strong> Clicking on any existing exercise (e.g., <em>Barbell Bench Press</em>) opens its detailed view containing progression insights:
              <ul>
                <li><strong>Progression Chart:</strong> A visual line graph showing your Estimated 1 Rep Max progression curve over time based on the sets you've logged.</li>
                <li><strong>Volume History:</strong> A chronological log of every time you've performed this exercise, including sets, reps, weight, and any PRs set.</li>
              </ul>
            </li>
          </ul>
          <img src="/images/jym-guide/jym_exercises_view_1771985334002.png" alt="Jym Exercise Library" class="guide-img" loading="lazy" />
          <h4 style="margin-top: 10px;">Exercise Detail View</h4>
          <img src="/images/jym-guide/jym_exercise_detail_view_1771987947621.png" alt="Jym Exercise Detail View" class="guide-img" loading="lazy" />
        </section>

        <hr class="divider" />

        <section class="guide-section" id="body-weight">
          <h2>4. Body Weight Tracking</h2>
          <p>Strength progression is deeply tied to your body weight. Jym provides a dedicated view for this.</p>
          <ul>
            <li>Navigate to the <code>Body Wt.</code> tab to view your historical weigh-ins mapped out on a progressive line chart.</li>
            <li>Tap the <code>+ Add Weight</code> button to log a new entry. Consistent logging here helps contextualize your <code>Est. 1RM</code> gains in the exercise library.</li>
          </ul>
          <img src="/images/jym-guide/jym_body_weight_view_1771985339595.png" alt="Jym Body Weight Tracker" class="guide-img" loading="lazy" />
        </section>

        <hr class="divider" />

        <section class="guide-section" id="discover-share">
          <h2>5. Discover & Share (Community)</h2>
          <p>The <strong>Discover</strong> page is where the Jiro community shares their best routines.</p>
          <ul>
            <li>If you find a routine you like, click the card to view its structure.</li>
            <li>You can <strong>Import</strong> the split directly into your account. The app will automatically clone the required exercises into your library if you don't already have them.</li>
            <li>To share your own routine, go to your Splits, find the routine, and use the Share icon to generate a unique public link or post it to the Discover wall.</li>
          </ul>
          <img src="/images/jym-guide/jym_discover_view_1771985365660.png" alt="Jym Discover Community" class="guide-img" loading="lazy" />
        </section>

        <hr class="divider" />

        <section class="guide-section" id="additional-features">
          <h2>6. Additional Pro Features</h2>
          <p>Beyond the core workout tracking, Jym offers several advanced features that might not be immediately obvious but are crucial for serious lifters:</p>
          <ul>
            <li><strong>Form Checks & Video Analysis:</strong> You can upload or record form check videos for individual exercises. This capability is accessible both from within a live workout session and directly from the Exercise Library's detail view, allowing you to review your technique over time.</li>
            <li><strong>Session Templates:</strong> Instead of building a new routine from scratch, you have the ability to save any completed workout session as a reusable <strong>Template</strong>. You can then launch future workouts directly from this template structure.</li>
            <li><strong>Contextual Notes:</strong> During a live session, you can take high-level <strong>Session Notes</strong> to describe how the entire workout felt (e.g., "Felt energized, slept 8 hours"). Additionally, you can log specific <strong>Exercise Notes</strong> under individual movements (e.g., "Raise the bench one notch" or "Focus on the eccentric phase") to remind yourself for next time.</li>
          </ul>
        </section>
        
        <div style="height: 60px;"></div>
      </div>
    </div>
  `,
  styles: [`
    .page-container {
      max-width: 1000px;
      margin: 0 auto;
    }

    .content-wrapper {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
      padding: var(--space-2xl);
      box-shadow: var(--shadow-sm);
    }

    .page-header {
      margin-bottom: var(--space-xl);
      text-align: center;
    }

    .page-header h1 {
      font-size: 2.5rem;
      color: var(--color-primary);
      margin-bottom: var(--space-sm);
    }

    .subtitle {
      font-size: var(--font-size-lg);
      color: var(--text-secondary);
      max-width: 700px;
      margin: 0 auto;
      line-height: 1.5;
    }

    .table-of-contents {
      background: var(--bg-canvas);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: var(--space-lg);
      margin-bottom: var(--space-2xl);
    }

    .table-of-contents h3 {
      font-family: var(--font-family-display);
      font-size: var(--font-size-lg);
      margin-bottom: var(--space-sm);
      color: var(--color-primary);
    }

    .table-of-contents nav {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }

    .table-of-contents a {
      color: var(--text-primary);
      font-weight: 500;
      text-decoration: none;
      transition: color 0.15s;
      padding-left: var(--space-sm);
      border-left: 2px solid transparent;
    }

    .table-of-contents a:hover {
      color: var(--color-primary);
      border-left-color: var(--color-primary);
    }

    .guide-section {
      margin-bottom: var(--space-xl);
      scroll-margin-top: calc(var(--topbar-height, 56px) + var(--space-xl));
    }

    .guide-section h2 {
      font-size: var(--font-size-xl);
      color: var(--text-primary);
      margin-bottom: var(--space-md);
      font-family: var(--font-family-display);
    }

    .sub-section {
      margin-top: var(--space-xl);
    }

    .sub-section h3 {
      font-size: var(--font-size-lg);
      color: var(--text-primary);
      margin-bottom: var(--space-sm);
    }

    p {
      line-height: 1.6;
      margin-bottom: var(--space-md);
      color: var(--text-primary);
    }

    ul, ol {
      margin-bottom: var(--space-lg);
      padding-left: var(--space-lg);
      line-height: 1.6;
      color: var(--text-primary);
    }

    li {
      margin-bottom: var(--space-xs);
    }

    code {
      background: var(--bg-canvas);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.9em;
      color: var(--color-primary);
      border: 1px solid var(--border-color);
    }

    .guide-img {
      width: 100%;
      height: auto;
      border-radius: var(--border-radius);
      border: 1px solid var(--border-color);
      box-shadow: var(--shadow-sm);
      margin-top: var(--space-md);
      margin-bottom: var(--space-md);
    }
    
    .divider {
      border: 0;
      border-top: 1px solid var(--border-color);
      margin: var(--space-2xl) 0;
      opacity: 0.5;
    }

    @media (max-width: 768px) {
      .content-wrapper {
        padding: var(--space-lg);
      }
      .page-header h1 {
        font-size: 2rem;
      }
      .subtitle {
        font-size: var(--font-size-md);
      }
    }
  `]
})
export class HowToUseComponent {
  scrollTo(elementId: string, event: Event): void {
    event.preventDefault();
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
