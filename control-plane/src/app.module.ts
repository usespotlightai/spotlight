import { ChangeReviewModule } from '@change-review/change-review.module';
import { ConfigurationModule } from '@configuration/configuration.module';
import { GitHubModule } from '@github/github.module';
import { IdentityModule } from '@identity/identity.module';
import { IntegrationsModule } from '@integrations/integrations.module';
import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PlatformModule } from '@platform/platform.module';
import { RunnersModule } from '@runners/runners.module';
import { WorkModule } from '@work/work.module';

@Global()
@Module({
  imports: [
    WorkModule,
    ConfigurationModule,
    ChangeReviewModule,
    IntegrationsModule,
  ],
  exports: [
    WorkModule,
    ConfigurationModule,
    ChangeReviewModule,
    IntegrationsModule,
  ],
})
class ContextBindingsModule {}

@Module({
  imports: [
    PlatformModule,
    ContextBindingsModule,
    ScheduleModule.forRoot(),
    WorkModule,
    RunnersModule,
    IdentityModule,
    ConfigurationModule,
    ChangeReviewModule,
    GitHubModule,
    IntegrationsModule,
  ],
})
export class AppModule {}
