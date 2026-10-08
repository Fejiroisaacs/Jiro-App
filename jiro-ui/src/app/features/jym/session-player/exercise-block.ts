import { Component, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../../core/services/settings.service';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroMenuComponent } from '../../../shared/components/jiro-menu/jiro-menu';
import { JymPrBadgeComponent } from '../shared/pr-badge/pr-badge';
import { ExerciseBlock, planTag } from './player-blocks';
import { PlayerStore } from './player-store';
import { SetRowComponent } from './set-row';

/** One exercise in the player: its header and menu, last time, note, warm-ups, set rows, Add set and form check. */
@Component({
  selector: 'jym-exercise-block',
  standalone: true,
  imports: [FormsModule, JiroIconComponent, JiroMenuComponent, SetRowComponent],
  template: `
    @let block = blockInput();
    @let bi = index();
    <div class="ex-block">
              <!-- The header toggles on click; the name button is its keyboard handle (its click bubbles up). -->
              <div class="block-header" [class.block-open]="!store.isCollapsed(bi)" (click)="store.toggleBlock(bi)">
                <div class="block-title">
                  <h2><button type="button" class="block-toggle" [attr.aria-expanded]="!store.isCollapsed(bi)" [attr.aria-controls]="'block-body-' + bi">@if (store.labels()[bi]; as label) {<span class="ss-label">{{ label }}</span>}{{ block.exerciseName }}</button></h2>
                  @if (block.muscleGroup) {
    <span class="mg-tag">{{ block.muscleGroup }}</span>
    }
                  @if (block.plan) {
                    <span class="plan-tag">{{ planTag(block.plan, block.kind, store.dUnit()) }}</span>
                  }
                  @if (store.isCollapsed(bi) && store.savedCount(bi) > 0) {
    <span class="sets-done-tag">{{ store.savedCount(bi) }} sets</span>
    }
                </div>
                <div class="block-actions">
                  @if (store.removingBlock() === bi) {
                    <span class="block-busy" role="status" aria-label="Removing"><span class="spinner-sm"></span></span>
                  } @else {
                    <jiro-menu touch [items]="store.blockActions(bi)" [label]="'More actions for ' + block.exerciseName" (select)="store.onBlockAction(bi, $event)" />
                  }
                  <jiro-icon name="caret-down" [size]="16" class="chevron" [class.open]="!store.isCollapsed(bi)" />
                </div>
              </div>

              <div [id]="'block-body-' + bi">
              @if (!store.isCollapsed(bi) && block.plan?.note) {
                <p class="plan-note">{{ block.plan!.note }}</p>
              }
              @if (!store.isCollapsed(bi)) {

                <!-- Last time, and what to aim for today -->
                @if (block.suggestion && !store.allSaved(bi)) {
    <div class="overload-hint">
                  <jiro-icon [name]="block.suggestionIcon ?? 'trend-up'" [size]="12" />
                  {{ block.suggestion }}
                </div>
    }

                <!-- Exercise note -->
                <div class="ex-note-wrap">
                  <label class="field-label" [attr.for]="'ex-note-' + bi">Exercise note</label>
                  <textarea
                    [id]="'ex-note-' + bi"
                    class="ex-note-input"
                    [(ngModel)]="block.exerciseNote"
                    placeholder="Optional"
                    rows="1"
                    (blur)="store.saveExerciseNote(bi)"></textarea>
                </div>

                <!-- Warm-ups before the first working set: the bar, then about 50, 70 and 85 percent. -->
                @if (block.kind === 'weight_reps' ? store.warmupRampFor(block) : null; as ramp) {
                  <button type="button" class="warmup-prompt" (click)="store.addWarmups(bi, ramp)">
                    <jiro-icon name="fire" [size]="16" />
                    <span class="warmup-prompt-text">
                      Add warm-up sets
                      <small>{{ store.rampSummary(ramp) }}</small>
                    </span>
                  </button>
                }

                <!-- Set header -->
                <div class="set-header-row" aria-hidden="true">
                  <span class="sh set-num">Set</span>
                  <span class="sh">{{ firstColumn(block) }}</span>
                  <span class="sh">{{ block.kind === 'duration' || block.kind === 'distance' ? 'Time' : 'Reps' }}</span>
                  <span class="sh">RPE</span>
                  <span class="sh"></span>
                </div>

                <!-- Set rows: the number opens warm-up and remove; the check logs what the row shows. -->
                @for (row of block.sets; track row.id ?? 'new-' + row.setNumber; let si = $index) {
                  <jym-set-row [block]="block" [bi]="bi" [row]="row" [si]="si" />
                }

                <!-- Add set -->
                <button class="add-set-btn" type="button" [id]="'add-set-' + block.exerciseId" (click)="store.addSet(bi)">+ Add set</button>

                <!-- Form check upload -->
                <div class="form-check-row">
                  <label [for]="store.canUploadFormCheck(bi, block.exerciseId) ? 'fc-input-' + block.exerciseId : ''"
                         class="form-check-btn"
                         [class.fc-uploading]="store.isFormCheckUploading(block.exerciseId)"
                         [class.fc-disabled]="!store.canUploadFormCheck(bi, block.exerciseId)"
                         [title]="store.formCheckBtnTitle(bi, block.exerciseId)">
                    <jiro-icon name="camera" [size]="13" />
                    {{ store.isFormCheckUploading(block.exerciseId) ? 'Uploading...' : '+ Form check' }}
                  </label>
                  <input type="file" [id]="'fc-input-' + block.exerciseId"
                    accept="video/mp4,video/webm,image/jpeg,image/png"
                    style="display:none"
                    (change)="store.onFormCheckFileChange($event, bi)">
                  @if (store.formCheckError().get(block.exerciseId); as fcErr) {
                    <span class="fc-error" role="alert">{{ fcErr }}</span>
                    <button type="button" class="fc-retry-btn" (click)="store.retryFormCheck(bi)">Retry</button>
                  }
                  @if (store.isFormCheckUploading(block.exerciseId)) {
    <div class="fc-progress-bar">
                    <div class="fc-progress-fill" [style.width.%]="store.getFormCheckProgress(block.exerciseId)"></div>
                  </div>
    }
                  @if (store.getFirstAttachment(block.exerciseId); as clip) {

                    <a [href]="clip.file_url" target="_blank" class="fc-clip-link">
                      @if (clip.file_type.startsWith('image/')) {
    <img [src]="clip.file_url" class="fc-thumb" alt="form check">
    }
                      @if (!clip.file_type.startsWith('image/')) {
    <span class="fc-thumb-video">
                        <jiro-icon name="video-camera" [size]="14" />
                      </span>
    }
                    </a>

    }
                  @if (block.kind === 'weight_reps') {
                    <button type="button" class="plates-btn" aria-haspopup="dialog" (click)="store.openPlates(block)">
                      <jiro-icon name="barbell" [size]="16" /> Plates
                    </button>
                  }
                </div>

    }
              </div>
            </div>
  `,
  styles: [`
    :host { display: block; }

    .field-label {
      display: block;
      font-size: var(--font-size-sm); font-weight: 500;
      color: var(--text-secondary);
      margin-bottom: var(--space-xs);
    }

    .ex-note-wrap .field-label { font-size: var(--font-size-xs); padding: 0 10px; }

    .ex-block {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); overflow: hidden;
    }

    .block-header {
      padding: var(--space-md) var(--space-lg);
      background: var(--bg-canvas);
      display: flex; align-items: center; justify-content: space-between;
      cursor: pointer; user-select: none;
    }

    .block-header.block-open { border-bottom: 1px solid var(--border-color); }

    .block-actions { display: flex; align-items: center; gap: var(--space-sm); flex-shrink: 0; }

    .block-busy { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; color: var(--text-muted); }

    .overload-hint {
      display: flex; align-items: center; gap: 6px;
      padding: 6px var(--space-lg);
      font-size: var(--font-size-xs); color: var(--color-primary);
      background: rgba(var(--color-primary-rgb), 0.06); border-bottom: 1px solid var(--border-color);
    }

    .block-header:hover { background: var(--bg-surface); }

    .block-header:has(.block-toggle:focus-visible) { outline: 2px solid var(--color-primary); outline-offset: -2px; }

    .block-toggle {
      padding: 0; border: 0; background: none; color: inherit;
      font: inherit; letter-spacing: inherit; text-align: left; cursor: pointer;
    }

    .block-toggle:focus-visible { outline: none; }

    .block-title { display: flex; flex-wrap: wrap; align-items: center; gap: 2px var(--space-sm); flex: 1; min-width: 0; }

    .ss-label {
      display: inline-block; margin-right: 6px; padding: 0 6px; border-radius: var(--border-radius-pill);
      background: var(--color-primary); color: var(--text-on-primary);
      font-family: var(--font-family); font-size: var(--font-size-xs); font-weight: 700; vertical-align: middle;
    }

    .plan-note { margin: 0; padding: 6px var(--space-lg); font-size: var(--font-size-sm); color: var(--text-secondary); font-style: italic; border-bottom: 1px solid var(--border-color); }

    .plan-tag { font-size: var(--font-size-xs); color: var(--text-secondary); font-weight: 500; white-space: nowrap; }

    .block-title h2 { font-size: var(--font-size-md); font-weight: 600; }

    .sets-done-tag {
      font-size: var(--font-size-xs); padding: 2px 8px; border-radius: var(--border-radius-pill);
      background: rgba(var(--color-primary-rgb), 0.1); color: var(--color-primary); font-weight: 500;
    }

    .chevron {
      flex-shrink: 0; color: var(--text-muted);
      transform: rotate(-90deg); transition: transform 0.2s ease;
    }

    .chevron.open { transform: rotate(0deg); }

    .mg-tag {
      background: rgba(var(--color-primary-rgb), 0.12); color: var(--color-primary-text);
      font-size: var(--font-size-xs); padding: 2px 8px; border-radius: var(--border-radius-pill);
    }

    .ex-note-wrap {
      padding: var(--space-xs) var(--space-lg);
      border-bottom: 1px solid var(--border-color);
    }

    .ex-note-input {
      width: 100%; box-sizing: border-box; min-height: 44px;
      padding: 12px 10px;
      border: 1px solid transparent; border-radius: var(--border-radius);
      background: transparent; color: var(--text-secondary);
      font-size: var(--font-size-xs); font-family: inherit;
      resize: none; line-height: 1.5;
      transition: border-color 0.15s, background 0.15s;
    }

    .ex-note-input:focus {
      border-color: var(--border-color);
      background: var(--bg-canvas);
      color: var(--text-primary);
    }

    .ex-note-input::placeholder { color: var(--text-muted); }

    .set-header-row {
      display: grid;
      grid-template-columns: 44px 1fr 1fr 56px 44px;
      gap: var(--space-sm);
      padding: var(--space-xs) var(--space-lg);
    }

    .set-header-row { border-bottom: 1px solid var(--border-color); }

    .sh {
      font-size: var(--font-size-xs); text-transform: uppercase;
      letter-spacing: 0.5px; color: var(--text-muted); font-weight: 500;
    }

    .sh.set-num { text-align: center; }

    .warmup-prompt {
      display: flex; align-items: center; gap: var(--space-sm); width: 100%;
      min-height: 52px; padding: var(--space-xs) var(--space-lg);
      background: rgba(var(--color-warning-rgb), 0.06); border: none; border-bottom: 1px solid var(--border-color);
      color: var(--color-warning); font-family: inherit; font-size: var(--font-size-sm); font-weight: 600;
      text-align: left; cursor: pointer;
    }

    .warmup-prompt:hover { background: rgba(var(--color-warning-rgb), 0.12); }

    .warmup-prompt-text { display: flex; flex-direction: column; gap: 2px; }

    .warmup-prompt-text small { font-weight: 400; color: var(--text-secondary); font-variant-numeric: tabular-nums; }

    .plates-btn {
      display: inline-flex; align-items: center; gap: 6px; margin-left: auto;
      min-height: 44px; padding: 0 var(--space-md);
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-surface); color: var(--text-secondary);
      font-family: inherit; font-size: var(--font-size-sm); font-weight: 500; cursor: pointer; white-space: nowrap;
    }

    .plates-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }

    .spinner-sm {
      width: 14px; height: 14px;
      border: 2px solid color-mix(in srgb, currentColor 40%, transparent);
      border-top-color: currentColor; border-radius: 50%;
      animation: jiro-spin 0.6s linear infinite; display: inline-block;
    }

    .add-set-btn {
      width: 100%; padding: var(--space-sm);
      background: none; border: none; border-top: 1px solid var(--border-color);
      color: var(--text-muted); font-size: var(--font-size-sm); cursor: pointer;
      font-family: inherit; min-height: 44px;
      transition: all 0.15s;
    }

    .add-set-btn:hover { color: var(--color-primary); background: rgba(var(--color-primary-rgb), 0.04); }

    @media (max-width: 480px) {
      .set-header-row {
        grid-template-columns: 44px 1fr 1fr 52px 44px;
        padding: var(--space-xs) var(--space-md);
        gap: 6px;
      }
      .ex-note-wrap { padding: var(--space-xs) var(--space-md); }
    }

    .form-check-row {
      display: flex; align-items: center; gap: var(--space-sm);
      padding: var(--space-xs) var(--space-lg);
      border-top: 1px solid var(--border-color);
    }

    .form-check-btn {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: var(--font-size-xs); color: var(--text-muted);
      cursor: pointer; min-height: 44px; padding: 4px 12px; border-radius: var(--border-radius);
      border: 1px dashed var(--border-color); background: none;
      white-space: nowrap; transition: all 0.15s; font-family: inherit;
    }

    .form-check-btn:hover,
    .form-check-btn.fc-uploading { color: var(--color-primary); border-color: var(--color-primary); }

    .form-check-btn.fc-disabled {
      opacity: 0.4; cursor: not-allowed; pointer-events: none;
    }

    .fc-progress-bar {
      flex: 1; height: 4px; background: var(--border-color);
      border-radius: var(--border-radius-sm); overflow: hidden;
    }

    .fc-progress-fill {
      height: 100%; background: var(--color-primary); transition: width 0.3s;
    }

    .fc-error { font-size: var(--font-size-xs); color: var(--color-danger); }

    .fc-retry-btn {
      font-size: var(--font-size-xs); font-family: inherit; font-weight: 600;
      padding: 4px 12px; min-height: 44px; border-radius: var(--border-radius);
      border: 1px solid var(--color-danger); background: none; color: var(--color-danger);
      cursor: pointer;
    }

    .fc-retry-btn:hover { background: rgba(var(--color-danger-rgb), 0.08); }

    .fc-clip-link { display: inline-flex; align-items: center; text-decoration: none; }

    .fc-thumb { width: 44px; height: 44px; object-fit: cover; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); }

    .fc-thumb-video {
      width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center;
      background: var(--surface-secondary); border-radius: var(--border-radius-sm); border: 1px solid var(--border-color);
      color: var(--text-secondary);
    }

  `],
})
export class ExerciseBlockComponent {
  readonly store = inject(PlayerStore);
  readonly settingsService = inject(SettingsService);
  readonly blockInput = input.required<ExerciseBlock>({ alias: 'block' });
  /** Its place in the workout, which the store's methods take. */
  readonly index = input.required<number>({ alias: 'bi' });
  readonly planTag = planTag;

  /** The first column's heading: the weight, the load added (bodyweight, holds), or the distance. */
  firstColumn(block: ExerciseBlock): string {
    const unit = this.settingsService.unitLabel();
    if (block.kind === 'distance') return `Distance (${this.store.dUnit()})`;
    return block.kind === 'weight_reps' ? `Weight (${unit})` : `+ ${unit}`;
  }
}
