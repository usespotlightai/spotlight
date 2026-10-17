import { DescribedDocument } from '@integrations/domain/aggregates/described-document.aggregate';
import type { DescribedDocumentRepository } from '@integrations/domain/repositories/described-document.repository';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import {
  DescribedOperation,
  type OperationCall,
} from '@integrations/domain/value-objects/described-operation.vo';
import type { DescribedKind } from '@integrations/domain/value-objects/described-source.vo';
import {
  describedDocument,
  describedOperation,
} from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';
import { and, asc, eq } from 'drizzle-orm';

const ROWS_PER_INSERT = 500;

interface OperationRow {
  readonly upstream: string;
  readonly description: string;
  readonly inputs: readonly {
    readonly name: string;
    readonly schema: unknown;
    readonly required: boolean;
    readonly description: string | null;
  }[];
  readonly writes: boolean;
  readonly call: OperationCall;
}

const rowOf = (operation: DescribedOperation): OperationRow => ({
  upstream: operation.upstream,
  description: operation.description,
  inputs: operation.inputs.map((each) => ({
    name: each.name,
    schema: each.schema.written,
    required: each.required,
    description: each.description,
  })),
  writes: operation.writes,
  call: operation.call,
});

const operationOf = (name: string, held: unknown): DescribedOperation => {
  const row = held as OperationRow;

  return DescribedOperation.of({
    name,
    upstream: row.upstream,
    description: row.description,
    inputs: row.inputs.map((each) => ({
      ...each,
      schema: InputSchema.of(each.schema),
    })),
    writes: row.writes,
    call: row.call,
  });
};

@Injectable()
export class DrizzleDescribedDocuments implements DescribedDocumentRepository {
  constructor(private readonly context: DrizzleContext) {}

  async withHash(hash: ContentHash): Promise<DescribedDocument | null> {
    const [found] = await this.context.db
      .select()
      .from(describedDocument)
      .where(eq(describedDocument.hash, hash.value))
      .limit(1);

    if (!found) {
      return null;
    }

    const operations = await this.context.db
      .select({
        name: describedOperation.name,
        operation: describedOperation.operation,
      })
      .from(describedOperation)
      .where(eq(describedOperation.hash, hash.value))
      .orderBy(asc(describedOperation.position));

    return DescribedDocument.rehydrate({
      hash: ContentHash.of(found.hash),
      kind: found.kind as DescribedKind,
      operations: operations.map((each) =>
        operationOf(each.name, each.operation),
      ),
      passedOver: found.passedOver,
      readAt: found.readAt,
    });
  }

  async operation(
    hash: ContentHash,
    name: string,
  ): Promise<DescribedOperation | null> {
    const [found] = await this.context.db
      .select({ operation: describedOperation.operation })
      .from(describedOperation)
      .where(
        and(
          eq(describedOperation.hash, hash.value),
          eq(describedOperation.name, name),
        ),
      )
      .limit(1);

    return found ? operationOf(name, found.operation) : null;
  }

  async keep(document: DescribedDocument): Promise<void> {
    await this.context.inTransaction(async () => {
      const kept = await this.context.db
        .insert(describedDocument)
        .values({
          hash: document.hash.value,
          kind: document.kind,
          operations: document.operations.length,
          passedOver: [...document.passedOver],
          readAt: document.readAt,
        })
        .onConflictDoNothing()
        .returning({ hash: describedDocument.hash });

      if (kept.length === 0) {
        return;
      }

      const rows = document.operations.map((each, position) => ({
        hash: document.hash.value,
        name: each.name,
        position,
        operation: { ...rowOf(each) } as Record<string, unknown>,
      }));

      for (let from = 0; from < rows.length; from += ROWS_PER_INSERT) {
        await this.context.db
          .insert(describedOperation)
          .values(rows.slice(from, from + ROWS_PER_INSERT));
      }
    });
  }
}
