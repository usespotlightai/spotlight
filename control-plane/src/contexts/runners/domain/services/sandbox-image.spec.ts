import { sandboxImage } from '@runners/domain/services/sandbox-image';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { describe, expect, it } from 'vitest';

const RUNNER = RunnerImage.of('ghcr.io/acme/runner:main');

const WIDGETS = RunnerImage.of('ghcr.io/acme/widgets:1');

const WIDGETS_PINNED = RunnerImage.of(
  `ghcr.io/acme/widgets@sha256:${'a'.repeat(64)}`,
);

const OLD_PINNED = RunnerImage.of(`ghcr.io/acme/old@sha256:${'b'.repeat(64)}`);

const HOST = [
  { image: RUNNER, digest: null, isDefault: true },
  { image: WIDGETS, digest: WIDGETS_PINNED, isDefault: false },
];

const named = (image: RunnerImage | null) => image?.value ?? null;

describe('sandboxImage', () => {
  it('names a warm sandbox by the image its line asks for, or by the host’s default one', () => {
    expect(named(sandboxImage({ warm: true, placement: WIDGETS }, HOST))).toBe(
      WIDGETS.value,
    );
    expect(named(sandboxImage({ warm: true, placement: null }, HOST))).toBe(
      RUNNER.value,
    );
    expect(sandboxImage({ warm: true, placement: null }, [])).toBeNull();
  });

  it('names a task’s sandbox by the image of its last run', () => {
    expect(named(sandboxImage({ warm: false, lastRanIn: RUNNER }, HOST))).toBe(
      RUNNER.value,
    );
    expect(sandboxImage({ warm: false, lastRanIn: null }, HOST)).toBeNull();
  });

  it('names a pinned image by the host image with that digest, and keeps a digest the host does not know', () => {
    expect(
      named(sandboxImage({ warm: false, lastRanIn: WIDGETS_PINNED }, HOST)),
    ).toBe(WIDGETS.value);
    expect(
      named(sandboxImage({ warm: true, placement: WIDGETS_PINNED }, HOST)),
    ).toBe(WIDGETS.value);
    expect(
      named(sandboxImage({ warm: false, lastRanIn: OLD_PINNED }, HOST)),
    ).toBe(OLD_PINNED.value);
  });
});
