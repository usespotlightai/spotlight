import {
  CHANGE_REVIEW_CONTROLLERS,
  CHANGE_REVIEW_PROVIDERS,
} from '@change-review/change-review.wiring';
import { GitHubModule } from '@github/github.module';
import { IdentityModule } from '@identity/identity.module';
import { Module } from '@nestjs/common';
import { CHECK_ACCESS } from '@work/application/ports/check-access.port';
import { CHECK_PROVISIONING } from '@work/application/ports/check-provisioning.port';
import { CHECK_WORK } from '@work/application/ports/check-work.port';
import { PULL_REQUEST_REVIEWING } from '@work/application/ports/pull-request-reviewing.port';
import { TASK_DECISIONS } from '@work/application/ports/task-decisions.port';
import { WorkModule } from '@work/work.module';

@Module({
  imports: [IdentityModule, GitHubModule, WorkModule],
  controllers: [...CHANGE_REVIEW_CONTROLLERS],
  providers: [...CHANGE_REVIEW_PROVIDERS],
  exports: [
    PULL_REQUEST_REVIEWING,
    CHECK_ACCESS,
    CHECK_WORK,
    CHECK_PROVISIONING,
    TASK_DECISIONS,
  ],
})
export class ChangeReviewModule {}
