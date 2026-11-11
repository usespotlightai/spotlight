import { expect, it } from 'vitest';

import { rootLintCoverageViolations } from './root-lint-coverage';
import { described } from './violation';

it('applies import rules to every source file', () => {
  expect(described(rootLintCoverageViolations())).toEqual([]);
});
