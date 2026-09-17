import { GitHubModule } from '@github/github.module';
import { IdentityModule } from '@identity/identity.module';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PlatformModule } from '@platform/platform.module';
import { RunnersModule } from '@runners/runners.module';
import { WorkModule } from '@work/work.module';
import { ContextBindingsModule } from './context-bindings.module';

@Module({
  imports: [
    PlatformModule,
    ScheduleModule.forRoot(),
    WorkModule,
    RunnersModule,
    IdentityModule,
    GitHubModule,
    ContextBindingsModule,
  ],
})
export class AppModule {}
