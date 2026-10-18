import { createHash } from 'node:crypto';
import type { HashPort } from '@replays/application/ports/hash.port';

export class Sha256Hash implements HashPort {
  sha256(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
  }
}
