import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunningImage } from '@shared-kernel/domain/value-objects/running-image.vo';
import { describe, expect, it } from 'vitest';

const widgets = RunnerImage.of('ghcr.io/acme/widgets:1');
const gadgets = RunnerImage.of('ghcr.io/acme/gadgets:1');

describe('RunningImage', () => {
  it('serves work that asks for the image it runs', () => {
    expect(RunningImage.of(widgets, false).serves(widgets)).toBe(true);
    expect(RunningImage.of(widgets, true).serves(widgets)).toBe(true);
  });

  it('serves no work that asks for another image', () => {
    expect(RunningImage.of(widgets, true).serves(gadgets)).toBe(false);
  });

  it('serves work that asks for no image only when it runs the usual one', () => {
    expect(RunningImage.of(widgets, true).serves(null)).toBe(true);
    expect(RunningImage.of(widgets, false).serves(null)).toBe(false);
  });
});
