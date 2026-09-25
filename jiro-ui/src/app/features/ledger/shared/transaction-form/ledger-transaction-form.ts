import { Component, Input, Output, EventEmitter, OnInit, inject, signal, computed } from '@angular/core';

import { FormsModule } from '@angular/forms';
import {
  LedgerService, LedgerAccount, CategoryTree, LedgerCategory, LedgerTransaction, RecurrenceInterval,
} from '../../../../core/services/ledger.service';
import { JiroButtonComponent } from '../../../../shared/components/jiro-button/jiro-button';
import { SettingsService } from '../../../../core/services/settings.service';
import { todayKey } from '../../../../core/utils/day';
import { LedgerCategoryDialogComponent } from '../category-dialog/ledger-category-dialog';
import { currencySymbol, formatDate, intervalPhrase } from '../ledger-utils';

export interface TransactionPayload {
  type: 'income' | 'expense' | 'transfer';
  account_id: string;
  transfer_to_account_id?: string | null;
  category_id?: string | null;
  amount: number;
  description: string;
  notes?: string | null;
  is_recurring: boolean;
  recurrence_interval?: RecurrenceInterval | null;
  date: string;
}

let formSeq = 0;

@Component({
  selector: 'ledger-transaction-form',
  standalone: true,
  imports: [FormsModule, JiroButtonComponent, LedgerCategoryDialogComponent],
  template: `
    <form class="tx-form" (ngSubmit)="submit()">

      <!-- Type -->
      <div class="form-group">
        <span class="form-label" [id]="uid + '-type'">Type</span>
        <div class="type-toggle" role="group" [attr.aria-labelledby]="uid + '-type'">
          <button type="button" class="type-btn" [disabled]="lockType" [attr.aria-pressed]="form.type === 'expense'" [class.active]="form.type === 'expense'" (click)="setType('expense')">Expense</button>
          <button type="button" class="type-btn" [disabled]="lockType" [attr.aria-pressed]="form.type === 'income'" [class.active]="form.type === 'income'" (click)="setType('income')">Income</button>
          <button type="button" class="type-btn" [disabled]="lockType" [attr.aria-pressed]="form.type === 'transfer'" [class.active]="form.type === 'transfer'" (click)="setType('transfer')">Transfer</button>
        </div>
      </div>

      <!-- Account -->
      <div class="form-group">
        <label class="form-label" [for]="uid + '-account'">{{ form.type === 'transfer' ? 'From account' : 'Account' }}</label>
        <select class="form-input" [id]="uid + '-account'" [(ngModel)]="form.account_id" name="account_id" required>
          <option value="">Select account</option>
          @for (a of accounts; track a.id) {
            <option [value]="a.id">{{ a.name }}{{ a.is_active ? '' : ' (inactive)' }}</option>
          }
        </select>
      </div>

      <!-- To Account (transfers only) -->
      @if (form.type === 'transfer') {
        <div class="form-group">
          <label class="form-label" [for]="uid + '-to'">To account</label>
          <select class="form-input" [id]="uid + '-to'" [(ngModel)]="form.transfer_to_account_id" name="transfer_to_account_id">
            <option value="">Select destination</option>
            @for (a of accounts; track a.id) {
              <option [value]="a.id" [disabled]="a.id === form.account_id">{{ a.name }}{{ a.is_active ? '' : ' (inactive)' }}</option>
            }
          </select>
        </div>
      }

      <!-- Category (income/expense only) -->
      @if (form.type !== 'transfer') {
        <div class="form-group">
          <div class="label-row">
            <label class="form-label" [for]="uid + '-category'">Category <span class="optional-label">(optional)</span></label>
            <button type="button" class="new-cat-btn" (click)="showCatDialog.set(true)">+ New category</button>
          </div>
          <select class="form-input" [id]="uid + '-category'" [(ngModel)]="form.category_id" name="category_id">
            <option value="">Uncategorised</option>
            @for (c of categoriesByType(); track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
            }
          </select>
        </div>
      }

      <!-- Amount -->
      <div class="form-group">
        <label class="form-label" [for]="uid + '-amount'">Amount ({{ symbol() }})</label>
        <input class="form-input" type="number" min="0.01" step="0.01" inputmode="decimal" [id]="uid + '-amount'"
          [(ngModel)]="form.amount" name="amount" placeholder="0.00" required />
      </div>

      <!-- Description -->
      <div class="form-group">
        <label class="form-label" [for]="uid + '-desc'">Description <span class="optional-label">(optional)</span></label>
        <input class="form-input" type="text" [id]="uid + '-desc'" maxlength="255"
          [(ngModel)]="form.description" name="description" placeholder="What was this for?" />
      </div>

      <!-- Notes -->
      <div class="form-group">
        <label class="form-label" [for]="uid + '-notes'">Notes <span class="optional-label">(optional)</span></label>
        <textarea class="form-input form-textarea" [id]="uid + '-notes'" [(ngModel)]="form.notes" name="notes"
          rows="2" placeholder="Additional details..."></textarea>
      </div>

      <!-- Date -->
      <div class="form-group">
        <label class="form-label" [for]="uid + '-date'">Date</label>
        <input class="form-input" type="date" [id]="uid + '-date'" [(ngModel)]="form.date" name="date" required />
      </div>

      <!-- Repeat -->
      @if (isCopy()) {
        <div class="series-note">
          @if (source?.series_interval) {
            <p>
              Ledger added this from a transaction that repeats {{ intervalPhrase(source!.series_interval) }}.
              @if (source?.series_next_date) { The next one is due {{ formatDate(source!.series_next_date!) }}. }
              Changes here apply to this one only.
            </p>
            <jiro-button variant="secondary" size="sm" type="button" [disabled]="saving" (click)="stopSeries.emit()">Stop repeating</jiro-button>
          } @else {
            <p>Ledger added this from a repeating transaction that has since stopped.</p>
          }
        </div>
      } @else {
        <div class="form-group">
          <div class="toggle-row">
            <span class="form-label" [id]="uid + '-repeat'">Repeat</span>
            <button type="button" class="toggle-btn" role="switch"
              [attr.aria-checked]="form.is_recurring" [attr.aria-labelledby]="uid + '-repeat'"
              [attr.aria-describedby]="uid + '-repeat-hint'"
              [class.on]="form.is_recurring" (click)="form.is_recurring = !form.is_recurring">
              <span class="toggle-knob"></span>
            </button>
          </div>
          <p class="field-hint" [id]="uid + '-repeat-hint'">
            @if (form.is_recurring) {
              Ledger adds a copy on each date it falls due, and catches up on any it missed, whenever you open Ledger.
              @if (wasRecurring && source?.recurrence_next_date) { Next due {{ formatDate(source!.recurrence_next_date!) }}. }
            } @else if (wasRecurring) {
              Saving with Repeat off stops the series. Copies already added stay.
            } @else {
              Turn on for rent, pay and subscriptions: Ledger then adds each one for you.
            }
          </p>
        </div>

        @if (form.is_recurring) {
          <div class="form-group">
            <label class="form-label" [for]="uid + '-interval'">Repeat every</label>
            <select class="form-input" [id]="uid + '-interval'" [(ngModel)]="form.recurrence_interval" name="recurrence_interval">
              <option value="weekly">Week</option>
              <option value="biweekly">Two weeks</option>
              <option value="monthly">Month (same day; the last day in shorter months)</option>
              <option value="yearly">Year</option>
            </select>
          </div>
        }
      }

      @if (error) {
        <p class="form-error" role="alert">{{ error }}</p>
      }

      <div class="form-actions">
        <jiro-button variant="secondary" type="button" (click)="cancel()">Cancel</jiro-button>
        <jiro-button variant="primary" type="submit"
          [disabled]="saving || !form.account_id || !form.amount || (form.type === 'transfer' && !form.transfer_to_account_id)">
          {{ saving ? 'Saving...' : submitLabel }}
        </jiro-button>
      </div>
    </form>

    @if (showCatDialog()) {
      <ledger-category-dialog
        [defaultType]="form.type === 'income' ? 'income' : 'expense'"
        (saved)="onCategoryCreated($event)"
        (closed)="showCatDialog.set(false)" />
    }
  `,
  styles: [`
    :host { display: block; }

    .tx-form { display: flex; flex-direction: column; gap: var(--space-md); }

    .form-group { display: flex; flex-direction: column; gap: var(--space-xs); }

    .form-label { font-size: var(--font-size-sm); font-weight: 500; color: var(--text-secondary); }

    .optional-label { font-weight: 400; color: var(--text-muted); }

    .label-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-sm); }

    .new-cat-btn {
      background: none; border: none; padding: 8px 0; min-height: 32px;
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
    select.form-input { appearance: none; cursor: pointer; text-overflow: ellipsis; }
    .form-textarea { resize: vertical; font-family: inherit; min-height: 60px; }

    .field-hint { font-size: var(--font-size-xs); color: var(--text-muted); margin: 0; line-height: 1.5; }

    .series-note {
      display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-sm);
      padding: var(--space-sm) var(--space-md);
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-canvas);
    }
    .series-note p { margin: 0; font-size: var(--font-size-sm); color: var(--text-secondary); line-height: 1.5; }

    .form-error { font-size: var(--font-size-sm); color: var(--color-danger); margin: 0; }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-sm);
      margin-top: var(--space-xs);
      flex-wrap: wrap;
    }

    /* Type toggle */
    .type-toggle {
      display: flex;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      overflow: hidden;
    }
    .type-btn {
      flex: 1; padding: 9px 12px; border: none; min-height: 40px;
      background: var(--bg-surface); color: var(--text-secondary);
      font-size: var(--font-size-sm); font-weight: 500;
      cursor: pointer; transition: background 0.15s, color 0.15s;
    }
    .type-btn + .type-btn { border-left: 1px solid var(--border-color); }
    .type-btn.active { background: var(--color-primary); color: var(--text-on-primary); }
    .type-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .type-btn.active:disabled { opacity: 0.8; }

    /* Repeat switch */
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
  /** Pre-fill the form: an existing transaction when editing, or just a date when logging for a given day. */
  @Input() initial: Partial<TransactionPayload> | null = null;
  /** The transaction being edited, for its series (null when logging a new one). */
  @Input() source: LedgerTransaction | null = null;
  /** The type is fixed once a transaction exists. */
  @Input() lockType = false;

  @Output() formSubmit = new EventEmitter<TransactionPayload>();
  @Output() formCancel = new EventEmitter<void>();
  /** "Stop repeating" on a copy Ledger added. */
  @Output() stopSeries = new EventEmitter<void>();

  private allCategories = signal<CategoryTree[]>([]);
  showCatDialog = signal(false);

  private readonly settings = inject(SettingsService);
  readonly uid = `tx-form-${++formSeq}`;
  readonly symbol = computed(() => currencySymbol(this.settings.currency()));
  readonly formatDate = formatDate;
  readonly intervalPhrase = intervalPhrase;

  /** Whether the transaction being edited heads a series right now. */
  wasRecurring = false;

  form = {
    type: 'expense' as 'income' | 'expense' | 'transfer',
    account_id: '',
    transfer_to_account_id: '',
    category_id: '',
    amount: null as number | null,
    description: '',
    notes: '',
    is_recurring: false,
    recurrence_interval: 'monthly' as RecurrenceInterval,
    date: todayKey(this.settings.timezone()),
  };

  constructor(private ledgerService: LedgerService) {}

  /** A copy Ledger added for a series: it cannot start a series of its own. */
  isCopy(): boolean {
    return !!this.source?.recurrence_source_id && !this.source.is_recurring;
  }

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
    }
    this.wasRecurring = !!this.source?.is_recurring && !!this.source.recurrence_next_date;
    // Auto-select first account if only one available
    if (!this.form.account_id && this.accounts.length === 1) {
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

  onCategoryCreated(created: LedgerCategory) {
    this.showCatDialog.set(false);
    this.loadCategories();
    if (created.type === this.form.type) {
      this.form.category_id = created.id;
    }
  }

  submit() {
    if (!this.form.account_id || !this.form.amount) return;
    if (this.form.type === 'transfer' && !this.form.transfer_to_account_id) return;

    const repeat = !this.isCopy() && this.form.is_recurring;
    const payload: TransactionPayload = {
      type: this.form.type,
      account_id: this.form.account_id,
      transfer_to_account_id: this.form.type === 'transfer' ? this.form.transfer_to_account_id : null,
      category_id: this.form.type !== 'transfer' && this.form.category_id ? this.form.category_id : null,
      amount: this.form.amount,
      description: this.form.description.trim(),
      notes: this.form.notes.trim() || null,
      is_recurring: repeat,
      recurrence_interval: repeat ? this.form.recurrence_interval : null,
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
      recurrence_interval: 'monthly',
      date: todayKey(this.settings.timezone()),
    };
  }
}
