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
          <li><strong>Muscle Groups</strong>: how often you trained each muscle group in the last 4 weeks, and how long ago you last trained it, counted in your own calendar days: Today, Yesterday or a number of days ago.</li>
          <li><strong>In Progress</strong>: any workout you left without finishing, with <strong>Resume</strong> and a bin button to discard it.</li>
          <li><strong>Active series</strong>: each series you are running, its progress, and <strong>View</strong> and <strong>Start</strong>.</li>
          <li><strong>Your splits</strong> and <strong>Templates</strong>: select one to start a workout from it.</li>
        </ul>
        <guide-shot guide="jym" name="home" [width]="1600" [height]="1163"
          alt="The Jym home page: an Activity grid for the past 16 weeks, Muscle Groups with bars and days since last trained, an active series called Spring strength block at 5 of 6 weeks, and the Push Pull Legs split." />
        <guide-tip>If your volume has dropped across your last four sessions and none of them set a PR, the home page asks <strong>Time for a lighter week?</strong> Select <strong>Start next session as a deload</strong>, or <strong>Not now</strong> to hide it for a week.</guide-tip>
      </guide-section>

      <guide-section id="find-or-add-an-exercise" title="Find or add an exercise"
        lead="Your exercise library holds every lift you log, with your best set for each.">
        <guide-steps>
          <li>Open <a routerLink="/jym/exercises">Exercises</a>.</li>
          <li>Type in <strong>Search exercises...</strong>, or select a muscle group such as <strong>Chest</strong> to filter the list.</li>
          <li>To add one, select <strong>New exercise</strong>, enter a <strong>Name</strong>, choose a <strong>Muscle group</strong>, add any <strong>Notes</strong>, then select <strong>Create exercise</strong>.</li>
          <li>To rename or delete an exercise, open the menu at the end of its row and choose <strong>Edit</strong> or <strong>Delete</strong>. A new name shows in your past sessions too.</li>
        </guide-steps>
        <guide-tip>You can also create an exercise while building a split or during a workout, from the search box in <strong>Add Exercise</strong>.</guide-tip>
      </guide-section>

      <guide-section id="check-an-exercise" title="Check an exercise's progress"
        lead="Each exercise has its own page with your best lifts, a chart and every set you have logged.">
        <guide-steps>
          <li>In <a routerLink="/jym/exercises">Exercises</a>, select an exercise.</li>
          <li>The top shows your <strong>Best Weight</strong> and <strong>Est. 1RM</strong>, the most you could likely lift once, worked out from your weight and reps.</li>
          <li>Switch the chart between <strong>Est. 1RM</strong>, <strong>Volume</strong>, <strong>Max Weight</strong> and <strong>Reps &#64; Weight</strong>. For Reps &#64; Weight, choose a weight from the list.</li>
          <li>Below the chart, <strong>Set History</strong> lists every set. Select a column heading to sort by it.</li>
          <li><strong>Form Progression</strong> shows the form check clips you added during workouts, and <strong>Notes</strong> shows the notes you wrote for this exercise.</li>
        </guide-steps>
        <guide-shot guide="jym" name="exercise-detail" [width]="1600" [height]="1422"
          alt="The Bench Press page: Best Weight 175 lbs and Est. 1RM 210.1 lbs, a note, the Est. 1RM chart rising from August to September, and the Set History, Form Progression and Notes tabs." />
        <guide-tip>If your top weight has stayed the same, or dropped, over your last three sessions of an exercise, its page says so and suggests what to try.</guide-tip>
      </guide-section>

      <guide-section id="build-a-split" title="Build a split"
        lead="A split is your training week: a set of days, each with its exercises and target sets and reps.">
        <guide-steps>
          <li>Open <a routerLink="/jym/plan">Plan</a> and select <strong>New split</strong>.</li>
          <li>Enter a <strong>Split Name</strong>, and optionally a description and tags, then select <strong>Create Split</strong>.</li>
          <li>Select <strong>Build</strong> on the split, then <strong>Add Day</strong>. Give the day a <strong>Day Name</strong> such as Push, check the <strong>Day Order</strong>, and select <strong>Add Day</strong>.</li>
          <li>Under a day, select <strong>+ Add Exercise</strong>, search, and pick an exercise.</li>
          <li>Set the <strong>Sets</strong> and <strong>Reps</strong> targets, then select <strong>Add</strong> followed by the exercise's name.</li>
          <li>To change the order, drag an exercise by the dotted handle on its left. Drag it onto another day to move it there.</li>
          <li>To change an exercise's targets, select its sets and reps, such as <strong>4×6</strong>, enter the new <strong>Sets</strong> and <strong>Reps</strong>, and select <strong>Save</strong>.</li>
        </guide-steps>
        <guide-shot guide="jym" name="split-builder" [width]="1600" [height]="869"
          alt="The Push Pull Legs split: three day columns, Push, Pull and Legs, each listing exercises with targets such as 4×6, and buttons for Start Series, Share and Add Day." />
        <guide-shot guide="jym" name="add-exercise" [width]="960" [height]="798"
          alt="The Add Exercise window: a search for raise found Lateral Raise, with Sets 3, Reps 8 and an Add Lateral Raise button." />
        <guide-tip>Remove an exercise from a day with its × button. Use the pencil beside the split's name to rename it.</guide-tip>
      </guide-section>

      <guide-section id="start-a-workout" title="Start a workout"
        lead="Start from a day of a split to get its exercises and targets ready, or start an empty freestyle session.">
        <guide-steps>
          <li>On the <a routerLink="/jym">Jym</a> home page, select the play button on a split. You can also select <strong>Start</strong> on a split in <a routerLink="/jym/plan">Plan</a>.</li>
          <li>In <strong>Choose Routine</strong>, pick the day you are training, or <strong>Freestyle (no routine)</strong>.</li>
          <li>For a workout with no plan, select <strong>Freestyle session</strong> on the Jym home page, or <strong>New session</strong> in <a routerLink="/jym/track">Track</a>.</li>
        </guide-steps>
        <guide-tip>If you leave a workout without finishing it, it waits under <strong>In Progress</strong> on the Jym home page until you resume or discard it.</guide-tip>
      </guide-section>

      <guide-section id="log-your-sets" title="Log your sets"
        lead="The workout screen has a row for every set, and it times your rest between them.">
        <guide-steps>
          <li>A workout started from a split day or template already lists its exercises, with one row for each target set. In a freestyle session, select <strong>+ Add Exercise</strong> first.</li>
          <li>The faint numbers in an empty row are a suggestion: the heaviest weight from your last session plus a small step, and the reps you did then. A note above the rows shows what you lifted last time and the weight to try. For an exercise you have never logged, the row shows only the target reps.</li>
          <li>Type the <strong>Weight</strong> and <strong>Reps</strong> you did. The suggestion is not filled in for you.</li>
          <li>Optionally, enter an <strong>RPE</strong> from 1 to 10 for how hard the set felt, and select the flame button to mark a warm-up set.</li>
          <li>Select the tick to log the set. If it beats your best for that exercise, it gets a <strong>PR</strong> badge. Warm-up sets never get one.</li>
          <li>The rest timer starts in the bar at the top. Choose <strong>1m</strong>, <strong>1:30</strong>, <strong>2m</strong>, <strong>3m</strong> or <strong>5m</strong>, add <strong>+30s</strong>, or select × to skip it. It beeps when your rest is over.</li>
          <li>Use <strong>+ Add Set</strong> for another set and <strong>+ Add Exercise</strong> for another exercise. The × on a logged set removes it.</li>
        </guide-steps>
        <guide-shot guide="jym" name="session-sets" [width]="1400" [height]="1098"
          alt="Bench Press during a workout: a warm-up set of 95 lbs, four logged sets of 175 lbs with the 6-rep set marked PR, and a sixth row suggesting 175 lbs and 5 reps." />
        <guide-tip>A set is a PR when it is the heaviest weight you have logged for that exercise, or the same top weight for more reps. Warm-ups are left out on both sides: they never count as a PR and never raise the bar for one. Marking a PR set as a warm-up takes its badge away.</guide-tip>
      </guide-section>

      <guide-section id="add-notes-body-weight-and-form-checks" title="Add notes, body weight and form checks"
        lead="Keep extra details with the workout while you train.">
        <guide-steps>
          <li>Type in <strong>Session notes (optional)...</strong> at the top for the whole workout, or in <strong>Note for this exercise...</strong> under an exercise. Notes save when you leave the box.</li>
          <li>To record today's body weight, type it next to <strong>Body weight</strong> and select <strong>Log</strong>.</li>
          <li>To film your form, log at least one set of the exercise, then select <strong>+ Form Check</strong> and choose a video or photo. You can add one clip per exercise in each workout. If the upload fails, select <strong>Retry</strong>.</li>
          <li>To mark the workout as lighter or as a max attempt, select <strong>Deload</strong> or <strong>Test</strong> in the top bar instead of <strong>Normal</strong>.</li>
        </guide-steps>
        <guide-tip>Deload sessions are left out of the next workout's suggestions and your series volume chart.</guide-tip>
      </guide-section>

      <guide-section id="finish-a-workout" title="Finish a workout"
        lead="Finishing saves the workout and shows a summary of what you did.">
        <guide-steps>
          <li>Select <strong>Finish</strong> in the top bar. You need at least one logged set or some session notes.</li>
          <li>The summary shows your <strong>Duration</strong>, <strong>Volume</strong> and <strong>Work Sets</strong> (warm-ups are not counted), any new PRs, and how your sets compare with <strong>Last time</strong>.</li>
          <li>Select <strong>Share Workout</strong> to make an image of the summary to share or save, or <strong>Done</strong> to go back to Jym.</li>
        </guide-steps>
        <guide-tip>To stop without finishing, select <strong>Exit</strong>. <strong>Save &amp; Exit</strong> keeps your sets so you can resume later, and <strong>Discard Session</strong> deletes the workout.</guide-tip>
        <p>A finished workout is closed for new sets. If you open its old workout link, Jym shows it in <a routerLink="/jym/track">Track</a> instead, with every set you logged.</p>
      </guide-section>

      <guide-section id="save-and-reuse-a-template" title="Save and reuse a template"
        lead="A template keeps a workout's exercises so you can start the same workout again.">
        <guide-steps>
          <li>During a workout with at least one logged set, select the save button in the top bar, labelled <strong>Save as template</strong>.</li>
          <li>Enter a name and select <strong>Save Template</strong>.</li>
          <li>To use it, select the template under <strong>Templates</strong> on the <a routerLink="/jym">Jym</a> home page, or select <strong>Start</strong> on it in <a routerLink="/jym/plan" [queryParams]="{ tab: 'templates' }">Plan, Templates</a>.</li>
        </guide-steps>
        <guide-shot guide="jym" name="save-template" [width]="840" [height]="504"
          alt="The Save as Template window with the name Push day A, and Cancel and Save Template buttons." />
      </guide-section>

      <guide-section id="run-a-series" title="Run a series"
        lead="A series is a training block on one split, such as eight weeks, with charts of how it went.">
        <guide-steps>
          <li>In <a routerLink="/jym/plan">Plan</a>, select <strong>Series</strong> on a split. You can also select <strong>Start Series</strong> on the split's own page.</li>
          <li>Enter a <strong>Series name</strong>, then choose its <strong>Length</strong>: <strong>Open-ended</strong>, <strong>Weeks</strong> or <strong>Sessions</strong>. For weeks or sessions, enter the number.</li>
          <li>Select <strong>Start Series</strong>. The series page opens.</li>
          <li>To train in the series, select <strong>Start Session</strong> on its page, or <strong>Start</strong> on it on the Jym home page. Only workouts started this way count towards the series.</li>
          <li>The series page shows your <strong>Progress</strong>, and charts for <strong>Volume</strong> and <strong>Est. 1RM</strong>. <strong>Compare</strong> sets it against another series of the same split.</li>
          <li>When the block is over, select <strong>End Series</strong>.</li>
        </guide-steps>
        <guide-shot guide="jym" name="new-series" [width]="880" [height]="834"
          alt="The Start Series window: the name Autumn block, Weeks selected, and Number of weeks 8." />
        <guide-shot guide="jym" name="series-detail" [width]="1600" [height]="1422"
          alt="The Spring strength block series: Active, 18 sessions, progress at 5 of 6 weeks, a bar chart of volume per session, and the list of sessions." />
        <guide-tip>Your series are listed in <a routerLink="/jym/plan" [queryParams]="{ tab: 'series' }">Plan, Series</a>, with active series first and ended ones below.</guide-tip>
      </guide-section>

      <guide-section id="review-past-workouts" title="Review past workouts"
        lead="Every finished workout is listed in Track, newest first.">
        <guide-steps>
          <li>Open <a routerLink="/jym/track">Track</a>. Each workout shows its date, day, sets, time and volume.</li>
          <li>Select a workout to see every set, with PR badges and warm-up sets marked, its notes and any form check clips. <strong>See this day</strong> opens everything else you logged that day.</li>
          <li>To download your workouts as a spreadsheet, optionally choose <strong>From</strong> and <strong>To</strong> dates, then select <strong>Export CSV</strong>.</li>
        </guide-steps>
        <guide-shot guide="jym" name="track-sessions" [width]="1600" [height]="1600"
          alt="Track, Sessions: date fields and Export CSV above a list of workouts, with the Push workout of 20 September open to show its sets, and on Bench Press a set marked Warm-up and a PR." />
      </guide-section>

      <guide-section id="see-your-personal-records" title="See your personal records"
        lead="The PRs tab puts your best lift for every exercise on one page.">
        <guide-steps>
          <li>Open <a routerLink="/jym/exercises">Exercises</a> and select <strong>PRs</strong>.</li>
          <li>Records are grouped by muscle group, each with the <strong>Best Lift</strong>, <strong>Est. 1RM</strong> and the date.</li>
          <li>Select a record to open that exercise.</li>
        </guide-steps>
        <guide-shot guide="jym" name="prs" [width]="1600" [height]="1163"
          alt="The PRs tab: 8 exercises, 5 muscle groups and a top est. 1RM of 476 lbs, then tables for Back, Biceps and Chest listing lifts such as Deadlift 295 lbs × 5." />
      </guide-section>

      <guide-section id="track-your-body-weight" title="Track your body weight"
        lead="Log your weight on any day and see how it changes.">
        <guide-steps>
          <li>Open <a routerLink="/jym/track" [queryParams]="{ tab: 'bodyweight' }">Track</a> and select <strong>Body Weight</strong>.</li>
          <li>Check the <strong>Date</strong>, enter your <strong>Weight</strong>, and select <strong>Log</strong>.</li>
          <li>Once you have two entries, <strong>Weight over time</strong> charts them. <strong>Recent entries</strong> lists each one with the change from the one before, and a bin button to delete it.</li>
        </guide-steps>
        <guide-shot guide="jym" name="body-weight" [width]="1600" [height]="1163"
          alt="Track, Body Weight: the Log weight form with Date and Weight, and a chart falling from 181.4 lbs in August to 178.1 lbs in September." />
      </guide-section>

      <guide-section id="share-or-borrow-a-split" title="Share or borrow a split"
        lead="Send someone a link to your split, list it for everyone, or copy one someone else made.">
        <h3>Share a link</h3>
        <guide-steps>
          <li>Open the split from <a routerLink="/jym/plan">Plan</a> with <strong>Build</strong>, and select <strong>Share</strong>.</li>
          <li>Select <strong>Copy</strong> and send the link. Anyone can view it. Someone signed in to Jiro can select <strong>Import to My Account</strong> to copy it into their splits.</li>
          <li>To stop the link working, select <strong>Revoke link</strong>.</li>
        </guide-steps>
        <h3>Use Discover</h3>
        <guide-steps>
          <li>To list your split for everyone, select <strong>Public</strong> on its page. <strong>Private</strong> takes it off the list.</li>
          <li>To find other people's splits, select <strong>Discover</strong> in <a routerLink="/jym/plan">Plan</a>, or open <a routerLink="/jym/discover">Discover</a>.</li>
          <li>Search by name, or filter by tag, and select <strong>Search</strong>.</li>
          <li>Open a split to see its days and exercises, then select <strong>Add to my splits</strong>.</li>
        </guide-steps>
        <guide-tip>When you copy a split, its exercises are matched to ones in your library with the same name, and any you do not have are created for you.</guide-tip>
      </guide-section>

      <guide-section id="switch-between-kg-and-lbs" title="Switch between kg and lbs"
        lead="Jym shows every weight in the unit you choose, and converts your past lifts for you.">
        <guide-steps>
          <li>Open <a routerLink="/settings">Settings</a>.</li>
          <li>Under <strong>Preferences</strong>, choose <strong>Pounds (lbs)</strong> or <strong>Kilograms (kg)</strong> for <strong>Weight Unit</strong>. It saves straight away.</li>
        </guide-steps>
        <guide-tip>During a workout, the <strong>lbs</strong> and <strong>kg</strong> buttons in the top bar change the same setting.</guide-tip>
      </guide-section>

    </guide-page>
  `,
})
export class JymGuideComponent {}
