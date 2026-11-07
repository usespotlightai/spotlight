import type { FileClass } from '@change-review/domain/services/diff-facts';

export interface CodeReading {
  classOf(path: string): FileClass;

  reads(path: string): boolean;

  definitionsIn(path: string, added: readonly string[]): readonly string[];

  importsIn(path: string, added: readonly string[]): readonly string[];
}
