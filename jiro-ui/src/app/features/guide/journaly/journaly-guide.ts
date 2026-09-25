import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GUIDE } from '../shared';

@Component({
  selector: 'app-journaly-guide',
  standalone: true,
  imports: [RouterLink, GUIDE],
  template: `
    <guide-page heading="Journaly guide" mark="journaly"
      intro="Write about your day, look back on it, and share with people you choose.">

      <guide-section id="write-an-entry" title="Write an entry"
        lead="A few words is enough. Only the entry itself is required.">
        <guide-steps>
          <li>Open <a routerLink="/journal">Journaly</a> and select <strong>New entry</strong>.</li>
          <li>Add a title if you like. It is optional.</li>
          <li>Write in the box below it. If you are stuck, use <strong>Today's prompt</strong>: select the question to start writing, the arrow for another question, or the cross to hide prompts for the rest of the day.</li>
          <li>Under <strong>Mood</strong>, pick the one that fits. Select it again to clear it.</li>
          <li>Under <strong>Tags</strong>, type a tag and press <kbd>Enter</kbd> or a comma. You can add up to 10.</li>
          <li>Under <strong>Collections</strong>, select any collection the entry belongs in.</li>
          <li>Select <strong>Publish</strong>. You go back to Journaly and the entry is on this week's calendar.</li>
        </guide-steps>
        <guide-shot guide="journaly" name="new-entry" [width]="1440" [height]="1872"
          alt="A new entry titled Long walk home, with today's writing prompt above the text, Calm picked as the mood, a walks tag, the Images and Collections sections, and a Publish button." />
        <guide-tip>Photos are added once the entry exists. See <a routerLink="/guide/journaly" fragment="add-photos">Add photos to an entry</a>.</guide-tip>
      </guide-section>

      <guide-section id="write-for-an-earlier-day" title="Write for an earlier day"
        lead="Catch up on a day you missed, and the entry is filed under that day.">
        <guide-steps>
          <li>On <a routerLink="/journal">Journaly</a>, use the arrows beside the dates to find the week.</li>
          <li>Select the <strong>+</strong> under the day.</li>
          <li>Select <strong>Write now</strong>, or <strong>New Entry</strong> if the day already has entries.</li>
          <li>The editor shows the date beside <strong>New entry</strong>. Write as usual and select <strong>Publish</strong>.</li>
        </guide-steps>
        <p>The entry counts for that day everywhere: the week view, the day view and your streak.</p>
      </guide-section>

      <guide-section id="add-photos" title="Add photos to an entry"
        lead="Each entry can hold up to three photos.">
        <guide-steps>
          <li>Publish the entry first. On a new entry, <strong>Add</strong> asks you to save before adding images.</li>
          <li>Open the entry again, for example from <a routerLink="/journal/entries">Entries</a>.</li>
          <li>Under <strong>Images</strong>, select <strong>Add</strong> and choose a JPEG, PNG or WebP file of up to 10 MB. It uploads straight away.</li>
          <li>To take a photo off, select the cross on its thumbnail. Select a thumbnail to see it full size.</li>
        </guide-steps>
      </guide-section>

      <guide-section id="use-the-week-view" title="Use the week view"
        lead="The Journaly tab shows one week at a time, Monday to Sunday.">
        <guide-steps>
          <li>Open <a routerLink="/journal">Journaly</a>. Each entry sits under its day as a note, with a coloured edge for its mood.</li>
          <li>Use the left and right arrows to move a week back or forward, and <strong>Today</strong> to come back to this week.</li>
          <li>Select a note to read that entry in full, or the <strong>+</strong> under a day to see all of that day's entries.</li>
          <li>In the day window, select an entry's time to read it, and <strong>Back</strong> to return to the list.</li>
          <li>Select <strong>See the whole day</strong> to open the day view for that date, or press <kbd>Esc</kbd> to close the window.</li>
        </guide-steps>
        <guide-shot guide="journaly" name="week-view" [width]="1600" [height]="540"
          alt="The week of Sep 21 to Sep 27 with arrows either side and a Today link. Tuesday, Wednesday and Thursday each hold a note showing the start of the entry and its mood." />
        <guide-shot guide="journaly" name="day-popup" [width]="1200" [height]="764"
          alt="The window for Tuesday, Sep 22: a See the whole day link, one entry marked Grateful at 7:35 PM with family and cooking tags and a Delete button, and a New Entry button." />
        <p>Below the calendar, <strong>Entries this week</strong> lists the same week's entries. Select one to open it.</p>
      </guide-section>

      <guide-section id="streak-and-mood-chart" title="Check your streak and mood chart"
        lead="The top of the Journaly tab shows how regularly you write and how the month has felt.">
        <ul>
          <li><strong>day streak</strong> is the number of days in a row with at least one entry. If you wrote yesterday but not yet today, the streak still stands until the day ends.</li>
          <li><strong>best</strong> is your longest run, and <strong>entries</strong> is how many you have written in all.</li>
          <li><strong>How the last 30 days felt</strong> counts the entries from the past 30 days that have a mood, one bar per mood, most common first. It appears once three entries have a mood.</li>
        </ul>
        <guide-shot guide="journaly" name="streak-and-mood" [width]="1600" [height]="617"
          alt="A 3 day streak, best 4, 15 entries, and the How the last 30 days felt chart with bars for Happy and Calm at 3, Grateful and Anxious at 2, and Energised, Tired and Stressed at 1." />
        <guide-tip>Days follow the <strong>Timezone</strong> in <a routerLink="/settings">Settings</a>. Entries written in a group do not count towards your streak. The same streak shows on the Journaly card on your <a routerLink="/dashboard">Dashboard</a>.</guide-tip>
      </guide-section>

      <guide-section id="find-an-old-entry" title="Find an old entry"
        lead="The Entries tab lists everything you have written, newest first.">
        <guide-steps>
          <li>Open <a routerLink="/journal/entries">Entries</a>. Entries are grouped by month, 20 to a page.</li>
          <li>Type in <strong>Search entries...</strong> to find words in a title or the entry itself.</li>
          <li>Choose a mood from <strong>All moods</strong> to see only entries with that mood.</li>
          <li>Type a tag in <strong>Filter by tag...</strong>. It must match the whole tag exactly, including capitals.</li>
          <li>Use <strong>Prev</strong>, <strong>Next</strong> or a page number at the bottom to move through the pages.</li>
          <li>Select <strong>Clear filters</strong> to see everything again, or select an entry to open it.</li>
        </guide-steps>
        <guide-shot guide="journaly" name="entries-filtered" [width]="1600" [height]="1102"
          alt="All entries filtered by the tag training: 4 matching entries under September 2026, each showing its date, mood, title or Untitled, the start of the text and its tags, with a Clear filters link." />
        <guide-tip>The same three filters sit below the calendar on the Journaly tab. While one is on, the list there searches your whole journal. Select <strong>Back to this week</strong> to return.</guide-tip>
      </guide-section>

      <guide-section id="edit-or-delete-an-entry" title="Edit or delete an entry"
        lead="Change anything you wrote, or remove an entry for good.">
        <h3>Edit</h3>
        <guide-steps>
          <li>Open the entry: select it on <a routerLink="/journal/entries">Entries</a> or in the list on the Journaly tab, or select <strong>Edit Entry</strong> in the day window.</li>
          <li>Change the title, text, mood, tags or photos.</li>
          <li>Select <strong>Save</strong>.</li>
        </guide-steps>
        <h3>Delete</h3>
        <guide-steps>
          <li>On the <a routerLink="/journal">Journaly</a> tab, select the bin on the entry in the list below the calendar. You can also select <strong>Delete</strong> in the day window.</li>
          <li>Select <strong>Delete entry</strong> to confirm.</li>
        </guide-steps>
        <p>Deleting removes the entry and its photos permanently. The editor and the Entries tab have no delete button, so find the entry's week on the Journaly tab.</p>
      </guide-section>

      <guide-section id="keep-entries-in-a-collection" title="Keep entries in a collection"
        lead="A collection gathers entries on one theme, such as a trip or a training block.">
        <guide-steps>
          <li>Open <a routerLink="/journal/collections">Collections</a> and select <strong>+ New</strong>.</li>
          <li>Enter a <strong>Name</strong> and, if you like, a <strong>Description</strong>, then select <strong>Create</strong>.</li>
          <li>When you write a new entry, select the collection under <strong>Collections</strong> before you select <strong>Publish</strong>.</li>
          <li>Select a collection on the Collections tab to read its entries.</li>
        </guide-steps>
        <guide-shot guide="journaly" name="new-collection" [width]="1040" [height]="590"
          alt="The New Collection window with the name Trips, the description Places I went and what I remember, and Cancel and Create buttons." />
        <p>Inside a collection, select <strong>Edit</strong> to rename it, change its description or <strong>Delete</strong> it. Deleting a collection keeps its entries in your journal. To add a cover, select the folder picture beside the name and choose a JPEG, PNG or WebP image of up to 5 MB.</p>
        <guide-tip>An entry joins a collection when you publish it. Selecting a collection while editing an older entry does not add it.</guide-tip>
      </guide-section>

      <guide-section id="journal-with-other-people" title="Journal with other people"
        lead="A group is a shared journal. Everyone in it can read every entry posted there.">
        <h3>Start a group</h3>
        <guide-steps>
          <li>Open <a routerLink="/journal/groups">Groups</a> and select <strong>+ New Group</strong>, or <strong>Create Group</strong> if you have none yet.</li>
          <li>Enter a <strong>Group name</strong> and select <strong>Create</strong>. The group opens.</li>
        </guide-steps>
        <guide-shot guide="journaly" name="groups-empty" [width]="1600" [height]="548"
          alt="The Groups tab with no groups yet, a + New Group button and a Create Group button." />
        <guide-shot guide="journaly" name="new-group" [width]="1040" [height]="444"
          alt="The New Group window with the group name Book club, and Cancel and Create buttons." />

        <h3>Invite someone</h3>
        <guide-steps>
          <li>In the group, select <strong>Members</strong>. Only the person who made the group can invite.</li>
          <li>Under <strong>Invite someone</strong>, enter the email address of their Jiro account and select <strong>Invite</strong>.</li>
          <li>They get an email with an <strong>Accept Invite</strong> link. Until they use it, the members list shows <strong>Invite pending</strong>.</li>
        </guide-steps>

        <h3>Join with an invite</h3>
        <guide-steps>
          <li>Open the <strong>Accept Invite</strong> link in the email. It works for 7 days.</li>
          <li>If asked, select <strong>Sign In</strong> and sign in with the email address the invite was sent to.</li>
          <li>When you see <strong>You're in!</strong>, select <strong>Open Group</strong>.</li>
        </guide-steps>

        <h3>Post to the group</h3>
        <guide-steps>
          <li>In the group, select <strong>+ Write</strong>, or the <strong>+</strong> under a day to write for that day.</li>
          <li>Write the entry and select <strong>Publish</strong>. It appears in the group with your name on it.</li>
        </guide-steps>
        <p>Group entries stay in the group. They do not appear in your own week view, Entries tab, day view or streak. You can edit or delete only your own entries there.</p>
        <p>In <strong>Members</strong>, the group's creator can rename the group, remove members or select <strong>Delete group</strong>, which removes every entry in it for everyone. Anyone else can leave with the button beside their own name.</p>
      </guide-section>

      <guide-section id="journaly-in-the-day-view" title="See Journaly in the day view"
        lead="The day view puts one date's workouts, meals, journal entries and spending side by side.">
        <guide-steps>
          <li>Open it from <strong>See the whole day</strong> in a day window on <a routerLink="/journal">Journaly</a>, or from <strong>See this day</strong> at the top of an entry you are editing.</li>
          <li>The <strong>Journaly</strong> part lists that day's entries with their time and mood. Select one to open it.</li>
          <li>If the day has no entry yet, select <strong>Write an entry</strong> to write for that date.</li>
        </guide-steps>
      </guide-section>

    </guide-page>
  `,
})
export class JournalyGuideComponent {}
