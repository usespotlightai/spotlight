import type { SourceSide } from '@change-review/domain/services/symbol-index';
import type { Diff } from '@change-review/domain/value-objects/diff.vo';

export const DIFF_READER = Symbol('DIFF_READER');

export interface DiffSource {
  readonly path: string;
  readonly side: SourceSide;
  readonly text: string;
}

export type DiffSources = readonly DiffSource[];

export interface ReadDiff {
  readonly diff: Diff;
  readonly sources: DiffSources;
}

export interface DiffReaderPort {
  read(text: string): ReadDiff;
}
