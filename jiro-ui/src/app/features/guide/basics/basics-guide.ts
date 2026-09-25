import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GUIDE } from '../shared';

@Component({
  selector: 'app-basics-guide',
  standalone: true,
  imports: [RouterLink, GUIDE],
  template: `
    <guide-page heading="Getting around Jiro" mark="jiro"
      intro="The dashboard, search, settings and the other parts of Jiro every module shares.">

      <guide-section id="read-your-dashboard" title="Read your dashboard"
        lead="The dashboard is the first page you see after you sign in. Each card sums up one part of your life.">
        <guide-steps>
          <li>Open the <a routerLink="/dashboard">Dashboard</a> from the sidebar, or <strong>Home</strong> in the bar at the bottom of a phone.</li>
          <li>Read the cards. <strong>Last workout</strong>, <strong>Streak</strong>, <strong>Cook streak</strong>, <strong>Body weight</strong>, <strong>Recent recipes</strong>, <strong>This month</strong> and <strong>Last 14 days</strong> each show the latest from Jym, Journaly, Culinara or Ledger.</li>
          <li>Select the button on a card to act on it, such as <strong>Start a session</strong>, <strong>Write today</strong>, <strong>Log a cook</strong> or <strong>Open ledger</strong>. A recipe name opens that recipe.</li>
          <li>Under the cards, select <strong>Jym</strong>, <strong>Culinara</strong>, <strong>Journaly</strong> or <strong>Ledger</strong> to open that module's home page.</li>
        </guide-steps>
        <guide-shot guide="basics" name="dashboard" [width]="1600" [height]="1231"
          alt="The dashboard: a greeting and today's date, a Customise button, and cards for Last workout, Journal streak, Cook streak, Body weight and Recent recipes, each with a button such as Start a session or Write today." />
        <guide-tip>A card with nothing to show yet offers a first step instead, such as <strong>Plan your first split</strong> or <strong>Add your first account</strong>. Echo is marked Soon because it is not ready yet.</guide-tip>
      </guide-section>

      <guide-section id="verify-your-email" title="Verify your email"
        lead="A new account can read everything straight away, but it can only save changes once your email is verified.">
        <guide-steps>
          <li>After you create your account, open the email Jiro sends you and select the link in it.</li>
          <li>Jiro shows <strong>Email verified!</strong>. Select <strong>Go to dashboard</strong>.</li>
          <li>If the email has not arrived, select <strong>Resend email</strong> in the <strong>Verify your email to start saving changes</strong> bar at the top of the page.</li>
          <li>To check, open <a routerLink="/settings">Settings</a>. Under <strong>Account</strong>, your email shows <strong>Verified</strong> or <strong>Not verified</strong>.</li>
        </guide-steps>
        <p>Until you verify, anything that saves is refused: workouts, recipes, entries, transactions, your profile, your preferences and feedback. Opening, searching and downloading your data still work.</p>
        <guide-tip>The close button on the reminder bar hides it until you close the tab. A link that has expired shows <strong>Link invalid or expired</strong>, with a button to send a new one.</guide-tip>
      </guide-section>

      <guide-section id="move-between-modules" title="Move between modules"
        lead="Jiro has four modules: Jym, Culinara, Journaly and Ledger. You can reach each one from anywhere.">
        <h3>On a computer</h3>
        <guide-steps>
          <li>Select a module under <strong>Modules</strong> in the sidebar on the left.</li>
          <li>Use the row of tabs across the top of the module to move between its sections. In Jym these are <strong>Jym</strong>, <strong>Exercises</strong>, <strong>Plan</strong> and <strong>Track</strong>.</li>
          <li>Select <strong>Dashboard</strong> at the top of the sidebar to go back.</li>
        </guide-steps>
        <h3>On a phone</h3>
        <guide-steps>
          <li>From the dashboard, select a module in the row under the cards.</li>
          <li>Inside a module, the bar at the bottom shows its sections. Select <strong>Jiro</strong> at the left end of the bar to go back to the dashboard.</li>
          <li>Sections that do not fit in the bar appear as buttons at the top of the page. In Ledger these are <strong>Net Worth</strong> and <strong>Compare</strong>.</li>
        </guide-steps>
        <guide-shot guide="basics" name="phone-module" [width]="780" [height]="1688"
          alt="Jym on a phone: a top bar with the Jym name, a search button and the account button, and a bottom bar with Jiro, Jym, Exercises, Plan and Track." />
        <guide-tip>On a computer, the button beside the Jiro logo folds the sidebar down to icons, which gives the page more room. Select it again to open it out.</guide-tip>
      </guide-section>

      <guide-section id="see-a-whole-day" title="See a whole day"
        lead="The day page puts one day's workouts, cooking, meal plan, journal entries and spending side by side.">
        <guide-steps>
          <li>Select <a routerLink="/day">Today</a> in the sidebar, or in the bar at the bottom of a phone.</li>
          <li>Read the day in four parts: <strong>Jym</strong>, <strong>Culinara</strong>, <strong>Journaly</strong> and <strong>Ledger</strong>. Select a workout, recipe, entry or transaction to open it in its module.</li>
          <li>Use the left and right arrows beside the date to go back or forward a day. <strong>Today</strong> brings you back to the current day. You cannot move past today.</li>
          <li>To jump to a recent day, select a day in <strong>Last 14 days</strong> on the <a routerLink="/dashboard">Dashboard</a>.</li>
        </guide-steps>
        <guide-shot guide="basics" name="day-page" [width]="1520" [height]="1600"
          alt="The day page for yesterday: a Legs workout with 2 PRs and a weigh-in under Jym, then banana oat pancakes cooked and the day's planned breakfast, lunch and dinner under Culinara." />
        <guide-shot guide="basics" name="last-14-days" [width]="1600" [height]="284"
          alt="The Last 14 days card: one column per day, with a red square on workout days and a green square on journal days." />
        <p>You can also reach a day from the item itself. Look for <strong>See this day</strong> when you open a journal entry, a workout's details in Jym, a workout summary, or a transaction in Ledger.</p>
        <guide-tip>Where one day ends and the next begins follows the timezone in <a routerLink="/settings">Settings</a>.</guide-tip>
      </guide-section>

      <guide-section id="search-everything" title="Search everything"
        lead="Find a recipe, exercise, workout or journal entry from any page.">
        <guide-steps>
          <li>Press <kbd>Ctrl</kbd> <kbd>K</kbd>, or <kbd>⌘</kbd> <kbd>K</kbd> on a Mac. You can also select <strong>Search</strong> in the sidebar, or the search button in the top bar on a phone.</li>
          <li>Type at least two characters. Results are grouped into Recipes, Exercises, Sessions and Journal.</li>
          <li>Select a result to open it, or move with the arrow keys and press <kbd>Enter</kbd>.</li>
          <li>Press <kbd>Esc</kbd> to close search.</li>
        </guide-steps>
        <guide-shot guide="basics" name="search" [width]="1280" [height]="1102"
          alt="Search open with the word bench: one exercise, Bench Press, two Push sessions, and three journal entries that mention bench, with the match highlighted." />
        <guide-tip>Journal results match the words inside an entry, not just its title. Ledger transactions are not searched.</guide-tip>
      </guide-section>

      <guide-section id="customise-your-dashboard" title="Customise your dashboard"
        lead="Choose which cards the dashboard shows and the order they appear in.">
        <guide-steps>
          <li>Open the <a routerLink="/dashboard">Dashboard</a>.</li>
          <li>Select <strong>Customise</strong> at the top of the page.</li>
          <li>Tick a card to show it, or untick it to hide it.</li>
          <li>Use the up and down arrows to move a card.</li>
          <li>Select <strong>Save</strong>. <strong>Reset to default</strong> brings back every card in the original order.</li>
        </guide-steps>
        <guide-shot guide="basics" name="customise-dashboard" [width]="1120" [height]="1140"
          alt="The Customise dashboard window: a list of cards such as Last workout, Streak and This month, each with a tick box and up and down arrows, and Reset to default, Cancel and Save buttons." />
        <guide-tip>Your layout is saved to your account, so it is the same on every device you sign in on.</guide-tip>
      </guide-section>

      <guide-section id="set-your-preferences" title="Set your units, timezone, currency and theme"
        lead="Choose how Jiro shows weights and money, which timezone your days follow, and how it looks.">
        <guide-steps>
          <li>Open <a routerLink="/settings">Settings</a> from the bottom of the sidebar, or from <strong>Settings</strong> in the bar at the bottom of a phone.</li>
          <li>Under <strong>Preferences</strong>, pick <strong>Pounds (lbs)</strong> or <strong>Kilograms (kg)</strong> for <strong>Weight Unit</strong>. Every weight in Jym, including your body weight, is shown in that unit.</li>
          <li>Pick your <strong>Timezone</strong>. It decides where each day starts and ends: Today, the day page, <strong>Last 14 days</strong>, your streaks and the date a new item starts on. Every timezone is listed with its offset from UTC; type a city in the search box above the list to find yours quickly, or select <strong>Use this device's timezone</strong>.</li>
          <li>Pick your <strong>Currency</strong>. Every Ledger account, total and budget is shown in it. It changes how amounts are labelled, not the amounts themselves.</li>
          <li>Under <strong>Theme</strong>, turn <strong>Dark Mode</strong> on or off, and choose a <strong>Color theme</strong>: <strong>Earth</strong>, <strong>Forest</strong> or <strong>Slate</strong>.</li>
        </guide-steps>
        <guide-shot guide="basics" name="settings-preferences" [width]="1280" [height]="1068"
          alt="The Preferences card in Settings: Weight Unit set to Pounds (lbs), the Timezone search box above a list set to America/New York (UTC-04:00) with a Use this device's timezone button, and Currency set to USD (US dollar)." />
        <p>Each choice saves as soon as you make it; there is no Save button. Units, timezone, currency and colour theme are saved to your account. If a change cannot be saved (for example, before you have verified your email), Settings says why under the choices and puts the old value back. Dark mode is remembered on each device, so you can have it on your phone and off on your computer.</p>
        <guide-tip>You can also switch dark mode from the account menu: select your name at the bottom of the sidebar, or the round button with your initial at the top right on a phone, then <strong>Dark mode</strong>.</guide-tip>
      </guide-section>

      <guide-section id="download-your-data" title="Download your data"
        lead="Take a copy of everything in your account as one file.">
        <guide-steps>
          <li>Open <a routerLink="/settings">Settings</a> and scroll to <strong>Your data</strong>.</li>
          <li>Select <strong>Download my data</strong>. The button reads <strong>Preparing your file...</strong> while Jiro gathers everything.</li>
          <li>Your browser saves a file named <strong>jiro-export-</strong> followed by today's date, such as <strong>jiro-export-2026-09-25.json</strong>.</li>
        </guide-steps>
        <guide-shot guide="basics" name="download-data" [width]="1280" [height]="650"
          alt="The Your data card in Settings: a description of what the file holds, and a Download my data button." />
        <guide-tip>The file holds every module's data, your profile and your preferences. Passwords and sign-in details are never included.</guide-tip>
      </guide-section>

      <guide-section id="send-feedback" title="Send feedback"
        lead="Report a bug or suggest an idea without leaving the app.">
        <guide-steps>
          <li>Open the account menu: select your name at the bottom of the sidebar, or the round button with your initial at the top right on a phone.</li>
          <li>Select <strong>Send feedback</strong>.</li>
          <li>Choose <strong>Bug</strong>, <strong>Idea</strong> or <strong>Other</strong>.</li>
          <li>Describe what happened or what would help, then select <strong>Send</strong>.</li>
        </guide-steps>
        <guide-shot guide="basics" name="send-feedback" [width]="880" [height]="702"
          alt="The Send feedback window: Bug, Idea and Other buttons, a box for your message, and a Send button." />
      </guide-section>

      <guide-section id="try-the-demo" title="Try the demo"
        lead="The demo is a sample account full of realistic data, so you can look around before you sign up.">
        <guide-steps>
          <li>On the home page or the <strong>Log in</strong> page, select <strong>Try the demo</strong>.</li>
          <li>Explore any module. A bar at the top says <strong>You're exploring sample data.</strong></li>
          <li>When you are ready for your own account, select <strong>Create account</strong> in that bar. You leave the demo and go straight to sign-up.</li>
        </guide-steps>
        <p>The demo is look-only, and everyone shares it. Anything that would save is refused with a short message, so nothing you try there is kept. Settings such as units and theme change for your visit only. To leave without signing up, choose <strong>Log out</strong> from the account menu.</p>
      </guide-section>

    </guide-page>
  `,
  styles: [`
    h3 {
      font-size: var(--font-size-lg);
      color: var(--text-primary);
      margin: var(--space-lg) 0 var(--space-sm);
    }
  `],
})
export class BasicsGuideComponent {}
