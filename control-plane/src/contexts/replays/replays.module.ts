import { ChangeReviewModule } from '@change-review/change-review.module';
import { ConfigurationModule } from '@configuration/configuration.module';
import { GitHubModule } from '@github/github.module';
import { IdentityModule } from '@identity/identity.module';
import { STATION_CONFIG_PULL_REQUESTS } from '@insights/application/ports/station-config-pull-requests.port';
import { InsightsModule } from '@insights/insights.module';
import { LinesModule } from '@lines/lines.module';
import { Module } from '@nestjs/common';
import { contextBindings } from '@platform/bindings/context-bindings';
import {
  REPLAYS_CONTROLLERS,
  REPLAYS_PROVIDERS,
} from '@replays/replays.wiring';
import { RunsModule } from '@runs/runs.module';
import { WorkModule } from '@work/work.module';

const BINDINGS = contextBindings([STATION_CONFIG_PULL_REQUESTS]);

@Module({
  imports: [
    IdentityModule,
    GitHubModule,
    LinesModule,
    RunsModule,
    WorkModule,
    ChangeReviewModule,
    InsightsModule,
    ConfigurationModule,
  ],
  controllers: [...REPLAYS_CONTROLLERS],
  providers: [...REPLAYS_PROVIDERS, ...BINDINGS.exposed],
  exports: [...BINDINGS.exposedTokens],
})
export class ReplaysModule {}

@Module({
  imports: [ReplaysModule],
  providers: [...BINDINGS.bound],
  exports: [...BINDINGS.tokens],
})
export class ReplaysBindingsModule {}
