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
import { RUN_OUTCOMES } from '@work/application/ports/run-outcomes.port';
import { WorkModule } from '@work/work.module';

@Module({
  imports: [IdentityModule, LinesModule, WorkModule, MemoryModule],
  controllers: [...INSIGHTS_CONTROLLERS],
  providers: [...INSIGHTS_PROVIDERS],
  exports: [RUN_OUTCOMES, CHANGE_JUDGMENTS, PAIR_JUDGMENTS, RUN_ACCEPTANCE],
})
export class InsightsModule {}
