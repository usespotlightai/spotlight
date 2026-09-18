import type {
  LineComment,
  ReviewSide,
} from '@github/application/ports/pull-request-reviews.port';

export interface ChangedFile {
  readonly filename: string;
  readonly patch?: string;
}

const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

const key = (path: string, side: ReviewSide, line: number): string =>
  `${side}:${line}:${path}`;

export class PullRequestLines {
  private constructor(private readonly open: ReadonlySet<string>) {}

  static of(files: readonly ChangedFile[]): PullRequestLines {
    const open = new Set<string>();

    for (const file of files) {
      let old = 0;
      let now = 0;

      for (const line of (file.patch ?? '').split('\n')) {
        const hunk = HUNK.exec(line);

        if (hunk) {
          old = Number(hunk[1]);
          now = Number(hunk[2]);
          continue;
        }

        if (line.startsWith('+')) {
          open.add(key(file.filename, 'new', now));
          now += 1;
        } else if (line.startsWith('-')) {
          open.add(key(file.filename, 'old', old));
          old += 1;
        } else if (line.startsWith(' ')) {
          open.add(key(file.filename, 'new', now));
          open.add(key(file.filename, 'old', old));
          now += 1;
          old += 1;
        }
      }
    }

    return new PullRequestLines(open);
  }

  places(comment: LineComment): boolean {
    return [comment.startLine ?? comment.line, comment.line].every((line) =>
      this.open.has(key(comment.path, comment.side, line)),
    );
  }
}
