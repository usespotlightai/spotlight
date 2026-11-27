import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';

const PREFIX = 'M-';

const SHAPE = /^M-(\d+)$/i;

const HIGHEST = 2_147_483_647;

export class MemoryHandle {
  private constructor(readonly number: number) {}

  static of(number: number): MemoryHandle {
    if (!Number.isInteger(number) || number < 1 || number > HIGHEST) {
      throw new InvalidMemoryError(`handle must start at 1, not ${number}`);
    }

    return new MemoryHandle(number);
  }

  static parse(raw: string): MemoryHandle {
    const number = SHAPE.exec(raw.trim())?.[1];

    if (number === undefined || number === '') {
      throw new InvalidMemoryError(`handle must look like M-12, not ${raw}`);
    }

    return MemoryHandle.of(Number(number));
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
