import { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import { DrizzleReviewRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/review.repository';
import {
  reviewComment,
  review as reviewTable,
} from '@change-review/infrastructure/persistence/drizzle/schemas/review.schema';
import {
  team,
  workspace,
} from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  type Happened,
  REVIEW_MARK,
} from '@work/application/contracts/happenings.contract';
import {
  HAPPENING_REACTIONS,
  type HappeningReactionsPort,
} from '@work/application/ports/happening-reactions.port';
import {
  PULL_REQUEST_REVIEWING,
  type PullRequestReviewingPort,
} from '@work/application/ports/pull-request-reviewing.port';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { BUILT_IN_LINES } from '@work/domain/services/built-in-lines';
import { Concerns } from '@work/domain/value-objects/concerns.vo';
import { LineRole } from '@work/domain/value-objects/line-role.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { DrizzleLineRepository } from '@work/infrastructure/persistence/drizzle/repositories/line.repository';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '@/app.module';

describe('a pull request reviewed from GitHub (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  const workspaceId = `review_${Date.now()}`;
  const pull = `https://github.com/acme/${workspaceId}/pull/7`;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    db = app.get(DRIZZLE);

    await db
      .insert(workspace)
      .values({ id: workspaceId, name: workspaceId, slug: workspaceId });
    await db
      .insert(team)
      .values({ id: workspaceId, workspaceId, key: 'team', name: workspaceId });
  });

  afterEach(async () => {
    await db
      .delete(reviewTable)
      .where(eq(reviewTable.workspaceId, workspaceId));
    await db
      .delete(reviewComment)
      .where(eq(reviewComment.workspaceId, workspaceId));
    await db.delete(team).where(eq(team.workspaceId, workspaceId));
    await db.delete(workspace).where(eq(workspace.id, workspaceId));
    await app.close();
  });

  it('opens a review task when mentioned, and stores the agent’s review for GitHub', async () => {
    const lines = app.get(DrizzleLineRepository);
    const tasks = app.get(DrizzleTaskRepository);
    let next = 0;
    const opening = BUILT_IN_LINES.find((each) =>
      each.role?.equals(LineRole.REVIEW),
    );
    const line = Line.create({
      by: attributedIn(),
      workspaceId: WorkspaceId.of(workspaceId),
      teamId: TeamId.of(workspaceId),
      // biome-ignore lint/style/noNonNullAssertion: Spotlight has a built-in review line
      line: opening!,
      newId: () => `${workspaceId}_${++next}`,
    });

    await lines.add(line);
    const stored = await lines.find(line.id);
    // biome-ignore lint/style/noNonNullAssertion: the built-in review line has reviews
    expect(stored?.reviews?.equals(line.reviews!)).toBe(true);

    const marks = [{ kind: REVIEW_MARK, value: pull }];
    const mentioned: Happened = {
      happening: 'github.pull_request.mentioned',
      summary: 'Somebody mentioned Spotlight on the pull request.',
      answers: true,
      state: 'raised',
      concerns: { branch: null, marks },
      message: { body: '@spotlight please review' },
      ourOwn: false,
      opens: {
        lineRole: 'review',
        station: null,
        title: 'Retry uploads',
        description: `Review ${pull}`,
        assignEmail: null,
        marks,
        review: {
          trigger: 'mentioned',
          pullRequest: pull,
          author: 'octocat',
          outside: true,
          draft: false,
          branch: 'fix-uploads',
        },
      },
    };

    await app
      .get<HappeningReactionsPort>(HAPPENING_REACTIONS)
      .react(
        WorkspaceId.of(workspaceId),
        TeamId.of(workspaceId),
        [mentioned],
        `mentioned:${workspaceId}`,
      );

    const task = await tasks.findByMarks(
      WorkspaceId.of(workspaceId),
      // biome-ignore lint/style/noNonNullAssertion: concerns with a mark are not null
      Concerns.of({ marks: [Mark.review(PullRequestUrl.of(pull))] })!,
    );

    expect(task?.reviewing).toBe(true);
    expect(task?.fromOutside).toBe(true);
    expect(task?.pullRequest?.value).toBe(pull);
    expect(task?.stationId.value).toBe(line.entry?.id.value);
    expect(task?.reviewedHead?.repository.value).toBe(`acme/${workspaceId}`);

    const reviewing = app.get<PullRequestReviewingPort>(PULL_REQUEST_REVIEWING);
    if (!task) {
      throw new Error('no task opened to review the pull request');
    }

    const on = {
      runId: RunId.of(`${workspaceId}_run`),
      taskId: task.id,
    };

    await reviewing.comment(on, {
      path: 'src/upload.ts',
      line: 12,
      startLine: null,
      side: 'new',
      body: 'This gives up after one try.',
    });
    const id = await reviewing.submit(on, {
      verdict: 'comment',
      body: 'One thing.',
    });

    const review = await app.get(DrizzleReviewRepository).find(ReviewId.of(id));

    expect(review?.state).toBe('submitted');
    expect(review?.author.userId).toBeNull();
    expect(review?.author.runId?.value).toBe(`${workspaceId}_run`);
    expect(review?.author.name.value).toBe('Spotlight');
    expect(review?.comments).toHaveLength(1);
  });
});
