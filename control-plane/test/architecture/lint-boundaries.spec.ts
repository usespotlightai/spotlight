import { describe, expect, it } from 'vitest';

import {
  contextsWithoutBoundary,
  lintBoundaryProblems,
} from './lint-boundaries';

describe('lint context boundaries', () => {
  it('gives every context a boundary rule', () => {
    expect(contextsWithoutBoundary()).toEqual([]);
  });

  it('allows no import the context map forbids and names what it allows', () => {
    expect(lintBoundaryProblems()).toEqual([]);
  });
});
