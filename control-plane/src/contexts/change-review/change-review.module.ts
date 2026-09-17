import {
  CHANGE_REVIEW_CONTROLLERS,
  CHANGE_REVIEW_PROVIDERS,
} from '@change-review/change-review.wiring';
import { GitHubModule } from '@github/github.module';
import { IdentityModule } from '@identity/identity.module';
import { Module } from '@nestjs/common';
import { CONTRIBUTED_TOOLS } from '@work/application/ports/contributed-tools.port';
import { WorkModule } from '@work/work.module';

@Module({
  imports: [WorkModule, IdentityModule, GitHubModule],
  controllers: [...CHANGE_REVIEW_CONTROLLERS],
  providers: [...CHANGE_REVIEW_PROVIDERS],
  exports: [CONTRIBUTED_TOOLS],
})
export class ChangeReviewModule {}
