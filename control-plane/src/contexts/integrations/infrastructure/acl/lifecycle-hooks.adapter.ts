import type { FireHooks } from '@integrations/application/services/fire-hooks.service';
import type { HookVerdict as FiredVerdict } from '@integrations/domain/value-objects/hook-verdict.vo';
import { HookedTaskMapper } from '@integrations/infrastructure/acl/hooked-task.mapper';
import type { HookedTaskDto } from '@work/application/ports/hooked-tasks.port';
import type {
  BeforeMoment,
  HookVerdict,
  LifecycleHooksPort,
  ToolUsedMoment,
} from '@work/application/ports/lifecycle-hooks.port';

const eventOf = ({ on: _, ...event }: BeforeMoment | ToolUsedMoment) => event;

const verdictOf = (verdict: FiredVerdict): HookVerdict =>
  verdict.denyReason === null
    ? { kind: 'allowed' }
    : { kind: 'denied', reason: verdict.denyReason };

export class LifecycleHooks implements LifecycleHooksPort {
  constructor(private readonly firings: FireHooks) {}

  listens(teamId: string, on: BeforeMoment['on']): Promise<boolean> {
    return this.firings.listens(teamId, on);
  }

  async before(
    task: HookedTaskDto,
    moment: BeforeMoment,
    until?: Date,
  ): Promise<HookVerdict> {
    return verdictOf(
      await this.firings.before(
        HookedTaskMapper.toHooked(task),
        moment.on,
        eventOf(moment),
        until ?? null,
      ),
    );
  }

  async after(
    task: HookedTaskDto,
    moment: ToolUsedMoment,
    occurrence: string,
  ): Promise<void> {
    await this.firings.happened({
      on: moment.on,
      occurrence,
      change: `${moment.tool} ${occurrence}`,
      task: HookedTaskMapper.toHooked(task),
      event: eventOf(moment),
    });
  }
}
