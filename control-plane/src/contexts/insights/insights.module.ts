import { ConfigurationModule } from '@configuration/configuration.module';
import { IdentityModule } from '@identity/identity.module';
import { CHANGE_JUDGMENTS } from '@insights/application/ports/change-judgments.port';
import { PAIR_JUDGMENTS } from '@insights/application/ports/pair-judgments.port';
import { RUN_ACCEPTANCE } from '@insights/application/ports/run-acceptance.port';
import {
  INSIGHTS_CONTROLLERS,
  INSIGHTS_PROVIDERS,
} from '@insights/insights.wiring';
import { LinesModule } from '@lines/lines.module';
import { MemoryModule } from '@memory/memory.module';
import { Module } from '@nestjs/common';
import { contextBindings } from '@platform/bindings/context-bindings';
import { RUN_OUTCOMES } from '@work/application/ports/run-outcomes.port';
import { WorkModule } from '@work/work.module';

const BINDINGS = contextBindings([RUN_OUTCOMES]);

@Module({
  imports: [
    IdentityModule,
    LinesModule,
    WorkModule,
    MemoryModule,
    ConfigurationModule,
  ],
  controllers: [...INSIGHTS_CONTROLLERS],
  providers: [...INSIGHTS_PROVIDERS, ...BINDINGS.exposed],
  exports: [
    CHANGE_JUDGMENTS,
    PAIR_JUDGMENTS,
    RUN_ACCEPTANCE,
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
