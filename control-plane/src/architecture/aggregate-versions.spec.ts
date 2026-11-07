import { expect, it } from 'vitest';
import { aggregateVersionViolations } from './aggregate-versions';
import { KNOWN_AGGREGATE_VERSIONS } from './aggregate-versions.known';
import { ratchetProblems } from './known-violations';

it('gives every aggregate a version and a version column', () => {
  expect(
    ratchetProblems(aggregateVersionViolations(), KNOWN_AGGREGATE_VERSIONS),
  ).toEqual([]);
});
