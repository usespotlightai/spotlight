import { ChangeReviewModule } from '@change-review/change-review.module';
import { GitHubModule } from '@github/github.module';
import { IdentityModule } from '@identity/identity.module';
import { Module } from '@nestjs/common';
import { OutcomesModule } from '@outcomes/outcomes.module';
import {
  REPLAYS_CONTROLLERS,
  REPLAYS_PROVIDERS,
} from '@replays/replays.wiring';
import { SEARCH_AGENTS } from '@work/application/ports/search-agents.port';
import { SEARCH_SIGHT } from '@work/application/ports/search-sight.port';
import { WorkModule } from '@work/work.module';

@Module({
  imports: [
    IdentityModule,
    GitHubModule,
    WorkModule,
    ChangeReviewModule,
    OutcomesModule,
  ],
  controllers: [...REPLAYS_CONTROLLERS],
  providers: [...REPLAYS_PROVIDERS],
  exports: [SEARCH_AGENTS, SEARCH_SIGHT],
})
export class ReplaysModule {}
