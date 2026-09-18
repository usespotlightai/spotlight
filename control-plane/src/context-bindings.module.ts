import { ChangeReviewModule } from '@change-review/change-review.module';
import { ConfigurationModule } from '@configuration/configuration.module';
import { IntegrationsModule } from '@integrations/integrations.module';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  imports: [ConfigurationModule, ChangeReviewModule, IntegrationsModule],
  exports: [ConfigurationModule, IntegrationsModule],
})
export class ContextBindingsModule {}
