import {
  checkoutOf,
  listAt,
  RunSpecMapper,
} from '@runs/application/mappers/run-spec.mapper';
import { InvalidRunSpecError } from '@runs/domain/exceptions/invalid-run-spec.error';
import {
  checkoutFoldersOf,
  type RunSpec,
} from '@runs/domain/value-objects/run-spec.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export const RunSpecPersistence = {
  fromRow(raw: unknown): RunSpec {
    try {
      return RunSpecMapper.received(raw);
    } catch (error) {
      if (error instanceof InvalidRunSpecError) {
        throw new InconsistentStateError(
          'run',
          `has a spec that no longer reads: ${error.message}`,
        );
      }

      throw error;
    }
  },

  toRow(spec: RunSpec): RunSpec['value'] {
    return spec.value;
  },

  checkoutFoldersIn(raw: unknown): readonly string[] {
    return checkoutFoldersOf(
      raw === null || raw === undefined
        ? []
        : listAt(raw, 'its checkouts', checkoutOf),
    );
  },
};
