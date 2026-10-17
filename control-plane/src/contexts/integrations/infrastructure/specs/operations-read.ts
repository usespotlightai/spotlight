import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import { SpecOperation } from '@integrations/domain/value-objects/spec-operation.vo';
import type {
  OperationRecord,
  ReadOperations,
} from '@integrations/infrastructure/specs/operation-record';
import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';

interface OperationsRead {
  readonly operations: readonly SpecOperation[];
  readonly skipped: readonly string[];
}

const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const operationOf = (record: OperationRecord): SpecOperation =>
  SpecOperation.of({
    ...record,
    inputs: record.inputs.map((each) => ({
      ...each,
      schema: InputSchema.of(each.schema),
    })),
  });

export const operationsRead = (read: ReadOperations): OperationsRead => {
  const operations: SpecOperation[] = [];
  const skipped = [...read.skipped];

  for (const record of read.operations) {
    try {
      operations.push(operationOf(record));
    } catch (error) {
      skipped.push(
        `skips ${record.upstream}. ${
          error instanceof InvalidIntegrationPartError
            ? `It ${error.because}`
            : reasonOf(error)
        }`,
      );
    }
  }

  return { operations, skipped };
};
