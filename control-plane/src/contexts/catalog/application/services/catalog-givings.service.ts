import type {
  CatalogCallAnswer,
  CatalogGiving,
  CatalogNamed,
  CatalogRefusal,
  CatalogSkillGiven,
  CatalogToolGiven,
} from '@catalog/application/contracts/catalog.contract';
import type { CallMeterPort } from '@catalog/application/ports/call-meter.port';
import type {
  CatalogCallRequest,
  CatalogPort,
} from '@catalog/application/ports/catalog.port';
import type { CatalogServicePort } from '@catalog/application/ports/catalog-service.port';
import type {
  CatalogItem,
  CatalogKind,
  CatalogSkill,
  CatalogTool,
} from '@catalog/domain/entities/catalog-item.entity';
import type { CatalogRepository } from '@catalog/domain/repositories/catalog.repository';
import type { WorkspacePlanRepository } from '@catalog/domain/repositories/workspace-plan.repository';
import { entitlementTo } from '@catalog/domain/services/entitlement';
import { CatalogItemId } from '@catalog/domain/value-objects/catalog-item-id.vo';
import { MeteredCall } from '@catalog/domain/value-objects/metered-call.vo';
import type { WorkspacePlan } from '@catalog/domain/value-objects/workspace-plan.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

type Found<T extends CatalogItem> =
  | { readonly given: T }
  | { readonly refused: CatalogRefusal };

const toolGiven = (tool: CatalogTool): CatalogToolGiven => ({
  id: tool.id.value,
  description: tool.listing.description,
  inputs: tool.inputs,
});

const skillGiven = (skill: CatalogSkill): CatalogSkillGiven => ({
  id: skill.id.value,
  description: skill.listing.description,
  files: skill.files,
  tools: skill.brings.map((each) => each.value),
});

const refused = (
  id: string,
  reason: CatalogRefusal['reason'],
  because: string,
): { readonly refused: CatalogRefusal } => ({
  refused: { id, reason, because },
});

export class CatalogGivings implements CatalogPort {
  constructor(
    private readonly catalog: CatalogRepository,
    private readonly plans: WorkspacePlanRepository,
    private readonly meter: CallMeterPort,
    private readonly service: CatalogServicePort,
    private readonly clock: ClockPort,
  ) {}

  async givenTo(
    workspaceId: WorkspaceId,
    named: CatalogNamed,
  ): Promise<CatalogGiving> {
    const plan = await this.plans.of(workspaceId);
    const tools: CatalogToolGiven[] = [];
    const skills: CatalogSkillGiven[] = [];
    const refusals: CatalogRefusal[] = [];
    const seen = new Set<string>();

    const giveTool = (id: string): void => {
      if (seen.has(id)) {
        return;
      }

      seen.add(id);

      const found = this.found(id, 'tool', plan);

      if ('refused' in found) {
        refusals.push(found.refused);
      } else {
        tools.push(toolGiven(found.given));
      }
    };

    const giveSkill = (id: string): void => {
      if (seen.has(id)) {
        return;
      }

      seen.add(id);

      const found = this.found(id, 'skill', plan);

      if ('refused' in found) {
        refusals.push(found.refused);
        return;
      }

      skills.push(skillGiven(found.given));

      for (const each of found.given.brings) {
        giveTool(each.value);
      }
    };

    for (const each of named.tools) {
      giveTool(each);
    }

    for (const each of named.skills) {
      giveSkill(each);
    }

    return { tools, skills, refused: refusals };
  }

  async call(request: CatalogCallRequest): Promise<CatalogCallAnswer> {
    const found = this.found(
      request.id,
      'tool',
      await this.plans.of(request.workspaceId),
    );

    if ('refused' in found) {
      return { kind: 'refused', refusal: found.refused };
    }

    const tool = found.given;
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

  private found(
    id: string,
    kind: 'tool',
    plan: WorkspacePlan,
  ): Found<CatalogTool>;
  private found(
    id: string,
    kind: 'skill',
    plan: WorkspacePlan,
  ): Found<CatalogSkill>;
  private found(
    id: string,
    kind: CatalogKind,
    plan: WorkspacePlan,
  ): Found<CatalogItem> {
    let parsed: CatalogItemId;

    try {
      parsed = CatalogItemId.parse(id);
    } catch {
      return refused(id, 'unknown', `${id} is not in the catalog`);
    }

    const item = this.catalog.find(parsed);

    if (!item) {
      return refused(id, 'unknown', `${id} is not in the catalog`);
    }

    if (item.kind !== kind) {
      return refused(
        id,
        'wrong-kind',
        `${id} is a catalog ${item.kind}, not a ${kind}`,
      );
    }

    const entitlement = entitlementTo(item, plan, this.clock.now());

    return entitlement.entitled
      ? { given: item }
      : refused(id, entitlement.reason, entitlement.because);
  }
}
