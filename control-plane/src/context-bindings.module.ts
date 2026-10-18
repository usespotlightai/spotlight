import { ChangeReviewModule } from '@change-review/change-review.module';
import { ConfigurationModule } from '@configuration/configuration.module';
import { InsightsModule } from '@insights/insights.module';
import { IntegrationsModule } from '@integrations/integrations.module';
import { MemoryModule } from '@memory/memory.module';
import { Global, Module } from '@nestjs/common';
import { ReplaysModule } from '@replays/replays.module';

@Global()
@Module({
  imports: [
    ConfigurationModule,
    ChangeReviewModule,
    IntegrationsModule,
    MemoryModule,
    InsightsModule,
    ReplaysModule,
  ],
  exports: [
    ConfigurationModule,
    ChangeReviewModule,
    IntegrationsModule,
    MemoryModule,
    InsightsModule,
    ReplaysModule,
  ],
})
export class ContextBindingsModule {}
