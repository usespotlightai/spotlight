import type { Diff } from '@change-review/domain/value-objects/diff.vo';

export const PATCH_WRITER = Symbol('PATCH_WRITER');

export interface PatchWriterPort {
  patchOf(diff: Diff, hunks: ReadonlySet<string>): string;
}
