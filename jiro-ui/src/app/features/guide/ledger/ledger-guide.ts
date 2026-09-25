import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GUIDE } from '../shared';

@Component({
  selector: 'app-ledger-guide',
  standalone: true,
  imports: [RouterLink, GUIDE],
  template: `
    <guide-page heading="Ledger guide" mark="ledger"
      intro="Track your accounts, spending and budgets in one place.">

      <guide-section id="set-up-accounts" title="Set up your accounts"
        lead="Add each bank account, card or cash pot you want to track. Every transaction belongs to one of them.">
        <guide-steps>
          <li>Open <a routerLink="/ledger/accounts">Accounts</a> and select <strong>Add account</strong>.</li>
          <li>Enter an <strong>Account name</strong>, such as the name your bank uses.</li>
          <li>Choose a <strong>Type</strong>: <strong>Checking</strong>, <strong>Savings</strong>, <strong>Credit Card</strong>, <strong>Investment</strong> or <strong>Cash</strong>.</li>
          <li>Enter the <strong>Opening balance</strong>: what is in the account today. For a credit card or loan, enter what you owe as a negative number, such as -250.</li>
          <li>Select <strong>Add Account</strong>.</li>
        </guide-steps>
        <guide-shot guide="ledger" name="add-account" [width]="960" [height]="866"
          alt="The Add Account window with Account name set to Everyday Checking, Type Checking and an Opening balance of 2500, above Cancel and Add Account buttons." />
        <p>
          Every account and every total is shown in one currency, the one you pick under
          <strong>Currency</strong> in <a routerLink="/settings">Settings</a>. It starts as US dollars.
          Changing it changes how amounts are labelled, not the amounts themselves.
        </p>
        <p>
          From then on, Ledger keeps the balance up to date as you log transactions.
          Below the account cards, Accounts adds up your <strong>Assets</strong> (every account
          with money in it), takes away your <strong>Liabilities</strong> (every account below
          zero, such as a card you owe on) and shows your <strong>Net worth</strong>. Inactive
          accounts count too. Select <strong>Recent transactions</strong> on a card to see its
          latest ten, with money in shown as plus and money out as minus.
        </p>
        <p>
          To rename an account or change its type, open its menu (the three dots) and select
          <strong>Edit</strong>. The balance cannot be changed there. Turn off
          <strong>Active</strong> for an account you no longer use: it shows as Inactive, keeps
          its history and still counts toward net worth.
        </p>
        <guide-tip>An account that has transactions cannot be deleted. Mark it inactive instead.</guide-tip>
      </guide-section>

      <guide-section id="log-a-transaction" title="Log a transaction"
        lead="Record money going out or coming in. The account balance changes as soon as it is saved.">
        <guide-steps>
          <li>Select <strong>Log transaction</strong> at the top of the <a routerLink="/ledger">Overview</a> or <a routerLink="/ledger/transactions">Transactions</a>.</li>
          <li>Choose <strong>Expense</strong> or <strong>Income</strong>.</li>
          <li>Pick the <strong>Account</strong> the money left or went into.</li>
          <li>Pick a <strong>Category</strong> if you like, or leave it <strong>Uncategorised</strong>. The list only shows categories for the type you chose.</li>
          <li>Enter the <strong>Amount</strong> as a positive number. Ledger records an expense as money out for you.</li>
          <li>Add a <strong>Description</strong> and any <strong>Notes</strong>, and check the <strong>Date</strong>. It starts as today.</li>
          <li>Select <strong>Log Transaction</strong>.</li>
        </guide-steps>
        <guide-shot guide="ledger" name="log-transaction" [width]="1040" [height]="1440"
          alt="The Log Transaction window with Expense selected, Select account and Uncategorised still to choose, an Amount of 42.50, the Description Weekly shop, empty Notes, today's Date and the Repeat switch turned off." />
      </guide-section>

      <guide-section id="repeat-a-transaction" title="Repeat rent, pay and subscriptions"
        lead="Log a bill or payslip once and Ledger adds each one after it for you.">
        <guide-steps>
          <li>Log the first one as usual, with its real date.</li>
          <li>Turn on <strong>Repeat</strong>.</li>
          <li>Choose how often in <strong>Repeat every</strong>: <strong>Week</strong>, <strong>Two weeks</strong>, <strong>Month</strong> or <strong>Year</strong>.</li>
          <li>Select <strong>Log Transaction</strong>.</li>
        </guide-steps>
        <guide-shot guide="ledger" name="repeat" [width]="1040" [height]="1800"
          alt="The Log Transaction window for Rent of 1650 with the Repeat switch on, a note that Ledger adds a copy on each date it falls due and catches up on any it missed, and Repeat every set to Month." />
        <p>
          Whenever you open Ledger, it adds a copy on each date that has come round, using your
          timezone, and catches up on any it missed while you were away. Each copy moves the
          account balance like any other transaction and carries a badge such as Monthly in the
          list. A monthly one stays on its day: one that starts on the 31st lands on the last day
          of shorter months, then goes back to the 31st.
        </p>
        <p>
          Open a copy and it says which series added it and when the next one is due. Changes to
          a copy apply to that one only. To change what future copies look like, edit the first
          transaction of the series.
        </p>
        <guide-steps>
          <li>To stop a series, open any of its transactions.</li>
          <li>On a copy, select <strong>Stop repeating</strong> and confirm. On the first one, turn off <strong>Repeat</strong> and select <strong>Save changes</strong>.</li>
        </guide-steps>
        <guide-tip>Stopping a series keeps the copies already added. Delete any you do not want one by one.</guide-tip>
      </guide-section>

      <guide-section id="move-money-between-accounts" title="Move money between accounts"
        lead="Use a transfer for savings, paying off a card or taking out cash. It is not counted as income or spending.">
        <guide-steps>
          <li>Select <strong>Log transaction</strong>, then <strong>Transfer</strong>.</li>
          <li>Choose the <strong>From account</strong> and the <strong>To account</strong>.</li>
          <li>Enter the <strong>Amount</strong>, a <strong>Description</strong> and the <strong>Date</strong>.</li>
          <li>Select <strong>Log Transaction</strong>. The first account goes down and the second goes up by the same amount.</li>
        </guide-steps>
        <guide-shot guide="ledger" name="transfer" [width]="1040" [height]="1440"
          alt="The Log Transaction window with Transfer selected, showing From account and To account lists in place of Account and Category, an Amount of 400 and the Description Monthly savings." />
        <p>
          A transfer shows once in Transactions and on the Overview, with its direction, such as
          Checking → Savings. To pay off a credit card, transfer from your checking account to
          the card. A transfer can repeat too, for a standing order into savings.
        </p>
        <guide-tip>Everything about a transfer can be changed later, including both accounts, the amount and the date. Both balances follow.</guide-tip>
      </guide-section>

      <guide-section id="use-categories" title="Use and manage categories"
        lead="Categories group your spending and income, and budgets are set per category.">
        <p>
          Ledger starts you off with expense categories (Housing, Food &amp; Drink, Transport,
          Health, Entertainment, Shopping, Utilities, Subscriptions and Other) and income
          categories (Salary, Freelance, Investment, Gift and Other Income). Each one has its
          own colour, which shows as a tag in the transaction list and a dot on budgets.
          Lists show them expense first, then income, each in alphabetical order.
        </p>
        <guide-steps>
          <li>In the <strong>Log Transaction</strong> or <strong>Add budget</strong> window, select <strong>+ New category</strong>.</li>
          <li>Enter a <strong>Name</strong>, choose <strong>Expense</strong> or <strong>Income</strong>, and pick a <strong>Colour</strong>. If you skip the colour, Ledger picks one not yet in use.</li>
          <li>Select <strong>Create</strong>. If it matches the type you are logging, it is picked for you.</li>
        </guide-steps>
        <p>
          All your categories are listed under <strong>Categories</strong> at the bottom of
          <a routerLink="/ledger/budgets">Budgets</a>, where you can add more with
          <strong>New category</strong>.
        </p>
        <guide-shot guide="ledger" name="categories" [width]="1600" [height]="666"
          alt="The Categories section on the Budgets page, with a New category button and the Expense and Income categories each listed with a colour dot, an edit button and a delete button." />
        <guide-steps>
          <li>To rename or recolour one, select its pencil button, change the <strong>Name</strong> or <strong>Colour</strong> and select <strong>Save</strong>. Its transactions and budget follow.</li>
          <li>To delete one, select its bin button. Under <strong>Move its transactions to</strong>, choose another category of the same type, or <strong>Uncategorised</strong>.</li>
          <li>Select <strong>Delete category</strong>.</li>
        </guide-steps>
        <guide-shot guide="ledger" name="delete-category" [width]="880" [height]="562"
          alt="The Delete Entertainment window: its transactions are kept and moved to the category chosen below, any budget on it is removed, with Move its transactions to set to Uncategorised above Cancel and Delete category buttons." />
        <guide-tip>Deleting a category never deletes transactions. A budget set on it is removed, since there is nothing left for it to track.</guide-tip>
      </guide-section>

      <guide-section id="find-and-edit-transactions" title="Find and edit transactions"
        lead="Transactions lists everything, newest first, grouped by day with each day's total.">
        <guide-steps>
          <li>Open <a routerLink="/ledger/transactions">Transactions</a>.</li>
          <li>Narrow the list with <strong>From</strong> and <strong>To</strong> dates, an <strong>Account</strong>, a <strong>Category</strong>, or a <strong>Type</strong>: <strong>All</strong>, <strong>Income</strong>, <strong>Expense</strong> or <strong>Transfer</strong>.</li>
          <li>Type in <strong>Search</strong> to match words in the description or notes.</li>
          <li>Select <strong>Clear</strong> to show everything again. <strong>Load more</strong> at the bottom brings in older transactions.</li>
        </guide-steps>
        <guide-shot guide="ledger" name="transactions" [width]="1600" [height]="1163"
          alt="The Transactions page with the Expense type filter selected, the From, To, Account, Category and Search filters above, and expenses grouped by day, each with a coloured category tag and the account name." />
        <p>On a phone, the type buttons sit at the top and the rest are under <strong>Filters</strong>, which shows how many are in use.</p>
        <guide-steps>
          <li>Select a transaction (or move to it with the Tab key and press Enter) to open <strong>Edit transaction</strong>.</li>
          <li>Change anything but the type: the account (or both accounts of a transfer), category, amount, description, notes, date or repeat.</li>
          <li>Select <strong>Save changes</strong>. The balances of every account involved are corrected.</li>
          <li>To remove it, select <strong>Delete transaction</strong> and confirm. The account balance is corrected, and a transfer is removed from both accounts.</li>
        </guide-steps>
        <guide-shot guide="ledger" name="edit-transaction" [width]="1040" [height]="1440"
          alt="The bottom of the Edit transaction window for a Trader Joe's expense of 102.26 in Food and Drink, with the Repeat switch off, Cancel and Save changes buttons, a See this day link and a Delete transaction button." />
      </guide-section>

      <guide-section id="set-a-budget" title="Set a budget"
        lead="Give a spending category a limit and watch how much of it you have used.">
        <guide-steps>
          <li>Open <a routerLink="/ledger/budgets">Budgets</a> and select <strong>Add budget</strong>.</li>
          <li>Choose an expense <strong>Category</strong>, or select <strong>+ New category</strong> to add one.</li>
          <li>Enter the <strong>Limit</strong>.</li>
          <li>Choose a <strong>Period</strong>: <strong>Monthly</strong>, <strong>Weekly</strong> or <strong>Yearly</strong>, and select <strong>Create budget</strong>.</li>
        </guide-steps>
        <guide-shot guide="ledger" name="budgets" [width]="1600" [height]="1163"
          alt="The Budgets page: totals of 1,100 dollars budgeted, 794.80 spent and 305.20 remaining, then monthly budget cards for Entertainment at 12% used, Food and Drink at 85%, Shopping at 59% and Transport at 84%, each with a progress bar, edit and delete buttons, above the Categories section." />
        <p>
          Each card counts the expenses in that category for the current week (Monday to Sunday),
          month or year, and shows what is left. The bar changes colour at 80% used, and past
          100% the card says <strong>Over budget by</strong> the amount. The totals at the top
          add up all your budgets.
        </p>
        <guide-steps>
          <li>To change a budget, select the pencil button on its card.</li>
          <li>Change the <strong>Limit</strong> or the <strong>Period</strong> and select <strong>Save changes</strong>.</li>
        </guide-steps>
        <guide-shot guide="ledger" name="edit-budget" [width]="960" [height]="686"
          alt="The Edit the Entertainment budget window with a Limit of 120 and the Period Monthly, above Cancel and Save changes buttons." />
        <guide-tip>A category can have one budget per period. The bin button on a card deletes the budget but not your transactions.</guide-tip>
      </guide-section>

      <guide-section id="read-the-overview" title="Read the Overview"
        lead="The Overview is Ledger's home page: this month at a glance.">
        <guide-shot guide="ledger" name="overview" [width]="1600" [height]="1163"
          alt="The Ledger Overview for September 2026: Income 2,184.62 dollars, Expenses 1,017.19, Net 1,167.43 and a Savings rate of 53.4%, then four budget cards and a list of recent transactions." />
        <ul>
          <li><strong>Income</strong> and <strong>Expenses</strong> add up this calendar month's transactions, with the month cut in your timezone. Transfers are left out.</li>
          <li><strong>Net</strong> is income minus expenses, and <strong>Savings rate</strong> is net as a share of income.</li>
          <li><strong>Budgets</strong> shows every budget's progress. <strong>Manage budgets</strong> opens Budgets.</li>
          <li><strong>Recent transactions</strong> lists your ten latest, whatever the month. Select one to open it for editing. <strong>All transactions</strong> opens Transactions.</li>
        </ul>
      </guide-section>

      <guide-section id="track-your-net-worth" title="Track your net worth"
        lead="A snapshot records your assets and liabilities on a date. Take one now and then to see the trend.">
        <guide-steps>
          <li>Open <a routerLink="/ledger/net-worth">Net worth</a> and select <strong>Take snapshot</strong>.</li>
          <li>Check the <strong>Snapshot date</strong>. <strong>Total assets</strong> and <strong>Total liabilities</strong> are filled in from your accounts by the same rule as the Accounts page: every account, inactive ones too, at its balance. Change them if you hold money Ledger does not track.</li>
          <li>Check the <strong>Net worth</strong> and select <strong>Save Snapshot</strong>.</li>
        </guide-steps>
        <guide-shot guide="ledger" name="net-worth" [width]="1600" [height]="1163"
          alt="The Net worth page: a current net worth of 15,204.42 dollars as of 24 Sept 2026, with assets of 15,888.71 and liabilities of 684.29, above a line chart rising from about 12,000 dollars in April to 15,200 in September." />
        <p>
          The top card shows your latest snapshot, the chart plots every snapshot over time, and
          <strong>Snapshot History</strong> lists them newest first.
        </p>
        <guide-tip>Snapshots are not taken for you. Taking one on a date that already has a snapshot replaces it, so once a month works well.</guide-tip>
      </guide-section>

      <guide-section id="compare-two-periods" title="Compare two periods"
        lead="See how this month, week or quarter differs from the one before, overall and by category.">
        <guide-steps>
          <li>Open <a routerLink="/ledger/compare">Compare</a>. It opens on <strong>This month vs last</strong>.</li>
          <li>Pick <strong>This week vs last</strong> or <strong>This quarter vs last</strong> for another preset.</li>
          <li>For your own dates, select <strong>Custom</strong>, fill in <strong>From</strong> and <strong>To</strong> for <strong>Period A</strong> (the one to compare against) and <strong>Period B</strong>, then select <strong>Compare</strong>.</li>
        </guide-steps>
        <guide-shot guide="ledger" name="compare" [width]="1600" [height]="1163"
          alt="The Compare periods page set to This month vs last: cards for Income, Spending and Net cash flow, each with last month's and this month's amounts and a line such as Down 3,900.74 dollars (-79.3%) on last month, above the Period overview bar chart." />
        <p>
          The cards show <strong>Income</strong>, <strong>Spending</strong> and
          <strong>Net cash flow</strong> for each period. The line under each reads the way you
          would say it: <strong>Up</strong> means the current period is higher than the one
          before, <strong>Down</strong> that it is lower. It is green when that is good news
          (more income, less spending) and red when it is not. When the earlier period had
          nothing, there is no percentage: it says <strong>new</strong>, or
          <strong>n/a</strong> when both are empty.
        </p>
        <p>
          Below, <strong>Period overview</strong> charts the three totals and
          <strong>By category</strong> lists every category's income or spending in each period
          with the change. Select a column heading, or tab to it and press Enter, to sort the
          table; select it again to reverse the order.
        </p>
      </guide-section>

      <guide-section id="use-ledger-on-a-phone" title="Use Ledger on a phone"
        lead="The bar at the bottom holds four of Ledger's six pages.">
        <p>
          On a phone, the bottom bar has <strong>Overview</strong>, <strong>Activity</strong>
          (Transactions), <strong>Accounts</strong> and <strong>Budgets</strong>, plus
          <strong>Jiro</strong> to go back to the dashboard. <strong>Net Worth</strong> and
          <strong>Compare</strong> are the two buttons at the top of every Ledger page.
        </p>
        <guide-shot guide="ledger" name="phone-nav" [width]="780" [height]="1688"
          alt="Ledger's Budgets page on a phone, with Net Worth and Compare buttons at the top and a bottom bar of Jiro, Overview, Activity, Accounts and Budgets." />
      </guide-section>

      <guide-section id="ledger-on-the-dashboard-and-day-view" title="Ledger on the dashboard and day view"
        lead="You can see how the month is going without opening Ledger.">
        <ul>
          <li>The <strong>Ledger</strong> card on the <a routerLink="/dashboard">Dashboard</a> shows <strong>Net this month</strong>, income, expenses and savings rate in your currency, and the three budgets closest to their limit. <strong>Open ledger</strong> takes you to the Overview. Hide or move it with <strong>Customise</strong> on the dashboard.</li>
          <li>The <a routerLink="/day">day view</a> (<strong>Today</strong> in the sidebar) has a <strong>Ledger</strong> section with that day's transactions and how much you spent. Select one to open it for editing. On a day with none, <strong>Log a transaction</strong> opens the form with that date filled in.</li>
          <li>From <strong>Edit transaction</strong>, <strong>See this day</strong> goes the other way, to the day view for that transaction's date.</li>
        </ul>
      </guide-section>

    </guide-page>
  `,
})
export class LedgerGuideComponent {}
