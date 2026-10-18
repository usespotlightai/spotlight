import type { RunDisposition as PublishedDisposition } from '@insights/application/ports/run-acceptance.port';
import type { RunDisposition } from '@insights/domain/value-objects/run-disposition';
import { describe, expectTypeOf, it } from 'vitest';

describe('RunAcceptancePort', () => {
  it('publishes exactly the dispositions a run record can have', () => {
    expectTypeOf<PublishedDisposition>().toEqualTypeOf<RunDisposition>();
  });
});
