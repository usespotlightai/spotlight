import type { PatchWriterPort } from '@change-review/application/ports/patch-writer.port';
import type {
  Diff,
  DiffFile,
} from '@change-review/domain/value-objects/diff.vo';

const headerOf = (file: DiffFile, withHunks: boolean): string[] => {
  const before = file.previousPath ?? file.path;
  const lines = [`diff --git a/${before} b/${file.path}`];

  if (file.status === 'added') {
    lines.push('new file mode 100644');
  } else if (file.status === 'deleted') {
    lines.push('deleted file mode 100644');
  } else if (file.status === 'renamed') {
    if (!withHunks) {
      lines.push('similarity index 100%');
    }
    lines.push(`rename from ${before}`, `rename to ${file.path}`);
  }

  if (withHunks) {
    lines.push(
      file.status === 'added' ? '--- /dev/null' : `--- a/${before}`,
      file.status === 'deleted' ? '+++ /dev/null' : `+++ b/${file.path}`,
    );
  }

  return lines;
};

export class GitPatchWriter implements PatchWriterPort {
  patchOf(diff: Diff, hunks: ReadonlySet<string>): string {
    return diff.files
      .filter((file) => !file.binary)
      .flatMap((file) => {
        const chosen = file.hunks.filter((hunk) => hunks.has(hunk.id));

        if (chosen.length === 0) {
          return [];
        }

        const patches = chosen.map((hunk) => hunk.patch).filter(Boolean);

        return [[...headerOf(file, patches.length > 0), ...patches].join('\n')];
      })
      .map((each) => `${each}\n`)
      .join('');
  }
}
