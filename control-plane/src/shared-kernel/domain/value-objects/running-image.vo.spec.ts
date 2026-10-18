import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunningImage } from '@shared-kernel/domain/value-objects/running-image.vo';
import { describe, expect, it } from 'vitest';

const widgets = RunnerImage.of('ghcr.io/acme/widgets:1');
const gadgets = RunnerImage.of('ghcr.io/acme/gadgets:1');

describe('RunningImage', () => {
  it('serves work that requests the image it runs', () => {
    expect(RunningImage.of(widgets, false).supports(widgets)).toBe(true);
    expect(RunningImage.of(widgets, true).supports(widgets)).toBe(true);
  });

  it('serves no work that requests another image', () => {
    expect(RunningImage.of(widgets, true).supports(gadgets)).toBe(false);
  });

  it('serves work that requests no image only when it runs the default one', () => {
    expect(RunningImage.of(widgets, true).supports(null)).toBe(true);
    expect(RunningImage.of(widgets, false).supports(null)).toBe(false);
  });
});
