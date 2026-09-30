// For `npm run test:unit`: lets a spec'd module import another without the .ts extension, as the Angular build does.
import { register } from 'node:module';

register('./ts-resolve-hooks.mjs', import.meta.url);
