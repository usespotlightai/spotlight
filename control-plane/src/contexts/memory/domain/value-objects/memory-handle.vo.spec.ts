import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { describe, expect, it } from 'vitest';

describe('MemoryHandle', () => {
  it('names a memory by its number', () => {
    expect(MemoryHandle.of(12).value).toBe('M-12');
    expect(MemoryHandle.parse(' m-12 ').equals(MemoryHandle.of(12))).toBe(true);
  });

  it('refuses a number below one or past what a handle holds, or a name in any other shape', () => {
    expect(() => MemoryHandle.of(0)).toThrow(InvalidMemoryError);
    expect(() => MemoryHandle.parse('M-99999999999')).toThrow(
      InvalidMemoryError,
    );
    expect(() => MemoryHandle.parse('memory-12')).toThrow(InvalidMemoryError);
  });
});
