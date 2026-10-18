import { IdentityModule } from '@identity/identity.module';
import { CHANGE_JUDGING } from '@insights/application/ports/change-judging.port';
import { JUDGE_CALIBRATION } from '@insights/application/ports/judge-calibration.port';
import { RUN_ACCEPTANCE } from '@insights/application/ports/run-acceptance.port';
import { SIDE_BY_SIDE_JUDGING } from '@insights/application/ports/side-by-side-judging.port';
import {
  INSIGHTS_CONTROLLERS,
  INSIGHTS_PROVIDERS,
} from '@insights/insights.wiring';
import { MemoryModule } from '@memory/memory.module';
import { Module } from '@nestjs/common';
import { RUN_OUTCOMES } from '@work/application/ports/run-outcomes.port';
import { WorkModule } from '@work/work.module';

@Module({
  imports: [IdentityModule, WorkModule, MemoryModule],
  controllers: [...INSIGHTS_CONTROLLERS],
  providers: [...INSIGHTS_PROVIDERS],
  exports: [
    RUN_OUTCOMES,
    JUDGE_CALIBRATION,
    CHANGE_JUDGING,
    SIDE_BY_SIDE_JUDGING,
    RUN_ACCEPTANCE,
  ],
})
export class InsightsModule {}
