export { GuidePageComponent } from './guide-page';
export { GuideSectionComponent } from './guide-section';
export { GuideStepsComponent } from './guide-steps';
export { GuideShotComponent } from './guide-shot';
export { GuideTipComponent } from './guide-tip';

import { GuidePageComponent } from './guide-page';
import { GuideSectionComponent } from './guide-section';
import { GuideStepsComponent } from './guide-steps';
import { GuideShotComponent } from './guide-shot';
import { GuideTipComponent } from './guide-tip';

/** Everything a guide page needs: `imports: [RouterLink, GUIDE]`. */
export const GUIDE = [
  GuidePageComponent,
  GuideSectionComponent,
  GuideStepsComponent,
  GuideShotComponent,
  GuideTipComponent,
] as const;
