import { ChangeReviewModule } from '@change-review/change-review.module';
import { ConfigurationModule } from '@configuration/configuration.module';
import { GitHubModule } from '@github/github.module';
import { IdentityModule } from '@identity/identity.module';
import { STATION_CONFIG_PULL_REQUESTS } from '@insights/application/ports/station-config-pull-requests.port';
import { InsightsModule } from '@insights/insights.module';
import { Module } from '@nestjs/common';
import {
  REPLAYS_CONTROLLERS,
  REPLAYS_PROVIDERS,
} from '@replays/replays.wiring';
import { SEARCH_VISIBILITY } from '@work/application/ports/search-visibility.port';
import { STATION_CHANGE_TESTS } from '@work/application/ports/station-change-tests.port';
import { WorkModule } from '@work/work.module';

@Module({
  imports: [
    IdentityModule,
    GitHubModule,
    WorkModule,
    ChangeReviewModule,
    InsightsModule,
    ConfigurationModule,
  ],
  controllers: [...REPLAYS_CONTROLLERS],
  providers: [...REPLAYS_PROVIDERS],
  exports: [
    SEARCH_VISIBILITY,
    STATION_CHANGE_TESTS,
    STATION_CONFIG_PULL_REQUESTS,
  ],
})
export class ReplaysModule {}
