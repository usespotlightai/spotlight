import { publicUrlOf } from '@platform/config/env';
import type { Env } from '@platform/config/env.schema';

export const appUrl = (env: Env): string =>
  publicUrlOf(env).replace(/\/+$/, '');

export const escaped = (raw: string): string =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
