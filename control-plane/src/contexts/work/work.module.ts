import { GitHubModule } from '@github/github.module';
import { IdentityModule } from '@identity/identity.module';
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { RunnersModule } from '@runners/runners.module';
import { SHIPPED_SKILL_KEYS } from '@work/application/ports/built-in-skills.port';
import { GIVEN_TOOLS } from '@work/application/ports/given-tools.port';
import { HAPPENING_REACTIONS } from '@work/application/ports/happening-reactions.port';
import { WORK_LOOKUP } from '@work/application/ports/work-lookup.port';
import { WORK_CONTROLLERS, WORK_PROVIDERS } from '@work/work.wiring';

@Module({
  imports: [DiscoveryModule, IdentityModule, GitHubModule, RunnersModule],
  controllers: [...WORK_CONTROLLERS],
  providers: [...WORK_PROVIDERS],
  exports: [WORK_LOOKUP, SHIPPED_SKILL_KEYS, HAPPENING_REACTIONS, GIVEN_TOOLS],
})
export class WorkModule {}
