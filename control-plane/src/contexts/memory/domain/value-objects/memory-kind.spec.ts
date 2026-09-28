import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { parseMemoryKind } from '@memory/domain/value-objects/memory-kind';
import { parseMemoryReach } from '@memory/domain/value-objects/memory-reach';
import { parseMemoryStanding } from '@memory/domain/value-objects/memory-standing';
import { describe, expect, it } from 'vitest';

describe('reading what kind of memory, how far it reaches and whether it stands', () => {
  it('reads each one it knows', () => {
    expect(parseMemoryKind(' failure ')).toBe('failure');
    expect(parseMemoryReach('station')).toBe('station');
    expect(parseMemoryStanding('retired')).toBe('retired');
  });

  it('refuses one it does not know, naming those it does', () => {
    expect(() => parseMemoryKind('gossip')).toThrow(
      /one of rationale, rejected-approach, failure, environment, preference, correction, not gossip/,
    );
    expect(() => parseMemoryReach('world')).toThrow(
      /one of team, line, station, not world/,
    );
    expect(() => parseMemoryStanding('pending')).toThrow(InvalidMemoryError);
  });
});
