import { InvalidHostReportError } from '@runners/domain/exceptions/invalid-host-report.error';
import { HostReport } from '@runners/domain/value-objects/host-report.vo';
import { describe, expect, it } from 'vitest';

const report = (over: Partial<Parameters<typeof HostReport.of>[0]> = {}) =>
  HostReport.of({
    name: 'build-box',
    release: '0.9.0',
    executor: 'docker',
    capacity: 4,
    running: ['runner_1'],
    harnesses: [
      { id: 'claude-code', models: ['claude-sonnet-5'], version: '2.1.0' },
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
  it('holds what a host says of itself, trimmed', () => {
    const held = report({ name: '  build-box  ' });

    expect(held.name).toBe('build-box');
    expect(held.release).toBe('0.9.0');
    expect(held.executor).toBe('docker');
    expect(held.capacity).toBe(4);
    expect(held.running.map((each) => each.value)).toEqual(['runner_1']);
    expect(held.harnesses[0]?.release?.term).toBe('claude-code@2.1.0');
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

  it('refuses a name, release or executor that is blank or too long', () => {
    expect(refusedAt({ name: '   ' })).toBe('name');
    expect(refusedAt({ name: 'n'.repeat(121) })).toBe('name');
    expect(refusedAt({ release: 'r'.repeat(65) })).toBe('release');
    expect(refusedAt({ executor: '' })).toBe('executor');
    expect(refusedAt({ executor: 'e'.repeat(201) })).toBe('executor');
  });
});
