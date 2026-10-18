import { InvalidRunnerImageError } from '@shared-kernel/domain/exceptions/invalid-runner-image.error';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { describe, expect, it } from 'vitest';

const DIGEST = `sha256:${'a'.repeat(64)}`;

describe('RunnerImage', () => {
  it.each([
    'runner',
    'acme/runner',
    'ghcr.io/acme/runner:main',
    'registry.internal:5000/acme/runner:v1.2.3',
    `ghcr.io/acme/runner@${DIGEST}`,
    `ghcr.io/acme/runner:main@${DIGEST}`,
  ])('accepts the reference %s', (reference) => {
    expect(RunnerImage.of(reference).value).toBe(reference);
  });

  it('trims the reference it is given', () => {
    expect(RunnerImage.of('  ghcr.io/acme/runner:main ').value).toBe(
      'ghcr.io/acme/runner:main',
    );
  });

  it.each([
    '',
    '   ',
    'GHCR.io/acme/runner',
    'ghcr.io/Acme/runner',
    'ghcr.io/acme/runner main',
    'ghcr.io/acme/runner:',
    'ghcr.io/acme/runner@sha256:abc',
    `ghcr.io/acme/runner@sha256:${'A'.repeat(64)}`,
  ])('rejects the reference %j', (reference) => {
    expect(() => RunnerImage.of(reference)).toThrow(InvalidRunnerImageError);
  });

  it('rejects a reference longer than 255 characters', () => {
    expect(() => RunnerImage.of(`ghcr.io/${'a'.repeat(250)}`)).toThrow(
      InvalidRunnerImageError,
    );
  });

  it('is pinned only when it names a digest', () => {
    expect(RunnerImage.of(`ghcr.io/acme/runner@${DIGEST}`).isPinned).toBe(true);
    expect(RunnerImage.of(`ghcr.io/acme/runner:main@${DIGEST}`).isPinned).toBe(
      true,
    );
    expect(RunnerImage.of('ghcr.io/acme/runner:main').isPinned).toBe(false);
  });

  it('names its repository whatever tag or digest it carries', () => {
    expect(RunnerImage.of('ghcr.io/acme/runner:main').repository).toBe(
      'ghcr.io/acme/runner',
    );
    expect(RunnerImage.of(`ghcr.io/acme/runner@${DIGEST}`).repository).toBe(
      'ghcr.io/acme/runner',
    );
    expect(RunnerImage.of('localhost:5001/runner').repository).toBe(
      'localhost:5001/runner',
    );
    expect(RunnerImage.of('docker.io/library/ubuntu:24.04').repository).toBe(
      'ubuntu',
    );
  });

  it('equals another naming the same reference', () => {
    expect(
      RunnerImage.of('ghcr.io/acme/runner:1').equals(
        RunnerImage.of('ghcr.io/acme/runner:1'),
      ),
    ).toBe(true);
    expect(
      RunnerImage.of('ghcr.io/acme/runner:1').equals(
        RunnerImage.of('ghcr.io/acme/runner:2'),
      ),
    ).toBe(false);
  });
});
