import { SpecDocument } from '@integrations/domain/aggregates/spec-document.aggregate';
import type { SpecDocumentRepository } from '@integrations/domain/repositories/spec-document.repository';
import type { ApiSpecKind } from '@integrations/domain/value-objects/api-spec.vo';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import {
  type OperationCall,
  SpecOperation,
} from '@integrations/domain/value-objects/spec-operation.vo';
import {
  specDocument,
  specOperation,
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

const rowOf = (operation: SpecOperation): OperationRow => ({
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

const operationOf = (name: string, raw: unknown): SpecOperation => {
  const row = raw as OperationRow;

  return SpecOperation.of({
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
export class DrizzleSpecDocuments implements SpecDocumentRepository {
  constructor(private readonly context: DrizzleContext) {}

  async withHash(hash: ContentHash): Promise<SpecDocument | null> {
    const [found] = await this.context.db
      .select()
      .from(specDocument)
      .where(eq(specDocument.hash, hash.value))
      .limit(1);

    if (!found) {
      return null;
    }

    const operations = await this.context.db
      .select({
        name: specOperation.name,
        operation: specOperation.operation,
      })
      .from(specOperation)
      .where(eq(specOperation.hash, hash.value))
      .orderBy(asc(specOperation.position));

    return SpecDocument.rehydrate({
      hash: ContentHash.of(found.hash),
      kind: found.kind as ApiSpecKind,
      operations: operations.map((each) =>
        operationOf(each.name, each.operation),
      ),
      skipped: found.skipped,
      readAt: found.readAt,
    });
  }

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

  async save(document: SpecDocument): Promise<void> {
    await this.context.inTransaction(async () => {
      const saved = await this.context.db
        .insert(specDocument)
        .values({
          hash: document.hash.value,
          kind: document.kind,
          operations: document.operations.length,
          skipped: [...document.skipped],
          readAt: document.readAt,
        })
        .onConflictDoNothing()
        .returning({ hash: specDocument.hash });

      if (saved.length === 0) {
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
          .insert(specOperation)
          .values(rows.slice(from, from + ROWS_PER_INSERT));
      }
    });
  }
}
