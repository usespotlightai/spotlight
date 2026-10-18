import { InvalidHostReportError } from '@runners/domain/exceptions/invalid-host-report.error';
import { HostReport } from '@runners/domain/value-objects/host-report.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { describe, expect, it } from 'vitest';

const report = (over: Partial<Parameters<typeof HostReport.of>[0]> = {}) =>
  HostReport.of({
    name: 'build-box',
    release: '0.9.0',
    containerRuntime: 'docker',
    capacity: 4,
    running: ['runner_1'],
    images: [
      {
        image: 'ghcr.io/acme/runner:main',
        isDefault: true,
        harnesses: [
          { id: 'claude-code', models: ['claude-sonnet-5'], version: '2.1.0' },
        ],
      },
    ],
    ...over,
  });

const invalidAt = (over: Partial<Parameters<typeof HostReport.of>[0]>) => {
  try {
    report(over);
  } catch (error) {
    return error instanceof InvalidHostReportError ? error.field : error;
  }

  return null;
};

describe('HostReport', () => {
  it('keeps what a host says of itself, trimmed', () => {
    const parsed = report({ name: '  build-box  ' });

    expect(parsed.name).toBe('build-box');
    expect(parsed.release).toBe('0.9.0');
    expect(parsed.containerRuntime).toBe('docker');
    expect(parsed.capacity).toBe(4);
    expect(parsed.running.map((each) => each.value)).toEqual(['runner_1']);
    expect(parsed.images[0]?.image.value).toBe('ghcr.io/acme/runner:main');
    expect(parsed.images[0]?.harnesses[0]?.version?.value).toBe('2.1.0');
  });

  it('names each runner it is running once', () => {
    expect(
      report({ running: ['runner_1', 'runner_1', 'runner_2'] }).running.map(
        (each) => each.value,
      ),
    ).toEqual(['runner_1', 'runner_2']);
  });

  it('rejects a capacity that is not a whole number from 1 to 1000', () => {
    for (const capacity of [0, 1.5, 1_001, Number.NaN]) {
      expect(invalidAt({ capacity, running: [] })).toBe('capacity');
    }
    expect(invalidAt({ capacity: 1_000 })).toBeNull();
  });

  it('rejects more runners than its capacity', () => {
    expect(invalidAt({ capacity: 1, running: ['runner_1', 'runner_2'] })).toBe(
      'running',
    );
  });

  it('rejects more than 500 images', () => {
    const images = (count: number) =>
      Array.from({ length: count }, (_, at) => ({
        image: `ghcr.io/acme/runner-${at}:main`,
        isDefault: false,
        harnesses: [],
      }));

    expect(invalidAt({ images: images(501) })).toBe('images');
    expect(invalidAt({ images: images(500) })).toBeNull();
  });

  it('rejects two default images, or one image twice', () => {
    const image = (isDefault: boolean, name = 'ghcr.io/acme/runner:main') => ({
      image: name,
      isDefault,
      harnesses: [],
    });

    expect(
      invalidAt({
        images: [image(true), image(true, 'ghcr.io/acme/other:1')],
      }),
    ).toBe('images');
    expect(invalidAt({ images: [image(true), image(false)] })).toBe('images');
  });

  it('finds only an image it supports', () => {
    const report = HostReport.of({
      name: 'build-box',
      release: '0.9.0',
      containerRuntime: 'docker',
      capacity: 2,
      running: [],
      images: [
        { image: 'ghcr.io/acme/runner:main', isDefault: true, harnesses: [] },
        {
          image: 'ghcr.io/acme/old:1',
          isDefault: false,
          harnesses: [],
          unavailableReason: 'too old',
        },
      ],
    });

    expect(
      report.supportedImage(RunnerImage.of('ghcr.io/acme/runner:main'))
        ?.isDefault,
    ).toBe(true);
    expect(
      report.supportedImage(RunnerImage.of('ghcr.io/acme/old:1')),
    ).toBeNull();
    expect(
      report.supportedImage(RunnerImage.of('ghcr.io/acme/none:1')),
    ).toBeNull();
  });

  it('rejects a name, release or container runtime that is blank or too long', () => {
    expect(invalidAt({ name: '   ' })).toBe('name');
    expect(invalidAt({ name: 'n'.repeat(121) })).toBe('name');
    expect(invalidAt({ release: 'r'.repeat(65) })).toBe('release');
    expect(invalidAt({ containerRuntime: '' })).toBe('containerRuntime');
    expect(invalidAt({ containerRuntime: 'e'.repeat(201) })).toBe(
      'containerRuntime',
    );
  });
});
