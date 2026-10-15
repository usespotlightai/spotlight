import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import { DescribedOperation } from '@integrations/domain/value-objects/described-operation.vo';
import type {
  OperationRecord,
  ReadOperations,
} from '@integrations/infrastructure/sources/operation-record';
import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';

interface OperationsRead {
  readonly operations: readonly DescribedOperation[];
  readonly passedOver: readonly string[];
}

const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const operationOf = (record: OperationRecord): DescribedOperation =>
  DescribedOperation.of({
    ...record,
    inputs: record.inputs.map((each) => ({
      ...each,
      schema: InputSchema.of(each.schema),
    })),
  });

export const operationsRead = (read: ReadOperations): OperationsRead => {
  const operations: DescribedOperation[] = [];
  const passedOver = [...read.passedOver];

  for (const record of read.operations) {
    try {
      operations.push(operationOf(record));
    } catch (error) {
      passedOver.push(
        `passes over ${record.upstream}. ${
          error instanceof InvalidIntegrationPartError
            ? `It ${error.because}`
            : reasonOf(error)
        }`,
      );
    }
  }

  return { operations, passedOver };
};
