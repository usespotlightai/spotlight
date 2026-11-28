import type {
  EndingToClassify,
  RunEndingsPort,
} from '@insights/application/ports/run-endings.port';
import type { LeftOutCause } from '@insights/domain/value-objects/left-out-cause';
import {
  type RunEndingCauseContract,
  runEndingCauseOf,
} from '@runs/application/contracts/run-failure.contract';

const OUTSIDE: Readonly<Record<RunEndingCauseContract, LeftOutCause | null>> = {
  work: null,
  refused: 'refused',
  setup: 'setup',
  infrastructure: 'infrastructure',
  cancelled: 'cancelled',
};

export class RunEndings implements RunEndingsPort {
  outsideCauseOf(end: EndingToClassify): LeftOutCause | null {
    const cause = runEndingCauseOf({
      cancelled: end.ending === 'cancelled',
      failure: end.failure,
    });

    return cause === null ? null : OUTSIDE[cause];
  }
}
