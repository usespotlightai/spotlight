import { InvalidRunnerPlacementError } from '@shared-kernel/domain/exceptions/invalid-runner-placement.error';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { describe, expect, it } from 'vitest';

const answering = (...terms: string[]) => RunnerTerms.of(terms);

describe('RunnerPlacement', () => {
  it('admits every runner when it names none', () => {
    expect(RunnerPlacement.anywhere().admits(RunnerTerms.none())).toBe(true);
    expect(RunnerPlacement.of([]).admits(answering('build-1'))).toBe(true);
  });

  it('admits only a runner answering to one of the names or labels it gives', () => {
    const placed = RunnerPlacement.of(['vpc-internal', 'build-1']);

    expect(placed.admits(answering('laptop', 'vpc-internal'))).toBe(true);
    expect(placed.admits(answering('build-1'))).toBe(true);
    expect(placed.admits(answering('laptop'))).toBe(false);
    expect(placed.admits(RunnerTerms.none())).toBe(false);
  });

  it('falls back to another placement only when it names none', () => {
    const line = RunnerPlacement.of(['vpc-internal']);

    expect(RunnerPlacement.anywhere().or(line)).toBe(line);
    expect(RunnerPlacement.of(['gpu']).or(line).selectors).toEqual(['gpu']);
  });

  it('admits, when it must honour several placements, only a runner every one of them admits', () => {
    const both = RunnerPlacement.every([
      RunnerPlacement.of(['vpc-a', 'build-1']),
      RunnerPlacement.anywhere(),
      RunnerPlacement.of(['gpu']),
    ]);

    expect(both.admits(answering('vpc-a', 'gpu'))).toBe(true);
    expect(both.admits(answering('build-1', 'gpu'))).toBe(true);
    expect(both.admits(answering('vpc-a'))).toBe(false);
    expect(both.admits(answering('gpu'))).toBe(false);
  });

  it('keeps one of each placement it must honour', () => {
    const twice = RunnerPlacement.every([
      RunnerPlacement.of(['vpc-a', 'gpu']),
      RunnerPlacement.of(['gpu', 'vpc-a']),
    ]);

    expect(twice.clauses).toEqual([['vpc-a', 'gpu']]);
    expect(RunnerPlacement.ofClauses(twice.clauses).equals(twice)).toBe(true);
  });

  it('refuses an empty or repeated selector', () => {
    expect(() => RunnerPlacement.of([' '])).toThrow(
      InvalidRunnerPlacementError,
    );
    expect(() => RunnerPlacement.of(['gpu', 'gpu'])).toThrow(
      InvalidRunnerPlacementError,
    );
  });
});

describe('RunnerTerms', () => {
  it('holds each term once', () => {
    expect(answering('build-1', 'gpu', 'build-1').values).toEqual([
      'build-1',
      'gpu',
    ]);
  });

  it('refuses an empty term', () => {
    expect(() => answering('build-1', ' ')).toThrow(
      InvalidRunnerPlacementError,
    );
  });
});
