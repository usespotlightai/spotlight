import { InvalidTaskRankError } from '@work/domain/exceptions/invalid-task-rank.error';

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const BASE = DIGITS.length;
const RANK = /^[0-9a-z]+$/;

const digitAt = (value: string, index: number, beyond: number): number =>
  index < value.length ? DIGITS.indexOf(value[index] as string) : beyond;

const midstring = (before: string, after: string): string => {
  let prefix = '';

  for (let index = 0; ; index += 1) {
    const low = digitAt(before, index, 0);
    const high = digitAt(after, index, BASE);

    if (high - low > 1) {
      return prefix + DIGITS[Math.floor((low + high) / 2)];
    }

    prefix += DIGITS[low];
  }
};

export class TaskRank {
  private constructor(readonly value: string) {}

  static of(raw: string): TaskRank {
    const trimmed = raw.trim();

    if (!RANK.test(trimmed)) {
      throw new InvalidTaskRankError(
        `must be digits and lowercase letters, but was "${raw}"`,
      );
    }

    return new TaskRank(trimmed);
  }

  static between(before: TaskRank | null, after: TaskRank | null): TaskRank {
    const low = before?.value ?? '';
    const high = after?.value ?? '';

    if (high !== '' && low >= high) {
      throw new InvalidTaskRankError(
        `cannot sit between "${low}" and "${high}", which are out of order`,
      );
    }

    return new TaskRank(midstring(low, high));
  }

  isBefore(other: TaskRank): boolean {
    return this.value < other.value;
  }

  equals(other: TaskRank): boolean {
    return this.value === other.value;
  }
}
