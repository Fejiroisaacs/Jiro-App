import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GUIDE } from '../shared';

@Component({
  selector: 'app-jym-guide',
  standalone: true,
  imports: [RouterLink, GUIDE],
  template: `
    <guide-page heading="Jym guide" mark="jym"
      intro="Plan your training, log workouts and see your progress.">

      <guide-section id="see-your-training-at-a-glance" title="See your training at a glance"
        lead="The Jym home page shows how often you train and gets you into your next workout.">
        <p>Open <a routerLink="/jym">Jym</a>. From top to bottom it shows:</p>
        <ul>
          <li><strong>Activity</strong>: a square for each day of the past 16 weeks, darker on days you trained.</li>
          <li><strong>Muscle groups</strong>: how often you trained each muscle group in the last 4 weeks, and how long ago you last trained it, counted in your own calendar days: Today, Yesterday or a number of days ago.</li>
          <li><strong>In progress</strong>: any workout you left without finishing, with <strong>Resume</strong> and a bin button to discard it.</li>
          <li><strong>Active series</strong>: each series you are running, its progress, and <strong>View</strong> and <strong>Start</strong>.</li>
          <li><strong>Your splits</strong> and <strong>Templates</strong>: select one to start a workout from it.</li>
        </ul>
        <guide-shot guide="jym" name="home" [width]="1600" [height]="1163"
          alt="The Jym home page: an Activity grid for the past 16 weeks, Muscle groups with bars and days since last trained, an active series called Spring strength block at 5 of 6 weeks, and the Push Pull Legs split." />
        <guide-tip>If your last three workouts averaged at least 5% less volume than the last time you trained each of those days, and none of them set a PR, the home page asks <strong>Time for a lighter week?</strong> Select <strong>Start next session as a deload</strong> to start your series' next day as a deload, or <strong>Not now</strong> to hide it for a week.</guide-tip>
      </guide-section>

      <guide-section id="find-or-add-an-exercise" title="Find or add an exercise"
        lead="Your exercise library holds every lift you log, with your best set for each.">
        <guide-steps>
          <li>Open <a routerLink="/jym/exercises">Exercises</a>.</li>
          <li>Type in <strong>Search exercises...</strong>, or select a muscle group such as <strong>Chest</strong> to filter the list.</li>
          <li>To add one, select <strong>New exercise</strong>, enter a <strong>Name</strong>, choose its <strong>Type</strong> and a <strong>Main muscle group</strong>. Under <strong>Also works</strong>, select any other muscles it trains, such as Triceps for a bench press. Add any <strong>Notes</strong>, then select <strong>Create exercise</strong>.</li>
          <li>Filtering by a muscle also lists exercises that work it as an extra muscle. Your stats count each exercise under its main muscle group only.</li>
          <li>The <strong>Type</strong> sets what you log. <strong>Weight × reps</strong> is for most lifts. <strong>Bodyweight</strong> is reps with any weight you add, such as pull-ups with a belt, and counts your body weight. <strong>Duration</strong> is a time held, such as a plank. <strong>Distance + time</strong> is for runs, rows and rides, and shows your pace. Use <strong>All types</strong> to filter the list.</li>
          <li>Once an exercise has logged sets, it can only switch between weight × reps and bodyweight. For another type, make a new exercise.</li>
          <li>To rename or delete an exercise, open the menu at the end of its row and choose <strong>Edit</strong> or <strong>Delete</strong>. A new name shows in your past sessions too.</li>
        </guide-steps>
        <guide-tip>You can also create an exercise while building a split or during a workout, from the search box in <strong>Add exercise</strong>.</guide-tip>
      </guide-section>

      <guide-section id="check-an-exercise" title="Check an exercise's progress"
        lead="Each exercise has its own page with your best lifts, a chart and every workout it was in.">
        <guide-steps>
          <li>In <a routerLink="/jym/exercises">Exercises</a>, select an exercise.</li>
          <li>The top shows your <strong>Best weight</strong> and <strong>Est. 1RM</strong>, the most you could likely lift once, worked out from your weight and reps.</li>
          <li>Switch the chart between <strong>Est. 1RM</strong>, <strong>Volume</strong>, <strong>Max weight</strong> and <strong>Reps &#64; Weight</strong>. For Reps &#64; Weight, choose a weight from the list.</li>
          <li>Choose <strong>3M</strong>, <strong>1Y</strong> or <strong>All</strong> to set how far back the chart goes. Workouts sit at their real dates, so a break from training shows as a gap.</li>
          <li>Below the chart, <strong>Workouts</strong> lists every workout with this exercise, newest first, with its sets. Select one to open its summary, and <strong>Show older workouts</strong> to go further back. <strong>See all workouts with</strong> the exercise opens them in Track.</li>
          <li><strong>Form progression</strong> shows the form check clips you added during workouts, and <strong>Notes</strong> shows the notes you wrote for this exercise.</li>
        </guide-steps>
        <guide-shot guide="jym" name="exercise-detail" [width]="1600" [height]="1422"
          alt="The Bench Press page: Chest, with Shoulders and Triceps as the other muscles it works, Best weight 175.0 lbs and Est. 1RM 210.1 lbs, a note, the Est. 1RM chart with 3M, 1Y and All, rising from August to late September, and the Workouts, Form progression and Notes tabs." />
        <guide-tip>If your top weight has stayed the same, or dropped, over your last three sessions of an exercise, its page says so and suggests what to try.</guide-tip>
      </guide-section>

      <guide-section id="build-a-split" title="Build a split"
        lead="A split is your training week: a set of days, each with its exercises and target sets and reps.">
        <guide-steps>
          <li>Open <a routerLink="/jym/plan">Plan</a> and select <strong>New split</strong>.</li>
          <li>Enter a <strong>Split name</strong>, and optionally a description and tags, then select <strong>Create split</strong>.</li>
          <li>Select <strong>Build</strong> on the split, then <strong>Add day</strong>. Give the day a <strong>Day name</strong> such as Push, check the <strong>Day order</strong> (it starts after your last day), and select <strong>Add day</strong>.</li>
          <li>Under a day, select <strong>+ Add exercise</strong>, search, and pick an exercise.</li>
          <li>Set the <strong>Sets</strong> and <strong>Reps</strong> targets, then select <strong>Add</strong> followed by the exercise's name.</li>
          <li>To change the order, drag an exercise by the dotted handle on its left. Drag it onto another day to move it there. On a phone, the days scroll along as you drag toward the edge.</li>
          <li>To rename a day, select its name, type the new one and press Enter. To reorder days, use the arrows beside its name to move it earlier or later.</li>
          <li>To change an exercise's plan, select its sets and reps, such as <strong>4×6</strong>. Set the <strong>Sets</strong> and <strong>Reps</strong>, and optionally <strong>Up to</strong> for a rep range such as 8 to 12, an <strong>RPE</strong> from 6 to 10, a <strong>Rest</strong> just for this exercise, and a <strong>Note</strong> such as a cue. Select <strong>Save</strong>.</li>
          <li>To pair exercises into a superset, select the link button on the first of two exercises next to each other. They're labelled A1 and A2; linking a third makes a circuit. Select the link again to split them.</li>
        </guide-steps>
        <guide-shot guide="jym" name="split-builder" [width]="1600" [height]="1300"
          alt="The Push Pull Legs split: day columns listing exercises with their plans, such as 4×6 · RPE 8 · 3:00 with a note under it, Lateral Raise and Tricep Pushdown linked as A1 and A2, and buttons for Start series, Share and Add day." />
        <guide-shot guide="jym" name="add-exercise" [width]="960" [height]="798"
          alt="The Add exercise window: a search for raise found Lateral Raise, with Sets 3, Reps 8 and an Add Lateral Raise button." />
        <guide-tip>Remove an exercise from a day with its x button. Use the pencil beside the split's name to rename it.</guide-tip>
      </guide-section>

      <guide-section id="start-a-workout" title="Start a workout"
        lead="Start from a day of a split to get its exercises and targets ready, or start an empty freestyle session.">
        <guide-steps>
          <li>On the <a routerLink="/jym">Jym</a> home page, select the play button on a split. You can also select <strong>Start</strong> on a split in <a routerLink="/jym/plan">Plan</a>.</li>
          <li>In <strong>Choose a day</strong>, pick the day you are training, or <strong>Freestyle</strong>.</li>
          <li>For a workout with no plan, select <strong>Freestyle session</strong> on the Jym home page, or <strong>New session</strong> in <a routerLink="/jym/track">Track</a>.</li>
          <li>With Jiro installed on an Android phone or a computer, press and hold (or right-click) its icon for <strong>Start workout</strong> and <strong>Resume workout</strong>. iPhones don't offer these shortcuts.</li>
        </guide-steps>
        <guide-tip>If you leave a workout without finishing it, it waits under <strong>In progress</strong> on the Jym home page until you resume or discard it.</guide-tip>
      </guide-section>

      <guide-section id="log-your-sets" title="Log your sets"
        lead="The workout screen has a row for every set, and it times your rest between them.">
        <guide-steps>
          <li>A workout started from a split day or template already lists its exercises, with one row for each target set. In a freestyle session, select <strong>+ Add exercise</strong> first.</li>
          <li>The faint numbers in an empty row are today's aim, worked out from your last workout. A note above the rows shows what you lifted last time and what to try. With a rep range, add weight once every set reaches the top of the range. For an exercise you have never logged, the row shows only the target reps.</li>
          <li>Type the <strong>Weight</strong> and <strong>Reps</strong> you did, or leave the aim as it is. A number keypad opens for each box.</li>
          <li>Optionally, enter an <strong>RPE</strong> from 1 to 10 for how hard the set felt.</li>
          <li>Select the tick to log what the row shows, so repeating a set is one tap. If it beats your best for that exercise, it gets a <strong>PR</strong> badge. Warm-up sets never get one.</li>
          <li>The rest timer opens under the bar at the top, for the exercise's planned rest or your usual one. Select <strong>+30s</strong> for a longer rest this time, or <strong>Skip</strong>. It beeps when your rest is over.</li>
          <li>To give an exercise its own rest in every workout, open its menu (three dots) and select <strong>Rest timer</strong>, then a length. <strong>Usual</strong> goes back to your usual rest. A plan's rest still comes first.</li>
          <li>Select a set's number to mark it as a warm-up or to remove it. To fix a logged set, select its weight or reps, change them and select <strong>Save</strong>.</li>
          <li>Use <strong>+ Add set</strong> for another set and <strong>+ Add exercise</strong> for another exercise.</li>
          <li>To change the order, open an exercise's menu (three dots) and select <strong>Move up</strong> or <strong>Move down</strong>. <strong>Remove exercise</strong> is there too.</li>
          <li>In a superset, do one set of each exercise in turn: after A1 there is no rest and A2's next set is marked; after the last one, the rest starts. To pair exercises during a workout, select <strong>Superset with next</strong> in the first one's menu, or <strong>Unlink from next</strong> to split them.</li>
        </guide-steps>
        <guide-shot guide="jym" name="session-sets" [width]="1400" [height]="1268"
          alt="Bench Press during a workout: a note saying last time was 175 lbs for 5, 5, 5, 5 and to try 180 lbs, a warm-up set of 95 lbs marked with a flame, four logged sets of 175 lbs with the 6-rep set marked PR, a sixth row ready to log 175 lbs for 5, and a Plates button." />
        <guide-tip>A set is a PR when it is the heaviest weight you have logged for that exercise, or the same top weight for more reps. Warm-ups are left out on both sides: they never count as a PR and never raise the bar for one. Marking a PR set as a warm-up takes its badge away. The first time you do an exercise sets your baseline, so PRs start from your second workout with it.</guide-tip>
        <guide-tip>A locked phone can hold the rest timer's beep until you look again. To keep the screen on during a workout, open <strong>Workout options</strong> and set <strong>Keep screen on</strong> to <strong>On</strong>. It only applies to this device.</guide-tip>
      </guide-section>

      <guide-section id="warm-up-and-load-the-bar" title="Warm up and load the bar"
        lead="Jym can plan your warm-up sets and tell you which plates go on each side of the bar.">
        <guide-steps>
          <li>Before you log an exercise's first set, select <strong>Add warm-up sets</strong> above its rows. It adds the bar for 10, then about half, 70% and 85% of your working weight for 5, 3 and 1, rounded down to weights you can load.</li>
          <li>Log each warm-up with its tick, like any other set.</li>
          <li>Select <strong>Plates</strong> under an exercise to see the plates for each side at the next set's weight, or type any weight. If your plates can't make it exactly, it offers the nearest weights you can load.</li>
          <li>Set your bar weight and the plates you have in <a routerLink="/settings" fragment="workouts">Settings, Workouts</a>.</li>
        </guide-steps>
        <guide-shot guide="jym" name="plates" [width]="780" [height]="686"
          alt="The Plates window for 225 lbs: a 45 plate and a 45 plate drawn on the bar, the words Each side: 45, 45, and a line saying On a 45 lbs bar with a Change bar and plates link." />
        <guide-tip>The warm-up offer appears once an exercise has a working weight above the bar, typed or suggested from last time.</guide-tip>
      </guide-section>

      <guide-section id="add-notes-body-weight-and-form-checks" title="Add notes, body weight and form checks"
        lead="Keep extra details with the workout while you train.">
        <guide-steps>
          <li>Type in <strong>Session notes</strong> at the top for the whole workout, or in <strong>Exercise note</strong> under an exercise. Notes save when you leave the box.</li>
          <li>To record today's body weight, type it next to <strong>Body weight</strong> and select <strong>Log</strong>.</li>
          <li>To film your form, log at least one set of the exercise, then select <strong>+ Form check</strong> and choose a video or photo. You can add one clip per exercise in each workout. If the upload fails, select <strong>Retry</strong>.</li>
          <li>To mark the workout as lighter or as a max attempt, select the <strong>Workout options</strong> button (three dots) in the top bar, then <strong>Deload</strong> or <strong>Test</strong> instead of <strong>Normal</strong>.</li>
        </guide-steps>
        <guide-tip>Deload sessions are left out of the next workout's suggestions and your series volume chart.</guide-tip>
      </guide-section>

      <guide-section id="finish-a-workout" title="Finish a workout"
        lead="Finishing saves the workout and shows a summary of what you did.">
        <guide-steps>
          <li>Select <strong>Finish</strong> in the top bar. You need at least one logged set or some session notes.</li>
          <li>The summary shows your <strong>Duration</strong>, <strong>Volume</strong> and <strong>Work sets</strong> (warm-ups are not counted), any new PRs, and how your sets compare with <strong>Last time</strong>.</li>
          <li>Select <strong>Share workout</strong> to make an image of the summary to share or save, or <strong>Done</strong> to go back to Jym.</li>
        </guide-steps>
        <guide-tip>To stop without finishing, open <strong>Workout options</strong>. <strong>Leave for now</strong> keeps the workout open so you can resume it later, and <strong>Discard workout</strong> deletes it.</guide-tip>
        <p>Forgot to finish? After 3 hours with no new set, Jym offers to finish the workout at your last set, so it doesn't run on for days. The offer shows in the workout, on the Jym home page, and when you start your next one.</p>
        <p>If you open a finished workout's old link, Jym shows its summary instead. To add a set you forgot, select <strong>Edit workout</strong> on the summary.</p>
      </guide-section>

      <guide-section id="save-and-reuse-a-template" title="Save and reuse a template"
        lead="A template is a workout on its own, outside any split, that you can start again whenever you like.">
        <guide-steps>
          <li>During a workout with at least one logged set, open <strong>Workout options</strong> and select <strong>Save as template</strong>. A finished workout's summary has the same button.</li>
          <li>Enter a name and select <strong>Save template</strong>.</li>
          <li>To make one from a split's day instead, open the day's menu (three dots) on the split and select <strong>Save as template</strong>. The day stays in the split.</li>
          <li>To use it, select the template under <strong>Templates</strong> on the <a routerLink="/jym">Jym</a> home page, or select <strong>Start</strong> on it in <a routerLink="/jym/plan" [queryParams]="{ tab: 'templates' }">Plan, Templates</a>.</li>
          <li>To change one, select <strong>Edit</strong> on it in Plan, Templates. Rename it with the pencil, and add, drag, link or remove exercises and set their plans the same way as on a split's day.</li>
          <li>To put a template into a split, select <strong>Add to split</strong> while editing it, then the split. A copy becomes the split's last day, and the template stays as it is.</li>
        </guide-steps>
        <guide-shot guide="jym" name="save-template" [width]="840" [height]="584"
          alt="The Save as template window with the name Push day A, and Cancel and Save template buttons." />
      </guide-section>

      <guide-section id="run-a-series" title="Run a series"
        lead="A series is a training block on one split, such as eight weeks, with charts of how it went.">
        <guide-steps>
          <li>In <a routerLink="/jym/plan">Plan</a>, select <strong>Series</strong> on a split. You can also select <strong>Start series</strong> on the split's own page.</li>
          <li>Enter a <strong>Series name</strong>, then choose its <strong>Length</strong>: <strong>Open-ended</strong>, <strong>Weeks</strong> or <strong>Sessions</strong>. For weeks or sessions, enter the number.</li>
          <li>Select <strong>Start series</strong>. The series page opens.</li>
          <li>To train in the series, select <strong>Start session</strong> on its page, or <strong>Start</strong> on it on the Jym home page. Only workouts started this way count towards the series.</li>
          <li>The series page shows your <strong>Progress</strong>, and charts for <strong>Volume</strong> and <strong>Est. 1RM</strong>. <strong>Compare</strong> sets it against another series of the same split.</li>
          <li>When the block is over, select <strong>End series</strong>.</li>
        </guide-steps>
        <guide-shot guide="jym" name="new-series" [width]="880" [height]="834"
          alt="The Start series window: the name Autumn block, Weeks selected, and Number of weeks 8." />
        <guide-shot guide="jym" name="series-detail" [width]="1600" [height]="1422"
          alt="The Spring strength block series: Active, 18 sessions, progress at 5 of 6 weeks, a bar chart of volume per session, and the list of sessions." />
        <guide-tip>Your series are listed in <a routerLink="/jym/plan" [queryParams]="{ tab: 'series' }">Plan, Series</a>, with active series first and ended ones below.</guide-tip>
      </guide-section>

      <guide-section id="review-past-workouts" title="Review past workouts"
        lead="Every finished workout is listed in Track, newest first.">
        <guide-steps>
          <li>Open <a routerLink="/jym/track">Track</a>. Each workout shows its date, day, sets, time and volume.</li>
          <li>To narrow the list, choose an <strong>Exercise</strong> or a <strong>Type</strong> (Regular, Deload or Test). <strong>Calendar</strong> shows a month with a dot on each day you trained: select a day to list just that day, and select it again to list every day. <strong>Clear filters</strong> shows everything again.</li>
          <li>Select a workout to see every set, with PR badges, warm-ups, RPE and exercise notes, plus its notes and any form check clips. <strong>View summary</strong> opens its summary, and <strong>See this day</strong> opens everything else you logged that day.</li>
          <li>On a summary, <strong>Edit workout</strong> opens the workout to add a set you forgot, or change or remove one. Select <strong>Done</strong> when you're finished. Records are worked out as of that workout's date.</li>
          <li><strong>Edit times</strong> fixes when the workout started or finished, as long as the times still include every set you logged. <strong>Repeat workout</strong> starts it again with the same exercises.</li>
          <li>Trained without the app? Select <strong>Log past workout</strong>, or <strong>Log a workout</strong> on a past day's page. Choose when it <strong>Started</strong> and <strong>Finished</strong> and which workout it was, select <strong>Add sets</strong>, and enter your sets.</li>
          <li>To download your workouts as a spreadsheet, optionally choose <strong>From</strong> and <strong>To</strong> dates, then select <strong>Export CSV</strong>.</li>
        </guide-steps>
        <guide-shot guide="jym" name="track-sessions" [width]="1600" [height]="1600"
          alt="Track, Sessions: Export CSV, then the Exercise and Type filters and a Calendar button above the list of workouts, with the Push workout of Sat 26 Sep open to show its sets, and on Bench Press a set marked Warm-up and a PR." />
      </guide-section>

      <guide-section id="see-your-personal-records" title="See your personal records"
        lead="The PRs tab puts your best lift for every exercise on one page.">
        <guide-steps>
          <li>Open <a routerLink="/jym/exercises">Exercises</a> and select <strong>PRs</strong>.</li>
          <li>Records are grouped by muscle group, each with the <strong>Best lift</strong>, <strong>Est. 1RM</strong> and the date.</li>
          <li>Select a record to open that exercise.</li>
        </guide-steps>
        <guide-shot guide="jym" name="prs" [width]="1600" [height]="1163"
          alt="The PRs tab: 12 exercises, 6 muscle groups and a top est. 1RM of 453.3 lbs, then tables for Back, Biceps and Chest listing lifts such as Deadlift 295 lbs × 5." />
      </guide-section>

      <guide-section id="track-your-body-weight" title="Track your body weight"
        lead="Log your weight on any day and see how it changes.">
        <guide-steps>
          <li>Open <a routerLink="/jym/track" [queryParams]="{ tab: 'bodyweight' }">Track</a> and select <strong>Body weight</strong>.</li>
          <li>Check the <strong>Date</strong>, enter your <strong>Weight</strong>, and select <strong>Log</strong>.</li>
          <li>Once you have two entries, <strong>Weight over time</strong> charts them. <strong>Recent entries</strong> lists each one with the change from the one before, and a bin button to delete it.</li>
        </guide-steps>
        <guide-shot guide="jym" name="body-weight" [width]="1600" [height]="1163"
          alt="Track, Body weight: the Log weight form with Date and Weight, and a chart falling from 181.4 lbs in August to 178.1 lbs in September." />
      </guide-section>

      <guide-section id="share-or-borrow-a-split" title="Share or borrow a split"
        lead="Send someone a link to your split, list it for everyone, or copy one someone else made.">
        <h3>Share a link</h3>
        <guide-steps>
          <li>Open the split from <a routerLink="/jym/plan">Plan</a> with <strong>Build</strong>, and select <strong>Share</strong>.</li>
          <li>Select <strong>Copy</strong> and send the link. Anyone can view it. Someone signed in to Jiro can select <strong>Import to my account</strong> to copy it into their splits.</li>
          <li>A link lasts 30 days. Selecting <strong>Share</strong> again shows the same link while it lasts, and the split's page lists it whenever you come back.</li>
          <li>To stop the link working, select <strong>Revoke link</strong>.</li>
        </guide-steps>
        <h3>Use Discover</h3>
        <guide-steps>
          <li>To list your split for everyone, select <strong>Public</strong> on its page. <strong>Private</strong> takes it off the list.</li>
          <li>To find other people's splits, select <strong>Discover</strong> in <a routerLink="/jym/plan">Plan</a>, or open <a routerLink="/jym/discover">Discover</a>.</li>
          <li>Search by name, or filter by tag, and select <strong>Search</strong>.</li>
          <li>Open a split to see its days and exercises, then select <strong>Add to my splits</strong>, and <strong>Open it</strong> to go to your copy.</li>
        </guide-steps>
        <guide-tip>When you copy a split, its exercises are matched to ones in your library with the same name, and any you do not have are created for you. Copying the same split again opens the copy you already have.</guide-tip>
      </guide-section>

      <guide-section id="switch-between-kg-and-lbs" title="Switch between kg and lbs"
        lead="Jym shows every weight in the unit you choose, and converts your past lifts for you.">
        <guide-steps>
          <li>Open <a routerLink="/settings">Settings</a>.</li>
          <li>Under <strong>Preferences</strong>, choose <strong>Pounds (lbs)</strong> or <strong>Kilograms (kg)</strong> for <strong>Weight unit</strong>. It saves straight away.</li>
        </guide-steps>
        <guide-tip>During a workout, <strong>Units</strong> in <strong>Workout options</strong> changes the same setting.</guide-tip>
      </guide-section>

    </guide-page>
  `,
})
export class JymGuideComponent {}
