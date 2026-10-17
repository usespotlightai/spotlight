import { InvalidRunnerPlacementError } from '@shared-kernel/domain/exceptions/invalid-runner-placement.error';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { RunningImage } from '@shared-kernel/domain/value-objects/running-image.vo';
import { describe, expect, it } from 'vitest';

const answering = (...terms: string[]) => RunnerTerms.of(terms);

const widgets = RunnerImage.of('ghcr.io/acme/widgets:1');
const gadgets = RunnerImage.of('ghcr.io/acme/gadgets:1');

const runningIn = (image: RunnerImage, isDefault = false, ...terms: string[]) =>
  answering(...terms).runningIn(RunningImage.of(image, isDefault));

describe('RunnerPlacement', () => {
  it('matches every runner when it names none', () => {
    expect(RunnerPlacement.anywhere().matches(RunnerTerms.none())).toBe(true);
    expect(RunnerPlacement.of([]).matches(answering('build-1'))).toBe(true);
  });

  it('matches only a runner answering to one of the labels it names', () => {
    const placed = RunnerPlacement.of(['vpc-internal', 'gpu']);

    expect(placed.matches(answering('linux', 'vpc-internal'))).toBe(true);
    expect(placed.matches(answering('gpu'))).toBe(true);
    expect(placed.matches(answering('linux'))).toBe(false);
    expect(placed.matches(RunnerTerms.none())).toBe(false);
  });

  it('falls back to another placement only when it names none', () => {
    const line = RunnerPlacement.of(['vpc-internal']);

    expect(RunnerPlacement.anywhere().or(line)).toBe(line);
    expect(RunnerPlacement.of(['gpu']).or(line).selectors).toEqual(['gpu']);
  });

  it('matches, when it must honour several placements, only a runner every one of them matches', () => {
    const both = RunnerPlacement.every([
      RunnerPlacement.of(['vpc-a', 'build-1']),
      RunnerPlacement.anywhere(),
      RunnerPlacement.of(['gpu']),
    ]);

    expect(both.matches(answering('vpc-a', 'gpu'))).toBe(true);
    expect(both.matches(answering('build-1', 'gpu'))).toBe(true);
    expect(both.matches(answering('vpc-a'))).toBe(false);
    expect(both.matches(answering('gpu'))).toBe(false);
  });

  it('keeps one of each placement it must honour', () => {
    const twice = RunnerPlacement.every([
      RunnerPlacement.of(['vpc-a', 'gpu']),
      RunnerPlacement.of(['gpu', 'vpc-a']),
    ]);

    expect(twice.clauses).toEqual([['vpc-a', 'gpu']]);
    expect(RunnerPlacement.ofClauses(twice.clauses).equals(twice)).toBe(true);
  });

  it('runs in the image it is placed in, keeping its selectors', () => {
    const placed = RunnerPlacement.of(['gpu']).in(widgets);

    expect(placed.image).toBe(widgets);
    expect(placed.selectors).toEqual(['gpu']);
    expect(placed.isAnywhere).toBe(false);
    expect(RunnerPlacement.anywhere().in(widgets).isAnywhere).toBe(false);
  });

  it('matches only a runner running the image it requests', () => {
    const placed = RunnerPlacement.of(['gpu']).in(widgets);

    expect(placed.matches(runningIn(widgets, false, 'gpu'))).toBe(true);
    expect(placed.matches(runningIn(gadgets, true, 'gpu'))).toBe(false);
    expect(placed.matches(runningIn(widgets, false))).toBe(false);
  });

  it('matches, when it requests no image, only a runner running the default one', () => {
    const placed = RunnerPlacement.anywhere();

    expect(placed.matches(runningIn(widgets, true))).toBe(true);
    expect(placed.matches(runningIn(widgets, false))).toBe(false);
  });

  it('matches a runner that says nothing of its image whatever image it requests', () => {
    expect(
      RunnerPlacement.anywhere().in(widgets).matches(answering('gpu')),
    ).toBe(true);
  });

  it('keeps the one image the placements it must honour request', () => {
    const both = RunnerPlacement.every([
      RunnerPlacement.of(['gpu']).in(widgets),
      RunnerPlacement.of(['vpc-a']),
      RunnerPlacement.anywhere().in(widgets),
    ]);

    expect(both.image?.equals(widgets)).toBe(true);
    expect(both.clauses).toEqual([['gpu'], ['vpc-a']]);
  });

  it('does not honour placements requesting different images', () => {
    expect(() =>
      RunnerPlacement.every([
        RunnerPlacement.anywhere().in(widgets),
        RunnerPlacement.anywhere().in(gadgets),
      ]),
    ).toThrow(InvalidRunnerPlacementError);
  });

  it('is rebuilt from its clauses and image', () => {
    const placed = RunnerPlacement.ofClauses([['gpu'], ['vpc-a']], widgets);

    expect(placed.image?.equals(widgets)).toBe(true);
    expect(
      placed.equals(
        RunnerPlacement.every([
          RunnerPlacement.of(['gpu']),
          RunnerPlacement.of(['vpc-a']),
        ]).in(widgets),
      ),
    ).toBe(true);
    expect(placed.equals(placed.in(gadgets))).toBe(false);
    expect(placed.equals(placed.in(null))).toBe(false);
  });

  it('names any label a pool or trust may be given, of at most 64 characters', () => {
    const longest = 'a'.repeat(64);

    expect(RunnerPlacement.of([longest]).matches(answering(longest))).toBe(
      true,
    );
    expect(() => RunnerPlacement.of(['a'.repeat(65)])).toThrow(
      InvalidRunnerPlacementError,
    );
  });

  it('rejects a selector no label could be', () => {
    for (const unlabelled of ['GPU', 'vpc internal', 'claude-code@2.1.270']) {
      expect(() => RunnerPlacement.of([unlabelled])).toThrow(
        InvalidRunnerPlacementError,
      );
    }
  });

  it('rejects an empty or repeated selector', () => {
    expect(() => RunnerPlacement.of([' '])).toThrow(
      InvalidRunnerPlacementError,
    );
    expect(() => RunnerPlacement.of(['gpu', 'gpu'])).toThrow(
      InvalidRunnerPlacementError,
    );
  });
});

describe('RunnerTerms', () => {
  it('has each term once', () => {
    expect(answering('build-1', 'gpu', 'build-1').values).toEqual([
      'build-1',
      'gpu',
    ]);
  });

  it('rejects an empty term', () => {
    expect(() => answering('build-1', ' ')).toThrow(
      InvalidRunnerPlacementError,
    );
  });

  it('serves any image while it runs in none it knows of', () => {
    expect(RunnerTerms.none().serves(widgets)).toBe(true);
    expect(RunnerTerms.none().serves(null)).toBe(true);
  });

  it('serves the image it runs, and no image only when that is the default one', () => {
    expect(runningIn(widgets).serves(widgets)).toBe(true);
    expect(runningIn(widgets).serves(gadgets)).toBe(false);
    expect(runningIn(widgets).serves(null)).toBe(false);
    expect(runningIn(widgets, true).serves(null)).toBe(true);
  });

  it('equals other terms only when they run in the same image', () => {
    expect(
      runningIn(widgets, true, 'gpu').equals(runningIn(widgets, true, 'gpu')),
    ).toBe(true);
    expect(runningIn(widgets, true, 'gpu').equals(answering('gpu'))).toBe(
      false,
    );
    expect(
      runningIn(widgets, true, 'gpu').equals(runningIn(widgets, false, 'gpu')),
    ).toBe(false);
  });
});
