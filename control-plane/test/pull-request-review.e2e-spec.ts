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
  const held = `review_${Date.now()}`;
  const pull = `https://github.com/acme/${held}/pull/7`;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    db = app.get(DRIZZLE);

    await db.insert(workspace).values({ id: held, name: held, slug: held });
    await db
      .insert(team)
      .values({ id: held, workspaceId: held, key: 'team', name: held });
  });

  afterEach(async () => {
    await db.delete(reviewTable).where(eq(reviewTable.workspaceId, held));
    await db.delete(reviewComment).where(eq(reviewComment.workspaceId, held));
    await db.delete(workspace).where(eq(workspace.id, held));
    await app.close();
  });

  it('opens a review task when mentioned, and holds the agent’s review for GitHub', async () => {
    const lines = app.get(DrizzleLineRepository);
    const tasks = app.get(DrizzleTaskRepository);
    let next = 0;
    const opening = BUILT_IN_LINES.find((each) =>
      each.role?.equals(LineRole.REVIEW),
    );
    const line = Line.open({
      workspaceId: WorkspaceId.of(held),
      teamId: TeamId.of(held),
      // biome-ignore lint/style/noNonNullAssertion: Spotlight ships a review line
      line: opening!,
      newId: () => `${held}_${++next}`,
    });

    await lines.add(line);
    const stored = await lines.find(line.id);
    // biome-ignore lint/style/noNonNullAssertion: the built-in review line reviews
    expect(stored?.reviews?.equals(line.reviews!)).toBe(true);

    const marks = [{ kind: REVIEW_MARK, value: pull }];
    const mentioned: Happened = {
      happening: 'github.pull_request.mentioned',
      told: 'Somebody mentioned Spotlight on the pull request.',
      spoken: true,
      state: 'raised',
      concerns: { branch: null, marks },
      said: { body: '@spotlight please review' },
      ourOwn: false,
      opens: {
        onto: 'review',
        at: null,
        title: 'Retry uploads',
        description: `Review ${pull}`,
        assignEmail: null,
        marks,
        review: {
          asking: 'mentioned',
          pullRequest: pull,
          author: 'octocat',
          draft: false,
          branch: 'fix-uploads',
        },
      },
    };

    await app
      .get<HappeningReactionsPort>(HAPPENING_REACTIONS)
      .react(WorkspaceId.of(held), TeamId.of(held), [mentioned]);

    const task = await tasks.holding(
      WorkspaceId.of(held),
      // biome-ignore lint/style/noNonNullAssertion: a mark always concerns
      Concerns.of({ marks: [Mark.review(PullRequestUrl.of(pull))] })!,
    );

    expect(task?.reviewing).toBe(true);
    expect(task?.pullRequest?.value).toBe(pull);
    expect(task?.stationId.value).toBe(line.entry?.id.value);
    expect(task?.reviewed?.value).toBe(`acme/${held}`);

    const reviewing = app.get<PullRequestReviewingPort>(PULL_REQUEST_REVIEWING);
    if (!task) {
      throw new Error('no task opened to review the pull request');
    }

    const on = {
      runId: RunId.of(`${held}_run`),
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
    expect(review?.author.runId?.value).toBe(`${held}_run`);
    expect(review?.author.name.value).toBe('Spotlight');
    expect(review?.comments).toHaveLength(1);
  });
});
