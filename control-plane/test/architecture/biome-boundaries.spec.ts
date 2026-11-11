import { describe, expect, it } from 'vitest';
import {
  biomeBoundaryProblems,
  contextsWithoutBoundary,
} from './biome-boundaries';

describe('biome context boundaries', () => {
  it('gives every context a boundary rule', () => {
    expect(contextsWithoutBoundary()).toEqual([]);
  });

  it('allows no import the context map forbids and names what it allows', () => {
    expect(biomeBoundaryProblems()).toEqual([]);
  });
});
