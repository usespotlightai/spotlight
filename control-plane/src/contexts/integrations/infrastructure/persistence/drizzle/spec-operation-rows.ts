import {
  type OperationCall,
  SpecOperation,
} from '@integrations/domain/value-objects/spec-operation.vo';
import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';

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

export const rowOf = (operation: SpecOperation): OperationRow => ({
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

export const operationOf = (name: string, raw: unknown): SpecOperation => {
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
