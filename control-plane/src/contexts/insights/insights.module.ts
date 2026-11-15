import { ConfigurationModule } from '@configuration/configuration.module';
import { GitHubModule } from '@github/github.module';
import { IdentityModule } from '@identity/identity.module';
import { CHANGE_JUDGMENTS } from '@insights/application/ports/change-judgments.port';
import { CLAIMS_REVISION_PULL_REQUESTS } from '@insights/application/ports/claims-revision-pull-requests.port';
import { PAIR_JUDGMENTS } from '@insights/application/ports/pair-judgments.port';
import { RUN_ACCEPTANCE } from '@insights/application/ports/run-acceptance.port';
import { STATION_JUDGE_CALIBRATIONS } from '@insights/application/ports/station-judge-calibrations.port';
import {
  JUDGE_REPAIR_CONTROLLERS,
  JUDGE_REPAIR_PROVIDERS,
} from '@insights/insights.judge-repair.wiring';
import {
  INSIGHTS_CONTROLLERS,
  INSIGHTS_PROVIDERS,
} from '@insights/insights.wiring';
import { LinesModule } from '@lines/lines.module';
import { MemoryModule } from '@memory/memory.module';
import { Module } from '@nestjs/common';
import { contextBindings } from '@platform/bindings/context-bindings';
import { RUN_RESULTS } from '@work/application/ports/run-results.port';
import { WorkModule } from '@work/work.module';

const BINDINGS = contextBindings([RUN_RESULTS]);

@Module({
  imports: [
    IdentityModule,
    GitHubModule,
    LinesModule,
    WorkModule,
    MemoryModule,
    ConfigurationModule,
  ],
  controllers: [...INSIGHTS_CONTROLLERS, ...JUDGE_REPAIR_CONTROLLERS],
  providers: [
    ...INSIGHTS_PROVIDERS,
    ...JUDGE_REPAIR_PROVIDERS,
    ...BINDINGS.exposed,
  ],
  exports: [
    CHANGE_JUDGMENTS,
    PAIR_JUDGMENTS,
    RUN_ACCEPTANCE,
    STATION_JUDGE_CALIBRATIONS,
    CLAIMS_REVISION_PULL_REQUESTS,
    ...BINDINGS.exposedTokens,
  ],
})
export class InsightsModule {}

@Module({
  imports: [InsightsModule],
  providers: [...BINDINGS.bound],
  exports: [...BINDINGS.tokens],
})
export class InsightsBindingsModule {}
