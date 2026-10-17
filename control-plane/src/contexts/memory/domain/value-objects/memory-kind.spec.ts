import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { parseMemoryKind } from '@memory/domain/value-objects/memory-kind';
import { parseMemoryReach } from '@memory/domain/value-objects/memory-reach';
import { parseMemoryStatus } from '@memory/domain/value-objects/memory-status';
import { describe, expect, it } from 'vitest';

describe('reading what kind of memory, how far it reaches and whether it is active', () => {
  it('reads each one it knows', () => {
    expect(parseMemoryKind(' failure ')).toBe('failure');
    expect(parseMemoryReach('station')).toBe('station');
    expect(parseMemoryStatus('retired')).toBe('retired');
  });

  it('rejects one it does not know, naming those it does', () => {
    expect(() => parseMemoryKind('gossip')).toThrow(
      /one of rationale, rejected-approach, failure, environment, preference, correction, not gossip/,
    );
    expect(() => parseMemoryReach('world')).toThrow(
      /one of team, line, station, not world/,
    );
    expect(() => parseMemoryStatus('pending')).toThrow(InvalidMemoryError);
  });
});
