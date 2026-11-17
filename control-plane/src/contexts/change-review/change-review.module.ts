import { RUN_CHANGE_CHECKS } from '@change-review/application/ports/run-change-checks.port';
import { TRIAL_RECHECKS } from '@change-review/application/ports/trial-rechecks.port';
import {
  CHANGE_REVIEW_CONTROLLERS,
  CHANGE_REVIEW_PROVIDERS,
} from '@change-review/change-review.wiring';
import { GitHubModule } from '@github/github.module';
import { IdentityModule } from '@identity/identity.module';
import { InferenceModule } from '@inference/inference.module';
import { Module } from '@nestjs/common';
import { contextBindings } from '@platform/bindings/context-bindings';
import { RunnersModule } from '@runners/runners.module';
import { REVIEW_WORK_PROVISIONING } from '@runs/application/ports/review-work-provisioning.port';
import { REVIEW_WORK } from '@runs/application/ports/review-work.port';
import { RunsModule } from '@runs/runs.module';
import { PULL_REQUEST_REVIEWING } from '@work/application/ports/pull-request-reviewing.port';
import { REVIEW_WORK_ACCESS } from '@work/application/ports/review-work-access.port';
import { TASK_DECISIONS } from '@work/application/ports/task-decisions.port';
import { WorkModule } from '@work/work.module';

const BINDINGS = contextBindings([
  PULL_REQUEST_REVIEWING,
  REVIEW_WORK_ACCESS,
  REVIEW_WORK,
  REVIEW_WORK_PROVISIONING,
  TASK_DECISIONS,
]);

@Module({
  imports: [
    IdentityModule,
    InferenceModule,
    GitHubModule,
    RunnersModule,
    RunsModule,
    WorkModule,
  ],
  controllers: [...CHANGE_REVIEW_CONTROLLERS],
  providers: [...CHANGE_REVIEW_PROVIDERS, ...BINDINGS.exposed],
  exports: [RUN_CHANGE_CHECKS, TRIAL_RECHECKS, ...BINDINGS.exposedTokens],
})
export class ChangeReviewModule {}

@Module({
  imports: [ChangeReviewModule],
  providers: [...BINDINGS.bound],
  exports: [...BINDINGS.tokens],
})
export class ChangeReviewBindingsModule {}
