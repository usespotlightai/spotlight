import type { RunTurnout as PublishedTurnout } from '@outcomes/application/ports/run-acceptance.port';
import type { RunTurnout } from '@outcomes/domain/value-objects/run-turnout';
import { describe, expectTypeOf, it } from 'vitest';

describe('RunAcceptancePort', () => {
  it('publishes exactly the turnouts a run record can have', () => {
    expectTypeOf<PublishedTurnout>().toEqualTypeOf<RunTurnout>();
  });
});
