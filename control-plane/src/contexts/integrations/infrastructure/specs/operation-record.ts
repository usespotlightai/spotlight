import type { OperationCall } from '@integrations/domain/value-objects/spec-operation.vo';
import {
  INPUT_NAME,
  slugify,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export interface OperationRecord {
  readonly name: string;
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

export interface ReadOperations {
  readonly operations: readonly OperationRecord[];
  readonly skipped: readonly string[];
}

export class SpecUnreadable extends Error {
  constructor(readonly because: string) {
    super(because);
    this.name = 'SpecUnreadable';
  }
}

const MAX_DESCRIPTION = 1000;

const NAMEABLE = new RegExp(`^${INPUT_NAME}$`);

export const isNameable = (name: string): boolean => NAMEABLE.test(name);

export const toolWordsOf = (upstream: string): string =>
  slugify(
    upstream
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2'),
  );

export const describedAs = (text: unknown, otherwise: string): string => {
  const trimmed = typeof text === 'string' ? text.trim() : '';

  return (trimmed === '' ? otherwise : trimmed).slice(0, MAX_DESCRIPTION);
};

export const firstByName = (
  records: readonly OperationRecord[],
): ReadOperations => {
  const named = new Map<string, OperationRecord>();
  const skipped: string[] = [];

  for (const record of records) {
    if (named.has(record.name)) {
      skipped.push(
        `skips ${record.upstream}. Another operation is also called ${record.name}`,
      );
    } else {
      named.set(record.name, record);
    }
  }

  return { operations: [...named.values()], skipped };
};
