import {
  CHANGE_REVIEW_CONTROLLERS,
  CHANGE_REVIEW_PROVIDERS,
} from '@change-review/change-review.wiring';
import { GitHubModule } from '@github/github.module';
import { IdentityModule } from '@identity/identity.module';
import { Module } from '@nestjs/common';
import { WorkModule } from '@work/work.module';

@Module({
  imports: [IdentityModule, GitHubModule, WorkModule],
  controllers: [...CHANGE_REVIEW_CONTROLLERS],
  providers: [...CHANGE_REVIEW_PROVIDERS],
})
export class ChangeReviewModule {}
