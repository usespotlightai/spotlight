import { describe, expect, it } from 'vitest';
import {
  contextDependencyViolations,
  integrationEventsWithoutPublisher,
  reachableFrom,
  UPSTREAM_CONTEXTS,
} from './context-dependencies';
import { KNOWN_CONTEXT_DEPENDENCIES } from './context-dependencies.known';
import { ratchetProblems } from './known-violations';
import { CONTEXTS } from './source-index';

describe('context dependencies', () => {
  it('places every context in the context map', () => {
    expect(Object.keys(UPSTREAM_CONTEXTS).sort()).toEqual(CONTEXTS);
  });

  it('keeps the context map free of cycles', () => {
    expect(
      CONTEXTS.filter((context) => reachableFrom(context).has(context)),
    ).toEqual([]);
  });

  it('names the publishing context in every integration event kind', () => {
    expect(integrationEventsWithoutPublisher()).toEqual([]);
  });

  it('imports and hears only upstream contexts', () => {
    expect(
      ratchetProblems(
        contextDependencyViolations(),
        KNOWN_CONTEXT_DEPENDENCIES,
      ),
    ).toEqual([]);
  }, 60_000);
});
