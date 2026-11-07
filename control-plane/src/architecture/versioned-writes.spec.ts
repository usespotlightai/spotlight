import { expect, it } from 'vitest';
import { ratchetProblems } from './known-violations';
import { versionedWriteViolations } from './versioned-writes';
import { KNOWN_VERSIONED_WRITES } from './versioned-writes.known';

it('updates and deletes a versioned table only on its version', () => {
  expect(
    ratchetProblems(versionedWriteViolations(), KNOWN_VERSIONED_WRITES),
  ).toEqual([]);
});
