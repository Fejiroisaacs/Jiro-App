import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { JiroLogoComponent } from '../../shared/components/jiro-logo/jiro-logo';
import { JiroPageHeaderComponent } from '../../shared/components/jiro-page-header/jiro-page-header';

/**
 * Public privacy policy. DRAFT: the owner reviews it before it ships.
 *
 * Plain static markup with no service calls, so it prerenders. Every factual
 * statement here was checked against the code (router, services, migrations,
 * browser storage). When the code changes, this page has to change with it.
 * Visible [TO CONFIRM: ...] and [CONTACT EMAIL] markers
 * are deliberate: they are facts the repo cannot answer.
 */
@Component({
  selector: 'app-privacy',
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
        <jiro-page-header heading="Privacy policy" subtitle="Draft, last updated 23 September 2026" />

        <p class="legal-draft" role="note">
          This is a draft. It has not been reviewed by a lawyer and it is not legal advice.
          Items marked <mark class="todo">TO CONFIRM</mark> are still being checked.
        </p>

        <section aria-labelledby="p-intro">
          <h2 id="p-intro">About this policy</h2>
          <p>
            Jiro is a personal app for recipes (Culinara), workouts (Jym), a journal (Journaly)
            and money (Ledger). This page explains what information Jiro keeps about you, why,
            where it is kept, and what you can do about it.
          </p>
          <p>
            Jiro is run by Oghenefejiro Anigboro. On this page, "we" and "us"
            mean Oghenefejiro Anigboro.
          </p>
        </section>

        <section aria-labelledby="p-collect">
          <h2 id="p-collect">What we collect</h2>

          <h3>Your account</h3>
          <ul>
            <li>Your email address and display name.</li>
            <li>Your password, stored only as an Argon2id hash. We cannot read your password.</li>
            <li>If you add them: a username, a short bio and a profile photo.</li>
            <li>Your settings: colour theme, weight unit and time zone.</li>
            <li>Whether your email address is verified, whether the account is an administrator, and when the account was created and last changed.</li>
          </ul>

          <h3>What you put into Jiro</h3>
          <ul>
            <li>
              <strong>Culinara:</strong> recipes (title, description, ingredients, instructions, tags,
              nutrition, dietary labels, image links and a cover photo), cooking trials (date, notes,
              changes you made, rating), recipe collections and meal plans.
            </li>
            <li>
              <strong>Jym:</strong> exercises, splits, routines and templates, training series, workout
              sessions (start and end time, type, notes), sets (weight, reps, effort rating, warm-up
              flag, notes, personal records), body weight entries, and photos or videos you attach to a session.
            </li>
            <li>
              <strong>Journaly:</strong> entries (title, text, mood, tags), photos on entries,
              collections and their cover photos, and the groups you create or join.
            </li>
            <li>
              <strong>Ledger:</strong> accounts (name, type, currency, balance), transactions (amount,
              description, notes, date, category, repeat schedule, transfers), categories, budgets and
              net worth snapshots. Ledger only holds what you type in. Jiro does not connect to your bank.
            </li>
            <li>Feedback you send us from inside the app.</li>
          </ul>

          <h3>People you invite</h3>
          <p>
            If you invite someone to a journal group, we store the email address you enter with the
            invitation and send that person an email.
          </p>

          <h3>Security records</h3>
          <ul>
            <li>
              Your IP address, used to limit how many requests can come from one address and to pause
              sign-ins after repeated failed attempts.
            </li>
            <li>
              For each signed-in session: a hash of the session token and when it expires.
            </li>
            <li>
              Hashes of email verification and password reset links, with their expiry times.
            </li>
          </ul>

          <h3>Usage events</h3>
          <p>
            Jiro keeps its own log of a small set of actions. Each record holds the name of the
            action, your account ID and the time. The actions are:
          </p>
          <ul>
            <li>creating an account and signing in;</li>
            <li>starting and finishing a workout session;</li>
            <li>creating a recipe, logging that you cooked one, and importing a recipe from a share link or from Discover;</li>
            <li>sharing a split and importing a split;</li>
            <li>downloading your account data or your workout history as a file.</li>
          </ul>
          <p>
            These records do not include what you wrote, which pages you viewed, your IP address or
            details about your device. They are stored in Jiro's own database, not sent to an
            analytics company, and shown to administrators in the admin panel.
          </p>

          <h3>The demo</h3>
          <p>
            "Try the demo" signs you in to a shared sample account that contains no personal data
            and cannot be changed. Opening it records one usage event in Jiro's own log, that the
            demo was started, and your IP address is used for rate limits like any other request.
          </p>
        </section>

        <section aria-labelledby="p-why">
          <h2 id="p-why">Why we use it</h2>
          <ul>
            <li>To run Jiro: to sign you in, save what you enter and show it back to you.</li>
            <li>
              To send the emails the service needs: verifying your address, resetting your password
              and journal group invitations. Jiro does not send marketing email.
            </li>
            <li>
              To keep accounts safe: limiting request rates, pausing repeated failed sign-ins, and
              requiring a verified email address before an account can make changes.
            </li>
            <li>To understand which features are used, from the usage events above.</li>
            <li>To read and act on feedback you send.</li>
          </ul>
          <p>We do not sell your information and Jiro does not show ads.</p>
          <p>
            <mark class="todo">[TO CONFIRM: the legal basis for each use, if Jiro is offered to people in the UK or EU.]</mark>
          </p>
        </section>

        <section aria-labelledby="p-admin">
          <h2 id="p-admin">What administrators can see</h2>
          <p>
            The admin panel shows each account's email address, username, display name, verification
            status and sign-up date; how many workout sessions, recipes and splits it has; when it last
            signed in and last finished a workout; the usage events above; and feedback.
          </p>
          <p>
            The admin panel does not display the content of your journal, recipes, workouts or
            finances. The people who operate Jiro do have technical access to the database and file
            storage, so they could see that content if they looked at it directly.
            <mark class="todo">[TO CONFIRM: who has operator access.]</mark>
          </p>
        </section>

        <section aria-labelledby="p-where">
          <h2 id="p-where">Where it is stored and who processes it</h2>
          <p>Jiro uses these services to run:</p>
          <ul>
            <li>
              <strong>Google Cloud Run</strong> runs the Jiro server that handles every request, in the
              us-east4 region (Northern Virginia, United States). Google keeps request logs for the
              service, which include IP addresses.
              <mark class="todo">[TO CONFIRM: how long these logs are kept.]</mark>
            </li>
            <li>
              <strong>Firebase Hosting</strong> (Google) serves the website itself.
              <mark class="todo">[TO CONFIRM: what Firebase Hosting logs and for how long.]</mark>
            </li>
            <li>
              <strong>The database</strong> (PostgreSQL) holds your account and everything you enter.
              The server only connects to it over an encrypted connection.
              <mark class="todo">[TO CONFIRM: database provider, region and backup schedule.]</mark>
            </li>
            <li>
              <strong>Cloudflare R2</strong> stores uploaded files.
              <mark class="todo">[TO CONFIRM: the storage location of the R2 buckets.]</mark>
              <ul>
                <li>
                  Profile photos and recipe cover photos are kept in a public bucket. Anyone who has
                  the address of one of these images can view it.
                </li>
                <li>
                  Journal photos, journal collection covers and workout attachments are kept in a
                  private bucket. Jiro shows them to you through links that stop working after one hour.
                  <mark class="todo">[TO CONFIRM: the private bucket is set up in production. Until it is, these files are stored in the public bucket.]</mark>
                </li>
              </ul>
            </li>
            <li>
              <strong>Resend</strong> sends Jiro's emails. It receives the recipient's email address and
              the message, which contains the verification, reset or invitation link.
            </li>
          </ul>
          <p>
            Fonts are served from our own domain, so loading a page does not contact a font provider.
          </p>
          <p>Jiro does not load advertising or third-party analytics scripts.</p>
          <p>
            Your information is processed in the United States.
            <mark class="todo">[TO CONFIRM: international transfer wording, if Jiro is offered outside the United States.]</mark>
          </p>
        </section>

        <section aria-labelledby="p-browser">
          <h2 id="p-browser">What stays in your browser</h2>
          <p>
            Jiro stores a few things in your browser so the app works. None of them are used for
            advertising or to follow you across other websites.
          </p>

          <h3>Cookie</h3>
          <dl class="legal-keys">
            <dt><code>refresh_token</code></dt>
            <dd>
              Keeps you signed in for up to 7 days. It can only be read by the Jiro server, not by
              scripts on the page, and it is only sent to the sign-in part of the server. The server
              stores a hash of it, not the token itself. It is removed when you sign out.
            </dd>
          </dl>
          <p>
            The short-lived access token that Jiro uses while you are on the page is kept in memory
            only and is not saved anywhere.
          </p>

          <h3>Local storage</h3>
          <dl class="legal-keys">
            <dt><code>jiro_user</code></dt>
            <dd>
              A copy of your profile (such as your email, names, profile photo link and settings) so
              the app can show it straight away. Removed when you sign out.
            </dd>
            <dt><code>jiro_dark</code></dt>
            <dd>Whether you turned dark mode on.</dd>
            <dt><code>culinara_shopping_list</code></dt>
            <dd>
              Your grocery list. It is kept only in this browser. It is not sent to our servers and
              is not included in your data download.
            </dd>
            <dt><code>jiro_cook_checklist_</code> followed by a recipe ID</dt>
            <dd>Which ingredients and steps you ticked off in cook mode.</dd>
            <dt><code>jiro_session_targets_</code> followed by a session ID</dt>
            <dd>
              The planned sets and reps for a workout in progress. Removed when you finish or discard
              the workout.
            </dd>
            <dt><code>jiro_journal_prompt_dismissed</code></dt>
            <dd>The date you last closed the daily journal prompt.</dd>
            <dt><code>jiro_jym_deload_snoozed</code></dt>
            <dd>When you last snoozed the deload suggestion in Jym.</dd>
          </dl>

          <h3>Session storage</h3>
          <dl class="legal-keys">
            <dt><code>jiro_verify_dismissed</code></dt>
            <dd>That you closed the "verify your email" banner. Cleared when you close the tab.</dd>
          </dl>

          <h3>Offline copy of the app</h3>
          <p>
            Jiro saves its own code, styles and images in your browser so it loads quickly and can
            open without a connection. It does not save your data this way.
          </p>
          <p>
            Signing out removes the cookie and the copy of your profile. The other items stay until
            you clear this site's data in your browser settings.
          </p>
        </section>

        <section aria-labelledby="p-sharing">
          <h2 id="p-sharing">Sharing</h2>
          <p>
            Everything you create is private to your account unless you choose one of the options
            below.
          </p>
          <ul>
            <li>
              <strong>Public recipes.</strong> If you make a recipe public, it appears on Culinara
              Discover. Anyone, including people without an account and search engines, can see its
              title, description, ingredients, instructions, tags, nutrition, dietary labels and images.
              Your name and your cooking trials are not shown. Signed-in users can copy it into their
              own account, and those copies remain if you later make the recipe private.
            </li>
            <li>
              <strong>Public splits.</strong> If you make a split public, it appears on Jym Discover
              with its name, description, tags, routines and exercises. Your name is not shown.
              Signed-in users can copy it into their own account.
            </li>
            <li>
              <strong>Recipe share links.</strong> Anyone with the link can view the recipe as it was
              when you created the link, and signed-in users can copy it. These links do not expire.
              Creating a new link for the same recipe replaces the old one, and deleting the recipe
              turns the link off.
            </li>
            <li>
              <strong>Split share links.</strong> Anyone with the link can view the split, its routines
              and exercises, and signed-in users can copy it. These links do not expire. You can turn
              a link off from the split's page.
            </li>
            <li>
              <strong>Your profile.</strong> If you set a username, anyone who knows it can look up
              your username, display name and bio.
            </li>
            <li>
              <strong>Journal groups.</strong> Members of a group can see the entries posted in it and
              the username and email address of every member. An invitation is sent by email, works for
              7 days, and can only be accepted by an account that uses the invited email address. If the
              owner deletes a group, the entries posted in it are deleted too.
            </li>
          </ul>
          <p>
            Share links are kept out of search engines, but anyone you pass a link to can open it.
          </p>
          <p>
            Apart from the services listed above and what you choose to share, we do not give your
            information to anyone else unless the law requires it.
          </p>
        </section>

        <section aria-labelledby="p-keep">
          <h2 id="p-keep">How long we keep it</h2>
          <ul>
            <li>
              <strong>Your account and content:</strong> until you delete it, or until the account is
              deleted. When you delete an item in Jiro it is removed from the database straight away.
              <mark class="todo">[TO CONFIRM: how long deleted data can remain in database backups.]</mark>
            </li>
            <li>
              <strong>Uploaded files:</strong> photos on a journal entry and workout attachments are
              removed from storage when you delete the entry, session or exercise they belong to.
              Replacing or removing a profile photo, recipe cover or collection cover removes the old
              file. Some files are not yet removed automatically: a recipe's cover photo when the whole
              recipe is deleted, a collection's cover when the collection is deleted, photos in a
              deleted journal group, and all uploaded files when an account is deleted. We remove
              these on request.
            </li>
            <li>
              <strong>IP address records</strong> for rate limits and failed sign-ins: deleted about
              24 hours after the last request from that address.
            </li>
            <li>
              <strong>Sign-in sessions</strong> expire after 7 days. Records of expired sessions are
              not yet cleared out automatically.
            </li>
            <li>
              <strong>Links in emails:</strong> verification links work for 24 hours and password reset
              links for 1 hour. Group invitations work for 7 days and are removed when accepted; unused
              invitations, including the invited email address, are not yet cleared out automatically.
            </li>
            <li>
              <strong>Usage events:</strong> not deleted automatically. If your account is deleted,
              the events remain but are no longer linked to you.
              <mark class="todo">[TO CONFIRM: a retention period for usage events.]</mark>
            </li>
            <li>
              <strong>Feedback:</strong> until an administrator deletes it or your account is deleted.
            </li>
          </ul>
        </section>

        <section aria-labelledby="p-rights">
          <h2 id="p-rights">Your choices and rights</h2>
          <ul>
            <li>
              <strong>Get a copy of your data.</strong> In Settings, choose "Download my data" to get
              a JSON file with your account, Jym, Culinara, Journaly and Ledger data. Uploaded files
              appear as links rather than the files themselves. The download does not include feedback
              you sent, your usage events or your grocery list (which lives only in your browser).
              You can ask for the rest at <mark class="todo">[CONTACT EMAIL]</mark>.
            </li>
            <li>
              <strong>Correct it.</strong> You can edit your profile and everything you have entered in
              the app. To change your email address, contact us.
            </li>
            <li>
              <strong>Delete it.</strong> You can delete individual items in the app. There is not yet
              a button to delete your whole account: email <mark class="todo">[CONTACT EMAIL]</mark> from
              the address on the account and we will delete it. Deleting an account removes its data
              from the database. If you own a journal group, the group and every entry in it are
              deleted too. See "How long we keep it" for what is not yet removed automatically.
            </li>
            <li>
              <strong>Stop sharing.</strong> You can make a recipe or split private again and turn off a
              split share link. Copies other people already made stay in their accounts.
            </li>
          </ul>
          <p>
            Depending on where you live, you may have other rights, such as objecting to some uses or
            complaining to a data protection authority.
            <mark class="todo">[TO CONFIRM: which laws apply and the relevant authority.]</mark>
          </p>
        </section>

        <section aria-labelledby="p-security">
          <h2 id="p-security">Security</h2>
          <ul>
            <li>Connections to Jiro use HTTPS.</li>
            <li>Passwords are stored as Argon2id hashes, and session tokens as SHA-256 hashes.</li>
            <li>Access tokens last 15 minutes and are not saved in your browser.</li>
            <li>An account must verify its email address before it can make changes.</li>
            <li>After 10 failed sign-ins from one IP address, sign-ins from that address are paused for 15 minutes.</li>
            <li>Private files are shown through links that expire after one hour.</li>
          </ul>
          <p>
            No system is completely secure. If we learn of a breach that affects your information, we
            will tell you. <mark class="todo">[TO CONFIRM: how and how quickly users are notified.]</mark>
          </p>
        </section>

        <section aria-labelledby="p-children">
          <h2 id="p-children">Children</h2>
          <p>
            Jiro is not meant for children under <mark class="todo">[TO CONFIRM: minimum age]</mark>.
          </p>
        </section>

        <section aria-labelledby="p-changes">
          <h2 id="p-changes">Changes to this policy</h2>
          <p>
            When this policy changes, we will update this page and the date at the top.
            <mark class="todo">[TO CONFIRM: whether significant changes are also announced by email or in the app.]</mark>
          </p>
        </section>

        <section aria-labelledby="p-contact">
          <h2 id="p-contact">Contact</h2>
          <p>
            Questions or requests about your information: <mark class="todo">[CONTACT EMAIL]</mark>.
            Jiro is run by Oghenefejiro Anigboro.
          </p>
          <p>See also the <a routerLink="/terms">terms of use</a>.</p>
        </section>
      </main>

      <footer class="legal-foot">
        <nav class="legal-foot-inner" aria-label="Legal">
          <a routerLink="/">Home</a>
          <a routerLink="/privacy" aria-current="page">Privacy</a>
          <a routerLink="/terms">Terms</a>
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
    h3 {
      font-size: var(--font-size-md);
      font-family: var(--font-family);
      font-weight: 600;
      margin: var(--space-md) 0 var(--space-xs);
    }

    p + p,
    p + ul,
    ul + p,
    dl + p { margin-top: var(--space-sm); }

    ul { padding-left: var(--space-lg); }
    ul ul { margin-top: var(--space-xs); }
    li + li { margin-top: var(--space-xs); }

    .legal-keys dt { margin-top: var(--space-sm); font-weight: 600; }
    .legal-keys dd { margin-left: 0; color: var(--text-secondary); }

    code {
      font-size: 0.9em;
      overflow-wrap: anywhere;
      padding: 0 var(--space-xs);
      border-radius: var(--border-radius-sm);
      background: var(--bg-surface-hover);
    }

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
export class PrivacyComponent {}
