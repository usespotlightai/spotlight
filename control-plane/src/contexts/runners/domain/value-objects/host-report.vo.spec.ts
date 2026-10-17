import { InvalidHostReportError } from '@runners/domain/exceptions/invalid-host-report.error';
import { HostReport } from '@runners/domain/value-objects/host-report.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { describe, expect, it } from 'vitest';

const report = (over: Partial<Parameters<typeof HostReport.of>[0]> = {}) =>
  HostReport.of({
    name: 'build-box',
    release: '0.9.0',
    executor: 'docker',
    capacity: 4,
    running: ['runner_1'],
    images: [
      {
        image: 'ghcr.io/acme/runner:main',
        usual: true,
        harnesses: [
          { id: 'claude-code', models: ['claude-sonnet-5'], version: '2.1.0' },
        ],
      },
    ],
    ...over,
  });

const refusedAt = (over: Partial<Parameters<typeof HostReport.of>[0]>) => {
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
    expect(parsed.executor).toBe('docker');
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

  it('refuses a capacity that is not a whole number from 1 to 1000', () => {
    for (const capacity of [0, 1.5, 1_001, Number.NaN]) {
      expect(refusedAt({ capacity, running: [] })).toBe('capacity');
    }
    expect(refusedAt({ capacity: 1_000 })).toBeNull();
  });

  it('refuses to run more runners than its capacity', () => {
    expect(refusedAt({ capacity: 1, running: ['runner_1', 'runner_2'] })).toBe(
      'running',
    );
  });

  it('refuses more than 500 images', () => {
    const images = (count: number) =>
      Array.from({ length: count }, (_, at) => ({
        image: `ghcr.io/acme/runner-${at}:main`,
        usual: false,
        harnesses: [],
      }));

    expect(refusedAt({ images: images(501) })).toBe('images');
    expect(refusedAt({ images: images(500) })).toBeNull();
  });

  it('refuses two default images, or one image twice', () => {
    const image = (usual: boolean, name = 'ghcr.io/acme/runner:main') => ({
      image: name,
      usual,
      harnesses: [],
    });

    expect(
      refusedAt({
        images: [image(true), image(true, 'ghcr.io/acme/other:1')],
      }),
    ).toBe('images');
    expect(refusedAt({ images: [image(true), image(false)] })).toBe('images');
  });

  it('offers only an image it serves', () => {
    const report = HostReport.of({
      name: 'build-box',
      release: '0.9.0',
      executor: 'docker',
      capacity: 2,
      running: [],
      images: [
        { image: 'ghcr.io/acme/runner:main', usual: true, harnesses: [] },
        {
          image: 'ghcr.io/acme/old:1',
          usual: false,
          harnesses: [],
          refused: 'too old',
        },
      ],
    });

    expect(
      report.offering(RunnerImage.of('ghcr.io/acme/runner:main'))?.usual,
    ).toBe(true);
    expect(report.offering(RunnerImage.of('ghcr.io/acme/old:1'))).toBeNull();
    expect(report.offering(RunnerImage.of('ghcr.io/acme/none:1'))).toBeNull();
  });

  it('refuses a name, release or executor that is blank or too long', () => {
    expect(refusedAt({ name: '   ' })).toBe('name');
    expect(refusedAt({ name: 'n'.repeat(121) })).toBe('name');
    expect(refusedAt({ release: 'r'.repeat(65) })).toBe('release');
    expect(refusedAt({ executor: '' })).toBe('executor');
    expect(refusedAt({ executor: 'e'.repeat(201) })).toBe('executor');
  });
});
