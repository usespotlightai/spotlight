import type { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import type { SpecOperation } from '@integrations/domain/value-objects/spec-operation.vo';
import type { SpecOperationReader } from '@integrations/infrastructure/integrations/operation-cache';
import { specOperation } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { operationOf } from '@integrations/infrastructure/persistence/drizzle/spec-operation-rows';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleSpecOperations implements SpecOperationReader {
  constructor(private readonly context: DrizzleContext) {}

  async operation(
    hash: ContentHash,
    name: string,
  ): Promise<SpecOperation | null> {
    const [found] = await this.context.db
      .select({ operation: specOperation.operation })
      .from(specOperation)
      .where(
        and(eq(specOperation.hash, hash.value), eq(specOperation.name, name)),
      )
      .limit(1);

    return found ? operationOf(name, found.operation) : null;
  }
}
