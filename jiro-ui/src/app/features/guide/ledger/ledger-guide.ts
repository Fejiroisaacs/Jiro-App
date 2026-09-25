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
          <li>Enter an <strong>Account Name</strong>, such as the name your bank uses.</li>
          <li>Choose a <strong>Type</strong>: <strong>Checking</strong>, <strong>Savings</strong>, <strong>Credit Card</strong>, <strong>Investment</strong> or <strong>Cash</strong>.</li>
          <li>Enter the three-letter <strong>Currency</strong> code. It starts as USD.</li>
          <li>Enter the <strong>Opening Balance</strong>: what is in the account today. For a credit card, enter what you owe as a negative number, such as -250.</li>
          <li>Select <strong>Add Account</strong>.</li>
        </guide-steps>
        <guide-shot guide="ledger" name="add-account" [width]="960" [height]="954"
          alt="The Add Account window with Account Name set to Everyday Checking, Type Checking, Currency USD and an Opening Balance of 2500, above Cancel and Add Account buttons." />
        <p>
          From then on, Ledger keeps the balance up to date as you log transactions.
          Below the account cards, Accounts adds up your <strong>Assets</strong>, takes away your
          <strong>Liabilities</strong> (your credit cards) and shows your <strong>Net Worth</strong>.
          Select <strong>Recent transactions</strong> on a card to see its latest ten.
        </p>
        <p>
          To rename an account or change its type, open its menu (the three dots) and select
          <strong>Edit</strong>. The balance and currency cannot be changed there. Turn off
          <strong>Active</strong> for an account you no longer use: it shows as Inactive and is
          left out when you take a net worth snapshot.
        </p>
        <guide-tip>An account that has transactions cannot be deleted. Mark it inactive instead.</guide-tip>
      </guide-section>

      <guide-section id="log-a-transaction" title="Log a transaction"
        lead="Record money going out or coming in. The account balance changes as soon as it is saved.">
        <guide-steps>
          <li>Select <strong>Log transaction</strong> at the top of the <a routerLink="/ledger">Overview</a> or <a routerLink="/ledger/transactions">Transactions</a>.</li>
          <li>Choose <strong>Expense</strong> or <strong>Income</strong>.</li>
          <li>Pick the <strong>Account</strong> the money left or went into.</li>
          <li>Pick a <strong>Category</strong> if you like. The list only shows categories for the type you chose.</li>
          <li>Enter the <strong>Amount</strong> as a positive number. Ledger records an expense as money out for you.</li>
          <li>Add a <strong>Description</strong> and any <strong>Notes</strong>, and check the <strong>Date</strong>. It starts as today.</li>
          <li>Select <strong>Log Transaction</strong>.</li>
        </guide-steps>
        <guide-shot guide="ledger" name="log-transaction" [width]="1040" [height]="1440"
          alt="The Log Transaction window with Expense selected, Select account and No category still to choose, an Amount of 42.50, the Description Weekly shop, empty Notes, today's Date and the Recurring switch turned off." />
        <p>
          For a bill or payslip that repeats, turn on <strong>Recurring</strong> and choose how
          often in <strong>Repeat every</strong>: <strong>Week</strong>, <strong>Two weeks</strong>,
          <strong>Month</strong> or <strong>Year</strong>. The transaction gets a badge such as
          Monthly in the list.
        </p>
        <guide-tip>Recurring is a label. Ledger does not add the next payment for you, so log each one when it happens.</guide-tip>
      </guide-section>

      <guide-section id="move-money-between-accounts" title="Move money between accounts"
        lead="Use a transfer for savings, paying off a card or taking out cash. It is not counted as income or spending.">
        <guide-steps>
          <li>Select <strong>Log transaction</strong>, then <strong>Transfer</strong>.</li>
          <li>Choose the <strong>From Account</strong> and the <strong>To Account</strong>.</li>
          <li>Enter the <strong>Amount</strong>, a <strong>Description</strong> and the <strong>Date</strong>.</li>
          <li>Select <strong>Log Transaction</strong>. The first account goes down and the second goes up by the same amount.</li>
        </guide-steps>
        <guide-shot guide="ledger" name="transfer" [width]="1040" [height]="1440"
          alt="The Log Transaction window with Transfer selected, showing From Account and To Account lists in place of Account and Category, an Amount of 400 and the Description Monthly savings." />
        <p>
          A transfer shows in Transactions twice, once for each account, with an arrow to the
          account it went to. To pay off a credit card, transfer from your checking account to
          the card.
        </p>
        <guide-tip>Once a transfer is logged, only its description, notes and recurring setting can be changed. If the accounts, amount or date are wrong, delete it and log it again.</guide-tip>
      </guide-section>

      <guide-section id="use-categories" title="Use categories"
        lead="Categories group your spending and income, and budgets are set per category.">
        <p>
          Ledger starts you off with expense categories (Housing, Food &amp; Drink, Transport,
          Health, Entertainment, Shopping, Utilities, Subscriptions and Other) and income
          categories (Salary, Freelance, Investment, Gift and Other Income). Each one has its
          own colour, which shows as a tag in the transaction list and a dot on budgets.
        </p>
        <guide-steps>
          <li>In the <strong>Log Transaction</strong> window, select <strong>+ New</strong> next to <strong>Category</strong>.</li>
          <li>Enter a <strong>Name</strong> and choose <strong>Expense</strong> or <strong>Income</strong>.</li>
          <li>Select <strong>Create</strong>. If it matches the type you are logging, it is picked for you.</li>
        </guide-steps>
        <p>You can also add a category from the <strong>Add Budget</strong> window, the same way.</p>
        <guide-tip>Categories you add have no colour of their own and show in grey. Categories cannot yet be renamed or deleted in the app.</guide-tip>
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
          alt="The Transactions page with the Expense type filter selected, the From, To, Account, Category and Search filters above, and expenses grouped under Yesterday, Wed 23 Sept and Mon 21 Sept, each with a coloured category tag and the account name." />
        <p>On a phone, the type buttons sit at the top and the rest are under <strong>Filters</strong>, which shows how many are in use.</p>
        <guide-steps>
          <li>Select a transaction to open <strong>Edit transaction</strong>.</li>
          <li>Change the category, amount, description, notes, date or recurring setting. The type cannot be changed, and on a transfer only the description, notes and recurring setting can.</li>
          <li>Select <strong>Save changes</strong>.</li>
          <li>To remove it, select <strong>Delete transaction</strong> and confirm. The account balance is corrected, and deleting either side of a transfer removes both.</li>
        </guide-steps>
        <guide-shot guide="ledger" name="edit-transaction" [width]="1040" [height]="1440"
          alt="The bottom of the Edit transaction window for a Trader Joe's expense of 102.26 in Food and Drink, with Cancel and Save changes buttons, a See this day link and a Delete transaction button." />
        <guide-tip>The account cannot be changed on a saved transaction. To move it to another account, delete it and log it again.</guide-tip>
      </guide-section>

      <guide-section id="set-a-budget" title="Set a budget"
        lead="Give a spending category a limit and watch how much of it you have used.">
        <guide-steps>
          <li>Open <a routerLink="/ledger/budgets">Budgets</a> and select <strong>Add budget</strong>.</li>
          <li>Choose an expense <strong>Category</strong>, or select <strong>+ New</strong> to add one.</li>
          <li>Enter the <strong>Limit ($)</strong>.</li>
          <li>Choose a <strong>Period</strong>: <strong>Monthly</strong>, <strong>Weekly</strong> or <strong>Yearly</strong>.</li>
          <li>Leave <strong>Start Date</strong> as today, and select <strong>Create Budget</strong>.</li>
        </guide-steps>
        <guide-shot guide="ledger" name="budgets" [width]="1600" [height]="1163"
          alt="The Budgets page: totals of 1,100 dollars budgeted, 794.80 spent and 305.20 remaining, then monthly budget cards for Entertainment at 12% used, Food and Drink at 85%, Shopping at 59% and Transport at 84%, each with a progress bar." />
        <p>
          Each card counts the expenses in that category for the current week (Monday to Sunday),
          month or year, and shows what is left. The bar changes colour at 80% used, and past
          100% the card says <strong>Over budget by</strong> the amount. The totals at the top
          add up all your budgets.
        </p>
        <guide-tip>To change a limit, add the budget again with the same category and period: the new limit replaces the old one. The bin button on a card deletes the budget but not your transactions.</guide-tip>
      </guide-section>

      <guide-section id="read-the-overview" title="Read the Overview"
        lead="The Overview is Ledger's home page: this month at a glance.">
        <guide-shot guide="ledger" name="overview" [width]="1600" [height]="1163"
          alt="The Ledger Overview for September 2026: Income 2,184.62 dollars, Expenses 1,017.19, Net 1,167.43 and a Savings Rate of 53.4%, then four budget cards and a list of recent transactions." />
        <ul>
          <li><strong>Income</strong> and <strong>Expenses</strong> add up this calendar month's transactions. Transfers are left out.</li>
          <li><strong>Net</strong> is income minus expenses, and <strong>Savings Rate</strong> is net as a share of income.</li>
          <li><strong>Budgets</strong> shows every budget's progress. <strong>Manage</strong> opens Budgets.</li>
          <li><strong>Recent Transactions</strong> lists your ten latest. <strong>All</strong> opens Transactions.</li>
        </ul>
      </guide-section>

      <guide-section id="track-your-net-worth" title="Track your net worth"
        lead="A snapshot records your assets and liabilities on a date. Take one now and then to see the trend.">
        <guide-steps>
          <li>Open <a routerLink="/ledger/net-worth">Net Worth</a> and select <strong>Take snapshot</strong>.</li>
          <li>Check the <strong>Snapshot Date</strong>. <strong>Total Assets ($)</strong> and <strong>Total Liabilities ($)</strong> are filled in from your active accounts; change them if you hold money Ledger does not track.</li>
          <li>Check the <strong>Computed Net Worth</strong> and select <strong>Save Snapshot</strong>.</li>
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
        lead="Put two stretches of time side by side, overall and by category.">
        <guide-steps>
          <li>Open <a routerLink="/ledger/compare">Compare</a>. It opens on <strong>This Month vs Last</strong>.</li>
          <li>Pick <strong>This Week vs Last</strong> or <strong>This Quarter vs Last</strong> for another preset. Period A is the current one and Period B the one before.</li>
          <li>For your own dates, select <strong>Custom</strong>, fill in <strong>From</strong> and <strong>To</strong> for <strong>Period A</strong> and <strong>Period B</strong>, then select <strong>Apply Comparison</strong>.</li>
        </guide-steps>
        <guide-shot guide="ledger" name="compare" [width]="1600" [height]="1163"
          alt="The Compare periods page set to This Month vs Last: cards for Total Income, Total Expenses and Net Cashflow, each with the Period A and Period B amounts and the change between them, above the Period Overview bar chart." />
        <p>
          The cards show <strong>Total Income</strong>, <strong>Total Expenses</strong> and
          <strong>Net Cashflow</strong> for each period, marked with the Period A and Period B
          colours. The change under each is Period B minus Period A, so with a preset an up arrow
          means the earlier period was higher. Below, <strong>Period Overview</strong> charts the
          three totals and <strong>Category Breakdown</strong> lists every category, with
          spending shown as negative amounts. Select a column heading to sort the table.
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
          <li>The <strong>Ledger</strong> card on the <a routerLink="/dashboard">Dashboard</a> shows <strong>Net this month</strong>, income, expenses and savings rate, and the three budgets closest to their limit. <strong>Open ledger</strong> takes you to the Overview. Hide or move it with <strong>Customise</strong> on the dashboard.</li>
          <li>The <a routerLink="/day">day view</a> (<strong>Today</strong> in the sidebar) has a <strong>Ledger</strong> section with that day's transactions and how much you spent. Select one to open it for editing. On a day with none, <strong>Log a transaction</strong> opens the form with that date filled in.</li>
          <li>From <strong>Edit transaction</strong>, <strong>See this day</strong> goes the other way, to the day view for that transaction's date.</li>
        </ul>
      </guide-section>

    </guide-page>
  `,
})
export class LedgerGuideComponent {}
