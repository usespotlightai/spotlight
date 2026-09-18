import type { CodeReading } from '@change-review/domain/services/diff-facts';

export const CODE_READING = Symbol('CODE_READING');

export type CodeReadingPort = CodeReading;
