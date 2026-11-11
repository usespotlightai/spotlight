import { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import { ReviewCommentVersionConflictError } from '@change-review/domain/exceptions/review-comment-version-conflict.error';
import { AuthorName } from '@change-review/domain/value-objects/author-name.vo';
import { DeliveryFailure } from '@change-review/domain/value-objects/delivery-failure.vo';
import { FilePath } from '@change-review/domain/value-objects/file-path.vo';
import { ReviewAnchor } from '@change-review/domain/value-objects/review-anchor.vo';
import { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import { DrizzleReviewCommentRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/review-comment.repository';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';

const NOW = new Date('2026-09-23T10:00:00.000Z');
const TASK = TaskId.of('task_1');

let database: TestDatabase;
let comments: DrizzleReviewCommentRepository;

const drafted = (id: string, anchor: ReviewAnchor) =>
  ReviewComment.draft({
    id: ReviewCommentId.of(id),
    workspaceId: WorkspaceId.of('ws_1'),
    taskId: TASK,
    anchor,
    body: 'About this',
    author: ReviewAuthor.person(UserId.of('user_ada'), AuthorName.of('Ada')),
    now: NOW,
  });

beforeAll(async () => {
  database = await openDatabase('review_comments');
  comments = new DrizzleReviewCommentRepository(
    new DrizzleContext(database.db),
    {
      dispatch: async () => {},
    } as unknown as DomainEventDispatcher,
  );
}, 60_000);

afterAll(async () => {
  await database?.close();
});

describe('storing review comments', () => {
  it('finds every comment on one file, and only on that file', async () => {
    await comments.add(drafted('on_file', ReviewAnchor.onFile('src/a.ts')));
    await comments.add(drafted('on_other', ReviewAnchor.onFile('src/b.ts')));
    await comments.add(
      drafted(
        'on_lines',
        ReviewAnchor.onLines({ path: 'src/a.ts', side: 'new', line: 3 }),
      ),
    );

    const found = await comments.onFile(TASK, FilePath.of('src/a.ts'));

    expect(found.map((each) => each.id.value).sort()).toEqual([
      'on_file',
      'on_lines',
    ]);
  });

  it('keeps why a comment failed to reach GitHub', async () => {
    const reply = drafted('to_fail', ReviewAnchor.onFile('src/d.ts'))
      .submittedIn(ReviewId.of('review_1'))
      .postedAs({ id: 301, url: 'https://github.com/o/r/pull/1#r301' })
      .replied({
        id: ReviewCommentId.of('failed_reply'),
        body: 'Done',
        author: ReviewAuthor.person(
          UserId.of('user_ada'),
          AuthorName.of('Ada'),
        ),
        now: NOW,
      });
    await comments.add(reply);
    const stored = await comments.find(reply.id);

    await comments.save(
      (stored as ReviewComment).notPosted(
        DeliveryFailure.of('github-rejected', 'Validation Failed'),
      ),
    );

    expect((await comments.find(reply.id))?.failure).toEqual(
      DeliveryFailure.of('github-rejected', 'Validation Failed'),
    );
  });

  it('rejects a comment on a line that names no side', async () => {
    await expect(
      database.db.execute(
        sql`update review_comment set side = null where id = 'on_lines'`,
      ),
    ).rejects.toThrow();
  });
});

describe('removing the review comments of a task', () => {
  it('removes a comment only at the version it was read', async () => {
    const comment = drafted('versioned', ReviewAnchor.onFile('src/e.ts'));
    await comments.add(comment);
    const read = (await comments.find(comment.id)) as ReviewComment;
    await comments.save(read.edited('Changed', UserId.of('user_ada'), NOW));

    await expect(comments.remove(read)).rejects.toThrow(
      ReviewCommentVersionConflictError,
    );
  });

  it('keeps a reply on another task to one of its comments', async () => {
    const parentTask = TaskId.of('task_parent');
    const replyTask = TaskId.of('task_reply');
    const anchor = ReviewAnchor.onFile('src/c.ts');
    const parent = ReviewComment.receive({
      id: ReviewCommentId.of('parent'),
      workspaceId: WorkspaceId.of('ws_1'),
      taskId: parentTask,
      anchor,
      body: 'Why this?',
      author: ReviewAuthor.onGitHub('octocat'),
      inReplyTo: null,
      github: { id: 101, url: 'https://github.com/o/r/pull/1#r101' },
      at: NOW,
    });
    await comments.add(parent);
    await comments.add(
      ReviewComment.receive({
        id: ReviewCommentId.of('reply'),
        workspaceId: WorkspaceId.of('ws_1'),
        taskId: replyTask,
        anchor,
        body: 'Because of that.',
        author: ReviewAuthor.onGitHub('octocat'),
        inReplyTo: parent,
        github: { id: 102, url: 'https://github.com/o/r/pull/1#r102' },
        at: NOW,
      }),
    );

    for (const each of await comments.ofTask(parentTask)) {
      await comments.remove(each);
    }

    const left = await comments.ofTask(replyTask);
    expect(left.map((each) => each.replyTo?.value)).toEqual(['parent']);
  });
});
