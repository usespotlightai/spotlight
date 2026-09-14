import { createHash, randomBytes } from 'node:crypto';
import type {
  MintedToken,
  TokenMintPort,
} from '@application/ports/token-mint.port';
import { Injectable } from '@nestjs/common';

const BYTES = 32;

// Plain SHA-256 suffices for random tokens and keeps lookup one indexed read.
@Injectable()
export class TokenMint implements TokenMintPort {
  mint(): MintedToken {
    const token = randomBytes(BYTES).toString('base64url');
    return { token, hash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
