import { expect, it } from 'vitest';

import { cascadingDeleteViolations } from './cascading-deletes';
import { described } from './violation';

it('lets no foreign key change a versioned table on delete', () => {
  expect(described(cascadingDeleteViolations())).toEqual([]);
});
