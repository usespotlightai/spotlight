import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

@Injectable()
export class Sha256ContentHash {
  sha256(content: string | Uint8Array): string {
    return typeof content === 'string'
      ? createHash('sha256').update(content, 'utf8').digest('hex')
      : createHash('sha256').update(content).digest('hex');
  }
}
