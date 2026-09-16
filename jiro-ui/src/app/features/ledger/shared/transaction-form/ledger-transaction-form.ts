import { Component, Input, Output, EventEmitter, OnInit, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { LedgerService, LedgerAccount, CategoryTree } from '../../../../core/services/ledger.service';
import { JiroButtonComponent } from '../../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../../shared/components/jiro-modal/jiro-modal';

export interface TransactionPayload {
  type: 'income' | 'expense' | 'transfer';
  account_id: string;
  transfer_to_account_id?: string | null;
  category_id?: string | null;
  amount: number;
  description: string;
  notes?: string | null;
  is_recurring: boolean;
  recurrence_interval?: 'weekly' | 'biweekly' | 'monthly' | 'yearly' | null;
  date: string;
}

@Component({
  selector: 'ledger-transaction-form',
  standalone: true,
  imports: [FormsModule, JiroButtonComponent, JiroModalComponent],
  template: `
    <form class="tx-form" (ngSubmit)="submit()">

      <!-- Type -->
      <div class="form-group">
        <label class="form-label">Type</label>
        <div class="type-toggle">
          <button type="button" class="type-btn" [disabled]="lockType" [attr.aria-pressed]="form.type === 'expense'" [class.active]="form.type === 'expense'" (click)="setType('expense')">Expense</button>
          <button type="button" class="type-btn" [disabled]="lockType" [attr.aria-pressed]="form.type === 'income'" [class.active]="form.type === 'income'" (click)="setType('income')">Income</button>
          <button type="button" class="type-btn" [disabled]="lockType" [attr.aria-pressed]="form.type === 'transfer'" [class.active]="form.type === 'transfer'" (click)="setType('transfer')">Transfer</button>
        </div>
      </div>

      <!-- Account -->
      <div class="form-group">
        <label class="form-label">{{ form.type === 'transfer' ? 'From Account' : 'Account' }}</label>
        <select class="form-input" [(ngModel)]="form.account_id" name="account_id" required>
          <option value="">Select account</option>
          @for (a of accounts; track a) {
<option [value]="a.id">{{ a.name }} ({{ a.currency }})</option>
}
        </select>
      </div>

      <!-- To Account (transfers only) -->
      @if (form.type === 'transfer') {
<div class="form-group">
        <label class="form-label">To Account</label>
        <select class="form-input" [(ngModel)]="form.transfer_to_account_id" name="transfer_to_account_id">
          <option value="">Select destination</option>
          @for (a of accounts; track a) {
<option [value]="a.id" [disabled]="a.id === form.account_id">{{ a.name }} ({{ a.currency }})</option>
}
        </select>
      </div>
}

      <!-- Category (income/expense only) -->
      @if (form.type !== 'transfer') {
<div class="form-group">
        <div class="label-row">
          <label class="form-label">Category <span class="optional-label">(optional)</span></label>
          <button type="button" class="new-cat-btn" (click)="openCatModal()">+ New</button>
        </div>
        <select class="form-input" [(ngModel)]="form.category_id" name="category_id">
          <option value="">No category</option>
          @for (c of categoriesByType(); track c) {
<option [value]="c.id">{{ c.name }}</option>
}
        </select>
      </div>
}

      <!-- Amount -->
      <div class="form-group">
        <label class="form-label">Amount</label>
        <input class="form-input" type="number" min="0.01" step="0.01"
          [(ngModel)]="form.amount" name="amount" placeholder="0.00" required />
      </div>

      <!-- Description -->
      <div class="form-group">
        <label class="form-label">Description <span class="optional-label">(optional)</span></label>
        <input class="form-input" type="text"
          [(ngModel)]="form.description" name="description" placeholder="What was this for?" />
      </div>

      <!-- Notes -->
      <div class="form-group">
        <label class="form-label">Notes <span class="optional-label">(optional)</span></label>
        <textarea class="form-input form-textarea" [(ngModel)]="form.notes" name="notes"
          rows="2" placeholder="Additional details..."></textarea>
      </div>

      <!-- Date -->
      <div class="form-group">
        <label class="form-label">Date</label>
        <input class="form-input" type="date" [(ngModel)]="form.date" name="date" required />
      </div>

      <!-- Recurring -->
      <div class="form-group">
        <div class="toggle-row">
          <label class="form-label" style="margin:0">Recurring</label>
          <button type="button" class="toggle-btn" [class.on]="form.is_recurring"
            (click)="form.is_recurring = !form.is_recurring">
            <span class="toggle-knob"></span>
          </button>
        </div>
      </div>

      @if (form.is_recurring) {
<div class="form-group">
        <label class="form-label">Repeat every</label>
        <select class="form-input" [(ngModel)]="form.recurrence_interval" name="recurrence_interval">
          <option value="weekly">Week</option>
          <option value="biweekly">Two weeks</option>
          <option value="monthly">Month</option>
          <option value="yearly">Year</option>
        </select>
      </div>
}

      @if (error) {
<p class="form-error">{{ error }}</p>
}

      <div class="form-actions">
        <jiro-button variant="secondary" type="button" (click)="cancel()">Cancel</jiro-button>
        <jiro-button variant="primary" type="submit"
          [disabled]="saving || !form.account_id || !form.amount || (form.type === 'transfer' && !form.transfer_to_account_id)">
          {{ saving ? 'Saving...' : submitLabel }}
        </jiro-button>
      </div>
    </form>

    <!-- New Category Modal -->
    @if (showCatModal()) {
<jiro-modal title="New Category" maxWidth="400px" (close)="closeCatModal()">
      <form class="tx-form" (ngSubmit)="submitCategory()">
        <div class="form-group">
          <label class="form-label">Name</label>
          <input class="form-input" type="text" [(ngModel)]="catForm.name" name="cat_name"
            placeholder="e.g. Groceries" required />
        </div>
        <div class="form-group">
          <label class="form-label">Type</label>
          <div class="type-toggle">
            <button type="button" class="type-btn" [class.active]="catForm.type === 'expense'" (click)="catForm.type = 'expense'">Expense</button>
            <button type="button" class="type-btn" [class.active]="catForm.type === 'income'" (click)="catForm.type = 'income'">Income</button>
          </div>
        </div>
        @if (catError()) {
<p class="form-error">{{ catError() }}</p>
}
        <div class="form-actions">
          <jiro-button variant="secondary" type="button" (click)="closeCatModal()">Cancel</jiro-button>
          <jiro-button variant="primary" type="submit" [disabled]="catSaving() || !catForm.name.trim()">
            {{ catSaving() ? 'Saving...' : 'Create' }}
          </jiro-button>
        </div>
      </form>
    </jiro-modal>
}
  `,
  styles: [`
    :host { display: block; }

    .tx-form { display: flex; flex-direction: column; gap: var(--space-md); }

    .form-group { display: flex; flex-direction: column; gap: var(--space-xs); }

    .form-label { font-size: var(--font-size-sm); font-weight: 500; color: var(--text-secondary); }

    .optional-label { font-weight: 400; color: var(--text-muted); }

    .label-row { display: flex; align-items: center; justify-content: space-between; }

    .new-cat-btn {
      background: none; border: none; padding: 0;
      font-size: var(--font-size-sm); font-weight: 500;
      color: var(--color-primary); cursor: pointer; line-height: 1;
    }
    .new-cat-btn:hover { opacity: 0.75; }

    .form-input {
      padding: 10px 14px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: var(--font-size-md);
      transition: border-color 0.2s, box-shadow 0.2s;
      width: 100%;
      box-sizing: border-box;
    }
    .form-input:focus {
      border-color: var(--color-primary);
      box-shadow: 2px 2px 0 var(--color-primary);
      transform: translate(-1px, -1px);
    }
    select.form-input { appearance: none; cursor: pointer; }
    .form-textarea { resize: vertical; font-family: inherit; min-height: 60px; }

    .form-error { font-size: var(--font-size-sm); color: var(--color-danger); margin: 0; }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-sm);
      margin-top: var(--space-xs);
    }

    /* Type toggle */
    .type-toggle {
      display: flex;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      overflow: hidden;
    }
    .type-btn {
      flex: 1; padding: 9px 12px; border: none;
      background: var(--bg-surface); color: var(--text-secondary);
      font-size: var(--font-size-sm); font-weight: 500;
      cursor: pointer; transition: background 0.15s, color 0.15s;
    }
    .type-btn + .type-btn { border-left: 1px solid var(--border-color); }
    .type-btn.active { background: var(--color-primary); color: var(--text-on-primary); }
    .type-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Recurring toggle */
    .toggle-row { display: flex; align-items: center; justify-content: space-between; }
    .toggle-btn {
      width: 44px; height: 24px; border-radius: 12px;
      border: none; background: var(--border-color);
      cursor: pointer; position: relative; transition: background 0.2s; padding: 0;
    }
    .toggle-btn.on { background: var(--color-primary); }
    .toggle-knob {
      display: block; width: 18px; height: 18px; border-radius: 50%;
      background: var(--bg-surface); position: absolute; top: 3px; left: 3px;
      transition: transform 0.2s; box-shadow: 0 1px 3px rgba(var(--shadow-rgb), 0.3);
    }
    .toggle-btn.on .toggle-knob { transform: translateX(20px); }
  `]
})
export class LedgerTransactionFormComponent implements OnInit {
  @Input() accounts: LedgerAccount[] = [];
  @Input() saving = false;
  @Input() error = '';
  @Input() submitLabel = 'Log transaction';
  /** Pre-fill the form; used when editing an existing transaction. */
  @Input() initial: Partial<TransactionPayload> | null = null;
  /** Transfers cannot change account or amount once written, so lock them. */
  @Input() lockType = false;

  @Output() formSubmit = new EventEmitter<TransactionPayload>();
  @Output() formCancel = new EventEmitter<void>();

  private allCategories = signal<CategoryTree[]>([]);
  showCatModal = signal(false);
  catSaving = signal(false);
  catError = signal('');
  catForm = { name: '', type: 'expense' as 'expense' | 'income' };

  form = {
    type: 'expense' as 'income' | 'expense' | 'transfer',
    account_id: '',
    transfer_to_account_id: '',
    category_id: '',
    amount: null as number | null,
    description: '',
    notes: '',
    is_recurring: false,
    recurrence_interval: 'monthly' as 'weekly' | 'biweekly' | 'monthly' | 'yearly',
    date: new Date().toISOString().slice(0, 10),
  };

  constructor(private ledgerService: LedgerService) {}

  ngOnInit() {
    this.loadCategories();
    if (this.initial) {
      const i = this.initial;
      this.form = {
        ...this.form,
        type: i.type ?? this.form.type,
        account_id: i.account_id ?? '',
        transfer_to_account_id: i.transfer_to_account_id ?? '',
        category_id: i.category_id ?? '',
        amount: i.amount ?? null,
        description: i.description ?? '',
        notes: i.notes ?? '',
        is_recurring: i.is_recurring ?? false,
        recurrence_interval: i.recurrence_interval ?? 'monthly',
        date: i.date ?? this.form.date,
      };
      return;
    }
    // Auto-select first account if only one available
    if (this.accounts.length === 1) {
      this.form.account_id = this.accounts[0].id;
    }
  }

  private loadCategories() {
    this.ledgerService.listCategories().subscribe({
      next: cats => this.allCategories.set(cats),
      error: () => {},
    });
  }

  categoriesByType(): { id: string; name: string }[] {
    const result: { id: string; name: string }[] = [];
    for (const cat of this.allCategories()) {
      if (cat.type === this.form.type) {
        result.push({ id: cat.id, name: cat.name });
        for (const child of cat.children ?? []) {
          result.push({ id: child.id, name: cat.name + ' / ' + child.name });
        }
      }
    }
    return result;
  }

  setType(type: 'income' | 'expense' | 'transfer') {
    this.form.type = type;
    this.form.category_id = '';
    this.form.transfer_to_account_id = '';
  }

  openCatModal() {
    this.catForm = { name: '', type: this.form.type === 'income' ? 'income' : 'expense' };
    this.catError.set('');
    this.showCatModal.set(true);
  }

  closeCatModal() {
    this.showCatModal.set(false);
  }

  submitCategory() {
    if (!this.catForm.name.trim()) return;
    this.catSaving.set(true);
    this.ledgerService.createCategory({ name: this.catForm.name.trim(), type: this.catForm.type }).subscribe({
      next: created => {
        this.catSaving.set(false);
        this.showCatModal.set(false);
        this.loadCategories();
        // Auto-select newly created category if type matches
        if (created.type === this.form.type) {
          this.form.category_id = created.id;
        }
      },
      error: () => {
        this.catSaving.set(false);
        this.catError.set('Failed to create category.');
      },
    });
  }

  submit() {
    if (!this.form.account_id || !this.form.amount) return;
    if (this.form.type === 'transfer' && !this.form.transfer_to_account_id) return;

    const payload: TransactionPayload = {
      type: this.form.type,
      account_id: this.form.account_id,
      transfer_to_account_id: this.form.type === 'transfer' ? this.form.transfer_to_account_id : null,
      category_id: this.form.type !== 'transfer' && this.form.category_id ? this.form.category_id : null,
      amount: this.form.amount,
      description: this.form.description.trim(),
      notes: this.form.notes.trim() || null,
      is_recurring: this.form.is_recurring,
      recurrence_interval: this.form.is_recurring ? this.form.recurrence_interval : null,
      date: this.form.date,
    };

    this.formSubmit.emit(payload);
  }

  cancel() {
    this.formCancel.emit();
  }

  reset() {
    this.form = {
      type: 'expense',
      account_id: this.accounts.length === 1 ? this.accounts[0].id : '',
      transfer_to_account_id: '',
      category_id: '',
      amount: null,
      description: '',
      notes: '',
      is_recurring: false,
      recurrence_interval: 'monthly' as 'weekly' | 'biweekly' | 'monthly' | 'yearly',
      date: new Date().toISOString().slice(0, 10),
    };
  }
}
