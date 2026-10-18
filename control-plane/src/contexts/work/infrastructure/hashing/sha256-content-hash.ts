import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { ContentHashPort } from '@work/application/ports/content-hash.port';

@Injectable()
export class Sha256ContentHash implements ContentHashPort {
  sha256(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
  }
}
