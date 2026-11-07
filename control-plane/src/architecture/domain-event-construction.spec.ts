import { expect, it } from 'vitest';
import { domainEventConstructionViolations } from './domain-event-construction';
import { KNOWN_DOMAIN_EVENT_CONSTRUCTION } from './domain-event-construction.known';
import { ratchetProblems } from './known-violations';

it('raises domain events only in the domain layer', () => {
  expect(
    ratchetProblems(
      domainEventConstructionViolations(),
      KNOWN_DOMAIN_EVENT_CONSTRUCTION,
    ),
  ).toEqual([]);
}, 60_000);
