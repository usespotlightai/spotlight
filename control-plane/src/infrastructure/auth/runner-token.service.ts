import { createHash, randomBytes } from 'node:crypto';
import type {
  MintedToken,
  RunnerTokenPort,
} from '@application/ports/runner-token.port';
import { Injectable } from '@nestjs/common';

const BYTES = 32;

/**
 * Tokens are random, not chosen, so a single SHA-256 is enough: there is no
 * low-entropy secret to make expensive to guess, and lookup has to be a single
 * indexed read.
 */
@Injectable()
export class RunnerTokenService implements RunnerTokenPort {
  mint(): MintedToken {
    const token = randomBytes(BYTES).toString('base64url');
    return { token, hash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
