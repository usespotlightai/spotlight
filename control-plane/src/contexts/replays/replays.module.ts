import { ChangeReviewModule } from '@change-review/change-review.module';
import { GitHubModule } from '@github/github.module';
import { IdentityModule } from '@identity/identity.module';
import { InsightsModule } from '@insights/insights.module';
import { Module } from '@nestjs/common';
import {
  REPLAYS_CONTROLLERS,
  REPLAYS_PROVIDERS,
} from '@replays/replays.wiring';
import { SEARCH_VISIBILITY } from '@work/application/ports/search-visibility.port';
import { WorkModule } from '@work/work.module';

@Module({
  imports: [
    IdentityModule,
    GitHubModule,
    WorkModule,
    ChangeReviewModule,
    InsightsModule,
  ],
  controllers: [...REPLAYS_CONTROLLERS],
  providers: [...REPLAYS_PROVIDERS],
  exports: [SEARCH_VISIBILITY],
})
export class ReplaysModule {}
