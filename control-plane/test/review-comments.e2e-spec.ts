import { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import { AuthorName } from '@change-review/domain/value-objects/author-name.vo';
import { FilePath } from '@change-review/domain/value-objects/file-path.vo';
import { ReviewAnchor } from '@change-review/domain/value-objects/review-anchor.vo';
import { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
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
  it('keeps only the comments on the whole of one file', async () => {
    await comments.add(drafted('on_file', ReviewAnchor.onFile('src/a.ts')));
    await comments.add(drafted('on_other', ReviewAnchor.onFile('src/b.ts')));
    await comments.add(
      drafted(
        'on_lines',
        ReviewAnchor.onLines({ path: 'src/a.ts', side: 'new', line: 3 }),
      ),
    );

    const found = await comments.threadsOnFile(TASK, FilePath.of('src/a.ts'));

    expect(found.map((each) => each.id.value)).toEqual(['on_file']);
  });

  it('locks the threads on a file only within a transaction', async () => {
    const context = new DrizzleContext(database.db);
    const locking = new DrizzleReviewCommentRepository(context, {
      dispatch: async () => {},
    } as unknown as DomainEventDispatcher);

    await expect(
      locking.lockThreadsOnFile(TASK, FilePath.of('src/a.ts')),
    ).rejects.toThrow('needs a transaction');
    await expect(
      context.inTransaction(() =>
        locking.lockThreadsOnFile(TASK, FilePath.of('src/a.ts')),
      ),
    ).resolves.toBeUndefined();
  });

  it('refuses a comment on a line that names no side', async () => {
    await expect(
      database.db.execute(
        sql`update review_comment set side = null where id = 'on_lines'`,
      ),
    ).rejects.toThrow();
  });
});
