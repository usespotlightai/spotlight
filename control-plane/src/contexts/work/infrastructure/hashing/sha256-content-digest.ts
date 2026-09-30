import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { ContentDigestPort } from '@work/application/ports/content-digest.port';

@Injectable()
export class Sha256ContentDigest implements ContentDigestPort {
  sha256(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
  }
}
