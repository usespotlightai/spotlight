import { expect, it } from 'vitest';
import { ratchetProblems } from './known-violations';
import { rootLintCoverageViolations } from './root-lint-coverage';
import { KNOWN_ROOT_LINT_COVERAGE } from './root-lint-coverage.known';

it('applies import rules to every file at the source root', () => {
  expect(
    ratchetProblems(rootLintCoverageViolations(), KNOWN_ROOT_LINT_COVERAGE),
  ).toEqual([]);
});
