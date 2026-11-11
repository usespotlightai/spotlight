import { expect, it } from 'vitest';
import { versionedWriteViolations } from './versioned-writes';
import { described } from './violation';

it('updates and deletes a versioned table only on its version', () => {
  expect(described(versionedWriteViolations())).toEqual([]);
});
