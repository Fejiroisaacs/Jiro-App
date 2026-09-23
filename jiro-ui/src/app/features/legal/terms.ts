import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { JiroLogoComponent } from '../../shared/components/jiro-logo/jiro-logo';
import { JiroPageHeaderComponent } from '../../shared/components/jiro-page-header/jiro-page-header';

/**
 * Public terms of use. DRAFT: the owner reviews it before it ships.
 *
 * Plain static markup with no service calls, so it prerenders. Styles match
 * the privacy page (features/legal/privacy.ts); keep the two in step.
 * Visible [TO CONFIRM: ...], [CONTACT EMAIL] and [DATA CONTROLLER] markers
 * are deliberate: they are facts the repo cannot answer.
 */
@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [RouterLink, JiroLogoComponent, JiroPageHeaderComponent],
  template: `
    <div class="legal">
      <header class="legal-top">
        <div class="legal-top-inner">
          <a routerLink="/" class="legal-home" aria-label="Jiro home">
            <jiro-logo [size]="28" />
          </a>
        </div>
      </header>

      <main class="legal-main">
        <jiro-page-header heading="Terms of use" subtitle="Draft, last updated 23 September 2026" />

        <p class="legal-draft" role="note">
          This is a draft. It has not been reviewed by a lawyer and it is not legal advice.
          Items marked <mark class="todo">TO CONFIRM</mark> are still being checked.
        </p>

        <section aria-labelledby="t-about">
          <h2 id="t-about">About these terms</h2>
          <p>
            These terms are an agreement between you and <mark class="todo">[DATA CONTROLLER]</mark>,
            who runs Jiro ("we" and "us"). By creating an account or using Jiro, you agree to them.
            How we handle your information is described in the
            <a routerLink="/privacy">privacy policy</a>.
          </p>
          <p>
            Jiro is currently free to use. <mark class="todo">[TO CONFIRM: pricing, and whether paid features are planned.]</mark>
          </p>
        </section>

        <section aria-labelledby="t-account">
          <h2 id="t-account">Your account</h2>
          <ul>
            <li>You must be at least <mark class="todo">[TO CONFIRM: minimum age]</mark> to use Jiro.</li>
            <li>Use an email address you control. You need to verify it before your account can make changes.</li>
            <li>Keep your password to yourself. You are responsible for what happens in your account.</li>
            <li>
              If you think someone else has used your account, reset your password and tell us at
              <mark class="todo">[CONTACT EMAIL]</mark>.
            </li>
          </ul>
        </section>

        <section aria-labelledby="t-use">
          <h2 id="t-use">Acceptable use</h2>
          <p>When you use Jiro, do not:</p>
          <ul>
            <li>break the law, or use Jiro to help someone else break it;</li>
            <li>upload content you do not have the right to share, or content that is illegal;</li>
            <li>publish other people's personal information without their permission;</li>
            <li>use journal group invitations or share links to send spam or to harass anyone;</li>
            <li>try to get into other people's accounts or data, or get around Jiro's security or rate limits;</li>
            <li>overload the service, or collect data from it with automated tools;</li>
            <li>upload malware or anything designed to harm Jiro or its users.</li>
          </ul>
        </section>

        <section aria-labelledby="t-content">
          <h2 id="t-content">Your content stays yours</h2>
          <p>
            You own the recipes, workouts, journal entries, financial records, photos and anything else
            you put into Jiro. We do not claim ownership of it.
          </p>
          <p>
            You give us permission to store, process and display your content only as needed to run
            Jiro for you, and to show it to others in the ways you choose (see "Public sharing" below).
          </p>
          <p>
            You can download a copy of your data at any time from Settings, using "Download my data".
          </p>
        </section>

        <section aria-labelledby="t-sharing">
          <h2 id="t-sharing">Public sharing</h2>
          <p>
            Some things can be shared outside your account: public recipes on Culinara Discover, public
            splits on Jym Discover, share links for recipes and splits, and journal groups.
          </p>
          <ul>
            <li>You are responsible for what you choose to make public or share.</li>
            <li>
              When you make a recipe or split public, or share a link to it, you allow other people to
              view it and to copy it into their own Jiro accounts. Copies already made stay in their
              accounts if you later make the item private or turn the link off.
            </li>
            <li>Share links do not expire. Anyone who has the link can open it.</li>
            <li>Entries you post in a journal group can be read by every member of that group.</li>
            <li>We may remove public content that breaks these terms.</li>
          </ul>
        </section>

        <section aria-labelledby="t-advice">
          <h2 id="t-advice">Not professional advice</h2>
          <p>
            Jym's estimates, such as personal records and estimated one-rep maximums, are calculations
            from the numbers you enter. They are not medical or training advice. Ledger is a record of
            what you type in. It is not financial advice and it does not connect to your bank. Nutrition
            and dietary details on recipes are entered by users and may be wrong.
          </p>
        </section>

        <section aria-labelledby="t-availability">
          <h2 id="t-availability">Availability</h2>
          <p>
            Jiro is provided "as is" and "as available". We work to keep it running and your data safe,
            but we cannot promise it will always be available, free of errors, or that data will never
            be lost. Download a copy of your data from time to time if it matters to you.
          </p>
          <p>We may change, pause or remove features, and we may stop running Jiro.
            <mark class="todo">[TO CONFIRM: how much notice users get before the service is shut down.]</mark>
          </p>
        </section>

        <section aria-labelledby="t-ending">
          <h2 id="t-ending">Ending your use of Jiro</h2>
          <p>
            You can stop using Jiro at any time. To delete your account, email
            <mark class="todo">[CONTACT EMAIL]</mark> from the address on the account. There is not yet
            a button for this in the app.
          </p>
          <p>
            We may suspend or delete an account that breaks these terms. Where we reasonably can, we
            will tell you first and give you a chance to download your data.
          </p>
        </section>

        <section aria-labelledby="t-liability">
          <h2 id="t-liability">Limits on our responsibility</h2>
          <p>As far as the law allows:</p>
          <ul>
            <li>
              we are not responsible for indirect losses, such as lost profits, or for losses caused by
              data being lost or unavailable;
            </li>
            <li>
              our total responsibility to you for any claim is limited to
              <mark class="todo">[TO CONFIRM: liability cap]</mark>.
            </li>
          </ul>
          <p>
            Nothing in these terms limits responsibility that the law does not allow to be limited, or
            takes away rights you have as a consumer.
          </p>
        </section>

        <section aria-labelledby="t-changes">
          <h2 id="t-changes">Changes to these terms</h2>
          <p>
            When these terms change, we will update this page and the date at the top. If you keep
            using Jiro after a change, the new terms apply.
            <mark class="todo">[TO CONFIRM: whether significant changes are also announced by email or in the app.]</mark>
          </p>
        </section>

        <section aria-labelledby="t-law">
          <h2 id="t-law">Governing law</h2>
          <p>
            These terms are governed by the law of <mark class="todo">[TO CONFIRM: governing law and courts]</mark>.
          </p>
        </section>

        <section aria-labelledby="t-contact">
          <h2 id="t-contact">Contact</h2>
          <p>
            Questions about these terms: <mark class="todo">[CONTACT EMAIL]</mark>.
            Jiro is run by <mark class="todo">[DATA CONTROLLER]</mark>.
          </p>
        </section>
      </main>

      <footer class="legal-foot">
        <nav class="legal-foot-inner" aria-label="Legal">
          <a routerLink="/">Home</a>
          <a routerLink="/privacy">Privacy</a>
          <a routerLink="/terms" aria-current="page">Terms</a>
        </nav>
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .legal {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      background: var(--bg-canvas);
      color: var(--text-primary);
    }

    .legal-top { border-bottom: 1px solid var(--border-color); }
    .legal-top-inner,
    .legal-foot-inner {
      max-width: 65ch;
      margin: 0 auto;
      padding: var(--space-md);
    }
    .legal-home {
      display: inline-flex;
      color: var(--text-primary);
      border-radius: var(--border-radius-sm);
    }
    .legal-home:hover { text-decoration: none; }

    .legal-main {
      flex: 1;
      width: 100%;
      max-width: 65ch;
      margin: 0 auto;
      padding: var(--space-xl) var(--space-md) var(--space-2xl);
      line-height: var(--line-height-body);
    }

    .legal-draft {
      margin-bottom: var(--space-xl);
      padding: var(--space-sm) var(--space-md);
      border-left: 3px solid var(--color-warning);
      border-radius: var(--border-radius-sm);
      background: rgba(var(--color-warning-rgb), 0.1);
      color: var(--text-primary);
    }

    section + section { margin-top: var(--space-xl); }

    h2 {
      font-size: var(--font-size-xl);
      line-height: var(--line-height-tight);
      margin-bottom: var(--space-sm);
      text-wrap: balance;
    }

    p + p,
    p + ul,
    ul + p { margin-top: var(--space-sm); }

    ul { padding-left: var(--space-lg); }
    li + li { margin-top: var(--space-xs); }

    mark.todo {
      padding: 0 var(--space-xs);
      border-radius: var(--border-radius-sm);
      background: rgba(var(--color-warning-rgb), 0.2);
      color: inherit;
    }

    .legal-main a {
      color: var(--color-primary);
      text-decoration: underline;
    }

    .legal-foot { border-top: 1px solid var(--border-color); }
    .legal-foot-inner {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-md);
      font-size: var(--font-size-sm);
    }
    .legal-foot-inner a { color: var(--text-secondary); }
    .legal-foot-inner a:hover,
    .legal-foot-inner a[aria-current='page'] { color: var(--text-primary); }
  `],
})
export class TermsComponent {}
