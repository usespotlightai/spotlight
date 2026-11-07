import { expect, it } from 'vitest';
import {
  aggregateVersionViolations,
  misplacedAggregateViolations,
} from './aggregate-versions';
import { KNOWN_AGGREGATE_VERSIONS } from './aggregate-versions.known';
import { ratchetProblems } from './known-violations';

it('gives every aggregate a version and a version column', () => {
  expect(
    ratchetProblems(aggregateVersionViolations(), KNOWN_AGGREGATE_VERSIONS),
  ).toEqual([]);
});

it('keeps every aggregate in domain/aggregates', () => {
  expect(
    ratchetProblems(misplacedAggregateViolations(), KNOWN_AGGREGATE_VERSIONS),
  ).toEqual([]);
}, 60_000);
