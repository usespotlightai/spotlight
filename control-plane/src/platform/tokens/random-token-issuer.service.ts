import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  NewToken,
  TokenIssuer,
} from '@shared-kernel/application/ports/token-issuer.port';

const BYTES = 32;

@Injectable()
export class RandomTokenIssuer implements TokenIssuer {
  issue(): NewToken {
    const token = randomBytes(BYTES).toString('base64url');
    return { token, hash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
