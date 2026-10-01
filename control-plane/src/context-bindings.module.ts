import { ChangeReviewModule } from '@change-review/change-review.module';
import { ConfigurationModule } from '@configuration/configuration.module';
import { IntegrationsModule } from '@integrations/integrations.module';
import { MemoryModule } from '@memory/memory.module';
import { Global, Module } from '@nestjs/common';
import { OutcomesModule } from '@outcomes/outcomes.module';

@Global()
@Module({
  imports: [
    ConfigurationModule,
    ChangeReviewModule,
    IntegrationsModule,
    MemoryModule,
    OutcomesModule,
  ],
  exports: [
    ConfigurationModule,
    ChangeReviewModule,
    IntegrationsModule,
    MemoryModule,
    OutcomesModule,
  ],
})
export class ContextBindingsModule {}
