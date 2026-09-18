import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';

@Injectable()
export class CryptoIdGenerator implements IdGeneratorPort {
  generate(): string {
    return randomUUID();
  }
}
