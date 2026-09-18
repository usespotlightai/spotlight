import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  MintedToken,
  TokenMintPort,
} from '@shared-kernel/application/ports/token-mint.port';

const BYTES = 32;

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
