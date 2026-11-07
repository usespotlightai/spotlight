import { ChangeReviewBindingsModule } from '@change-review/change-review.module';
import { ConfigurationBindingsModule } from '@configuration/configuration.module';
import { InsightsBindingsModule } from '@insights/insights.module';
import { IntegrationsBindingsModule } from '@integrations/integrations.module';
import { MemoryBindingsModule } from '@memory/memory.module';
import { Global, Module } from '@nestjs/common';
import { ReplaysBindingsModule } from '@replays/replays.module';
import { WorkBindingsModule } from '@work/work.module';

const BINDINGS = [
  WorkBindingsModule,
  ConfigurationBindingsModule,
  ChangeReviewBindingsModule,
  IntegrationsBindingsModule,
  MemoryBindingsModule,
  InsightsBindingsModule,
  ReplaysBindingsModule,
];

@Global()
@Module({ imports: BINDINGS, exports: BINDINGS })
export class ContextBindingsModule {}
