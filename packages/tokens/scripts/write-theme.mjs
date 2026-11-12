// Writes dist/theme.css from the compiled tokens (run after tsc).
import { writeFileSync } from 'node:fs';
import { themeCss } from '../dist/index.js';

writeFileSync(new URL('../dist/theme.css', import.meta.url), themeCss());
