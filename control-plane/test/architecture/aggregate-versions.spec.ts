import { expect, it } from 'vitest';

import {
  aggregateVersionViolations,
  misplacedAggregateViolations,
} from './aggregate-versions';
import { described } from './violation';

it('gives every aggregate a version and a version column', () => {
  expect(described(aggregateVersionViolations())).toEqual([]);
});

it('keeps every aggregate in domain/aggregates', () => {
  expect(described(misplacedAggregateViolations())).toEqual([]);
}, 60_000);
