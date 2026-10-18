import { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import { fileThreadOf } from '@change-review/domain/services/file-thread';
import { AuthorName } from '@change-review/domain/value-objects/author-name.vo';
import { ReviewAnchor } from '@change-review/domain/value-objects/review-anchor.vo';
import { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-16T10:00:00Z');
const ON_FILE = ReviewAnchor.onFile('src/invite.ts');

const comment = (id: string, anchor = ON_FILE) =>
  ReviewComment.draft({
    id: ReviewCommentId.of(id),
    workspaceId: WorkspaceId.of('workspace_1'),
    taskId: TaskId.of('task_1'),
    anchor,
    body: 'About the file',
    author: ReviewAuthor.person(UserId.of('user_ada'), AuthorName.of('Ada')),
    now: NOW,
  });

const posted = (id: string, anchor = ON_FILE) =>
  comment(id, anchor)
    .submittedIn(ReviewId.of('review_1'))
    .postedAs({ id: 1, url: 'https://github.com/c/1' });

describe('a file’s thread', () => {
  it('is the comment on the whole file that is posted on GitHub', () => {
    const thread = posted('comment_1');

    expect(fileThreadOf([thread], ON_FILE)?.id).toEqual(thread.id);
  });

  it('is not yet there while the comment on the file is still a draft', () => {
    expect(fileThreadOf([comment('comment_1')], ON_FILE)).toBeNull();
  });

  it('is never a comment on lines, or on another file', () => {
    expect(
      fileThreadOf(
        [
          posted(
            'comment_1',
            ReviewAnchor.onLines({
              path: 'src/invite.ts',
              side: 'new',
              line: 3,
            }),
          ),
          posted('comment_2', ReviewAnchor.onFile('src/other.ts')),
        ],
        ON_FILE,
      ),
    ).toBeNull();
  });
});
