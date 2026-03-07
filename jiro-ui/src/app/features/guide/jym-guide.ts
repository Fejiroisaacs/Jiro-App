import { Component } from '@angular/core';
import { HowToUseComponent } from '../jym/how-to-use/how-to-use';

@Component({
  selector: 'app-jym-guide',
  standalone: true,
  imports: [HowToUseComponent],
  template: `
    <div class="guide-page">
      <jym-how-to-use />
    </div>
  `,
  styles: [`
    .guide-page {
      padding: 24px 16px;
    }
  `]
})
export class JymGuideComponent {}
