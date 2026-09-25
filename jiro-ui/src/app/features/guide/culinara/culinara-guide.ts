import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GUIDE } from '../shared';

@Component({
  selector: 'app-culinara-guide',
  standalone: true,
  imports: [RouterLink, GUIDE],
  template: `
    <guide-page heading="Culinara guide" mark="culinara"
      intro="Keep your recipes, cook from them and plan the week's meals.">

      <guide-section id="add-a-recipe" title="Add a recipe"
        lead="Write down a recipe once, then cook from it and keep notes on every attempt.">
        <guide-steps>
          <li>Open <a routerLink="/culinara">Culinara</a> and select <strong>New recipe</strong>.</li>
          <li>Give it a <strong>Title</strong>. This is the only field you have to fill in.</li>
          <li>Add a short <strong>Description</strong> if you like.</li>
          <li>Under <strong>Tags</strong>, select any of the ready-made tags, or type your own in <strong>Add custom tag...</strong> and select <strong>Add</strong>.</li>
          <li>Under <strong>Base Ingredients</strong>, select <strong>+ Add ingredient</strong> for each one and fill in the item and the amount.</li>
          <li>Type the method under <strong>Instructions</strong>, one step per line. Cook mode shows each line as its own step.</li>
          <li>If they apply, select <strong>Dietary Flags</strong> such as <strong>Vegetarian</strong> or <strong>Gluten-Free</strong>, and fill in <strong>Nutrition</strong> per serving.</li>
          <li>Optionally pick a collection under <strong>Add to Collection</strong>.</li>
          <li>Select <strong>Create Recipe</strong>.</li>
        </guide-steps>
        <guide-shot guide="culinara" name="new-recipe" [width]="1200" [height]="1800"
          alt="The New recipe window with the title Lemon Garlic Pasta, a description, the Dinner tag selected, two ingredients (spaghetti 200g, garlic 3 cloves) and three lines of instructions." />
        <p>To add a cover photo, open the recipe and select <strong>Add cover photo</strong> above the title. It takes a JPEG, PNG or WebP image under 5 MB. Once a photo is on, the buttons on it let you change or remove it.</p>
        <guide-tip>To change a recipe later, open it, select the <strong>...</strong> menu next to <strong>Start cooking</strong>, then <strong>Edit</strong>. The same menu has <strong>Delete</strong>, which removes the recipe and its trial log.</guide-tip>
      </guide-section>

      <guide-section id="find-a-recipe" title="Find a recipe"
        lead="Search, sort and filter your recipes from the Culinara page.">
        <guide-steps>
          <li>Open <a routerLink="/culinara">Culinara</a>.</li>
          <li>Type in <strong>Search recipes...</strong> to find recipes by title.</li>
          <li>Choose an order: <strong>Newest</strong>, <strong>Most Trials</strong>, <strong>Highest Rated</strong> or <strong>A-Z</strong>.</li>
          <li>Select a tag to show only recipes with it. Select it again, or <strong>All</strong>, to show everything.</li>
          <li>The collection row below the tags filters by collection in the same way.</li>
          <li>Select a recipe card to open it.</li>
        </guide-steps>
        <guide-shot guide="culinara" name="find-recipes" [width]="1600" [height]="1163"
          alt="The Culinara page with the quick tag selected: four quick recipes, each card showing its rating, number of trials, tags, first ingredients and when it was last made." />
      </guide-section>

      <guide-section id="use-collections" title="Group recipes into collections"
        lead="Collections are folders for recipes, such as Breakfasts or Meal prep. A recipe can be in more than one.">
        <guide-steps>
          <li>On the <a routerLink="/culinara">Culinara</a> page, select <strong>New collection</strong> in the collection row (once you have one, it is the <strong>+</strong> at the end of the row). Type a name and press <kbd>Enter</kbd>.</li>
          <li>You can also make one while writing a recipe: in the <strong>New recipe</strong> window, open <strong>Add to Collection</strong>, choose <strong>+ New Collection</strong>, type a name and select <strong>Create</strong>.</li>
          <li>To add an existing recipe, open it and select <strong>Add to collection</strong> under the nutrition figures, then choose a collection. Choose it again to take the recipe out.</li>
          <li>Back on the Culinara page, select a collection to see only its recipes.</li>
        </guide-steps>
      </guide-section>

      <guide-section id="cook-a-recipe" title="Cook with cook mode"
        lead="A clean, step by step view for the kitchen.">
        <guide-steps>
          <li>Open a recipe and select <strong>Start cooking</strong>.</li>
          <li>Tick off each ingredient as you get it out, and each step as you finish it. Your ticks are kept on this device, so you can leave and come back.</li>
          <li>When you are done, choose stars under <strong>Rate this cook</strong> and add any notes.</li>
          <li>Select <strong>Log this cook</strong>. This adds a trial dated today to the recipe's trial log and takes you back to the recipe.</li>
        </guide-steps>
        <guide-shot guide="culinara" name="recipe-page" [width]="1600" [height]="1163"
          alt="A recipe page for Greek Chicken Rice Bowls with the Start cooking button, the Share publicly switch, tags, dietary flags, nutrition, rating stats and the Trial Log with two past trials." />
        <guide-shot guide="culinara" name="cook-mode" [width]="780" [height]="1688"
          alt="Cook mode on a phone: a list of ingredients with tick boxes, the first step below them, and a bar at the bottom with four of five stars chosen, a notes box and the Log this cook button." />
        <guide-tip>Select <strong>Exit</strong>, or press <kbd>Esc</kbd>, to go back to the recipe without logging. Where the browser supports it, cook mode also keeps your screen from going to sleep.</guide-tip>
      </guide-section>

      <guide-section id="log-a-trial" title="Log how a cook went"
        lead="Each time you make a recipe, log a trial: what you changed, how it turned out and what to try next time.">
        <guide-steps>
          <li>Open the recipe and select <strong>+ Log Trial</strong> in the <strong>Trial Log</strong>. On a phone, switch to the <strong>Trial Log</strong> tab first.</li>
          <li>Check the <strong>Date Cooked</strong>. It starts as today.</li>
          <li>Under <strong>Modifications</strong>, select <strong>+ Add modification</strong> for each change, with the ingredient and what you did, such as "4 tbsp" or "toasted".</li>
          <li>Write your <strong>Notes</strong> and choose a <strong>Rating</strong>.</li>
          <li>Select <strong>Log Trial</strong>.</li>
        </guide-steps>
        <guide-shot guide="culinara" name="log-trial" [width]="1120" [height]="1156"
          alt="The Log Trial window: today's date, one modification (lemon juice, 4 tbsp), a note saying more lemon was better, and a four star rating." />
        <p>Trials appear newest first. Use <strong>Edit</strong> or <strong>Delete</strong> on a trial to change or remove it. The recipe page shows how many trials you have logged, the latest rating and the average.</p>
      </guide-section>

      <guide-section id="refine-a-recipe" title="Make a trial the new base recipe"
        lead="When a change works, promote the trial so the recipe's ingredients include it from now on.">
        <guide-steps>
          <li>Open the recipe and find the trial in the <strong>Trial Log</strong>.</li>
          <li>Select <strong>Promote</strong> on that trial.</li>
          <li>Check the list under <strong>Changes to be applied</strong>.</li>
          <li>Select <strong>Promote to Base</strong>.</li>
        </guide-steps>
        <guide-shot guide="culinara" name="promote-trial" [width]="960" [height]="600"
          alt="The Promote Trial to Base window explaining that the trial's modifications will be merged into the ingredient list, with one change to apply: feta, doubled." />
        <p>For each modification, an ingredient with the same name gets the change as its new amount, and one that is not in the recipe yet is added to the end. Names match whatever their capitals or extra spaces, so a change to "feta" updates the recipe's "Feta" and the recipe keeps its own spelling. Only the ingredients change; the instructions and the trial stay as they are. Promoting cannot be undone, but you can still edit the recipe afterwards.</p>
      </guide-section>

      <guide-section id="share-a-recipe" title="Share a recipe"
        lead="Publish a recipe to Discover, or send one person a link.">
        <p>To publish a recipe for everyone:</p>
        <guide-steps>
          <li>Open the recipe.</li>
          <li>Turn on <strong>Share publicly</strong>. The recipe now appears in Discover. Turn it off to take it down.</li>
        </guide-steps>
        <p>To send a link instead:</p>
        <guide-steps>
          <li>Open the recipe, select the <strong>...</strong> menu next to <strong>Start cooking</strong>, then <strong>Share</strong>.</li>
          <li>Select <strong>Copy</strong> next to the link that appears, and send it however you like.</li>
        </guide-steps>
        <p>Anyone with the link can read the recipe without signing in, and can select <strong>Import Recipe</strong> to save their own copy. The link shows the recipe as it was when you made it. Making a new link for the same recipe stops the old one working. Your trial log is never shared.</p>
      </guide-section>

      <guide-section id="discover-recipes" title="Find recipes in Discover"
        lead="Browse recipes other Jiro cooks have made public, and save the ones you want to try.">
        <guide-steps>
          <li>Open <a routerLink="/culinara/discover">Discover</a>.</li>
          <li>Type in <strong>Search public recipes...</strong> to search titles and descriptions. Select <strong>Load more</strong> at the bottom to see more.</li>
          <li>Select a recipe to read it.</li>
          <li>Select <strong>Save to My Library</strong> to copy it into your own recipes, then <strong>Open it</strong> to go to your copy.</li>
        </guide-steps>
        <guide-tip>Your copy is yours to edit, cook from and log trials against. It does not change if the original does.</guide-tip>
      </guide-section>

      <guide-section id="plan-the-week" title="Plan the week's meals"
        lead="Put recipes on a weekly calendar with a row each for breakfast, lunch, dinner and snacks.">
        <guide-steps>
          <li>Open the <a routerLink="/culinara/meal-planner">Meal Planner</a>. It opens on the current week, with today highlighted.</li>
          <li>Select an empty part of the box for the day and meal you want. With a keyboard, press <kbd>Tab</kbd> to reach the box and <kbd>Enter</kbd> to open it.</li>
          <li>Search for a recipe if you need to, then select it. It appears in that box.</li>
          <li>For a meal that is not one of your recipes, type a note such as "Dinner out" under <strong>Or add a note instead</strong> and select <strong>Add note</strong>.</li>
          <li>To take a recipe or a note off, select the <strong>×</strong> on it.</li>
          <li>Use <strong>‹ Prev</strong> and <strong>Next ›</strong> to move between weeks, and <strong>Today</strong> to come back.</li>
        </guide-steps>
        <guide-shot guide="culinara" name="meal-planner" [width]="1600" [height]="1163"
          alt="The meal planner for one week: days across the top, Breakfast, Lunch, Dinner and Snack down the side, and recipes such as Overnight Oats and Greek Chicken Rice Bowls in the boxes." />
        <guide-shot guide="culinara" name="planner-picker" [width]="960" [height]="718"
          alt="The window for adding to Friday's breakfast, searched for oat, listing Banana Oat Pancakes and Overnight Oats with Berries, with a box below for adding a note instead." />
        <guide-tip>A box can hold more than one recipe or note. On a phone, scroll the calendar sideways to see the other days.</guide-tip>
      </guide-section>

      <guide-section id="grocery-list" title="Make a grocery list"
        lead="Turn recipes into a shopping list and tick items off in the shop. The list is saved to your account, so it is the same on every device you sign in on.">
        <guide-steps>
          <li>Open a recipe and select <strong>Add to grocery list</strong> next to <strong>Base Ingredients</strong>. Or, in the <a routerLink="/culinara/meal-planner">Meal Planner</a>, select <strong>Add to grocery list</strong> to add every recipe planned for the week shown.</li>
          <li>Open the <a routerLink="/culinara/grocery-list">Grocery List</a>. Items are grouped by recipe.</li>
          <li>To add something that is not in a recipe, type it in <strong>Add an item</strong>, with an amount if you like, and select <strong>Add</strong>.</li>
          <li>Tick an item when you have it, or select <strong>Check all</strong> to tick a whole recipe.</li>
          <li>Select <strong>×</strong> to remove one item.</li>
          <li>When you are done, select <strong>Clear checked</strong> to remove the ticked items, or <strong>Clear all</strong> to start over.</li>
        </guide-steps>
        <guide-shot guide="culinara" name="grocery-list" [width]="1600" [height]="1163"
          alt="The grocery list with 13 items remaining and a box at the top for adding an item by hand, grouped under Overnight Oats with Berries and Greek Chicken Rice Bowls, with rolled oats and milk ticked and crossed out." />
        <guide-tip>Adding a recipe that is already on the list only adds the ingredients that are missing, and items you have ticked stay ticked. A recipe planned on several days is added once. The same ingredient from two different recipes appears under each recipe, since their amounts may not add up.</guide-tip>
      </guide-section>

      <guide-section id="cook-streak" title="Keep a cook streak"
        lead="Your cook streak counts the days in a row on which you logged a cook.">
        <p>Any trial counts, whether you logged it with <strong>Log this cook</strong> or <strong>+ Log Trial</strong>, on the day in its <strong>Date Cooked</strong>. The streak stays alive until the end of the day after your last cook, so a cook today or yesterday keeps it going.</p>
        <p>You can see it in two places:</p>
        <ul>
          <li>At the top of the <a routerLink="/culinara">Culinara</a> page, with the total number of days you have cooked, once you have a streak going.</li>
          <li>On the Culinara card on your <a routerLink="/dashboard">Dashboard</a>, with your best streak and a <strong>Log a cook</strong> button.</li>
        </ul>
      </guide-section>

    </guide-page>
  `,
})
export class CulinaraGuideComponent {}
