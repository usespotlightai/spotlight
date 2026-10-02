import { createHash } from 'node:crypto';
import type { DigestPort } from '@replays/application/ports/digest.port';

export class Sha256Digest implements DigestPort {
  sha256(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
  }
}
