import { randomUUID } from 'node:crypto';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CryptoIdGenerator implements IdGeneratorPort {
  generate(): string {
    return randomUUID();
  }
}
