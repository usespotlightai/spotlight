import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';

const PREFIX = 'M-';

const SHAPE = /^M-(\d+)$/i;

export class MemoryHandle {
  private constructor(readonly number: number) {}

  static of(number: number): MemoryHandle {
    if (!Number.isInteger(number) || number < 1) {
      throw new InvalidMemoryError(`is numbered from 1, not ${number}`);
    }

    return new MemoryHandle(number);
  }

  static parse(raw: string): MemoryHandle {
    const matched = SHAPE.exec(raw.trim());

    if (!matched?.[1]) {
      throw new InvalidMemoryError(`is named like M-12, not ${raw}`);
    }

    return MemoryHandle.of(Number(matched[1]));
  }

  get value(): string {
    return `${PREFIX}${this.number}`;
  }

  equals(other: MemoryHandle): boolean {
    return this.number === other.number;
  }

  toString(): string {
    return this.value;
  }
}
