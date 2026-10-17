import type {
  CatalogCallAnswer,
  CatalogDenial,
  CatalogNamed,
  CatalogSkillEntitled,
  CatalogToolEntitled,
  EntitledItems,
} from '@catalog/application/contracts/catalog.contract';
import type { CallMeterPort } from '@catalog/application/ports/call-meter.port';
import type {
  CatalogCallRequest,
  CatalogPort,
} from '@catalog/application/ports/catalog.port';
import type { CatalogServicePort } from '@catalog/application/ports/catalog-service.port';
import type { WorkspacePlansPort } from '@catalog/application/ports/workspace-plans.port';
import type {
  CatalogSkill,
  CatalogTool,
} from '@catalog/domain/entities/catalog-item.entity';
import type { CatalogRepository } from '@catalog/domain/repositories/catalog.repository';
import {
  type Denial,
  resolveEntitled,
  resolveEntitledFor,
} from '@catalog/domain/services/entitlement-resolution';
import { MeteredCall } from '@catalog/domain/value-objects/metered-call.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const toolEntitled = (tool: CatalogTool): CatalogToolEntitled => ({
  id: tool.id.value,
  description: tool.listing.description,
  inputs: tool.inputs.map((each) => ({
    ...each,
    schema: each.schema.written,
  })),
});

const skillEntitled = (skill: CatalogSkill): CatalogSkillEntitled => ({
  id: skill.id.value,
  description: skill.listing.description,
  files: skill.files,
  tools: skill.brings.map((each) => each.value),
});

const denialOf = (denial: Denial): CatalogDenial => ({
  id: denial.id,
  reason: denial.reason,
  because: denial.detail,
});

export class CatalogEntitlements implements CatalogPort {
  constructor(
    private readonly catalog: CatalogRepository,
    private readonly plans: WorkspacePlansPort,
    private readonly meter: CallMeterPort,
    private readonly service: CatalogServicePort,
    private readonly clock: ClockPort,
  ) {}

  async entitledTo(
    workspaceId: WorkspaceId,
    named: CatalogNamed,
  ): Promise<EntitledItems> {
    const entitled = resolveEntitledFor(
      named,
      this.catalog,
      await this.plans.of(workspaceId),
      this.clock.now(),
    );

    return {
      tools: entitled.tools.map(toolEntitled),
      skills: entitled.skills.map(skillEntitled),
      denied: entitled.denied.map(denialOf),
    };
  }

  async call(request: CatalogCallRequest): Promise<CatalogCallAnswer> {
    const result = resolveEntitled(
      request.id,
      'tool',
      this.catalog,
      await this.plans.of(request.workspaceId),
      this.clock.now(),
    );

    if (!result.entitled) {
      return { kind: 'denied', denial: denialOf(result.denial) };
    }

    const tool = result.item;
    const started = this.clock.now();
    let succeeded = false;

    try {
      const output = await this.service.call(tool, request.inputs, {
        workspaceId: request.workspaceId,
        runId: request.runId,
      });

      succeeded = true;

      return { kind: 'answered', output };
    } finally {
      await this.meter.record(
        MeteredCall.of({
          workspaceId: request.workspaceId,
          runId: request.runId,
          item: tool.id,
          at: started,
          ms: this.clock.now().getTime() - started.getTime(),
          succeeded,
        }),
      );
    }
  }
}
