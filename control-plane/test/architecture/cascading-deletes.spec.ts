import { expect, it } from 'vitest';
import { cascadingDeleteViolations } from './cascading-deletes';
import { KNOWN_CASCADING_DELETES } from './cascading-deletes.known';
import { ratchetProblems } from './known-violations';

it('lets no foreign key change a versioned table on delete', () => {
  expect(
    ratchetProblems(cascadingDeleteViolations(), KNOWN_CASCADING_DELETES),
  ).toEqual([]);
});
