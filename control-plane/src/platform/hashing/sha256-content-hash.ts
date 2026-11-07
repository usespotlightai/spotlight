import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';

@Injectable()
export class Sha256ContentHash {
  sha256(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
  }
}
