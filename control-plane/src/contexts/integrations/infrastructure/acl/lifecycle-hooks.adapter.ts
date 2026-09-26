import type { HookFirings } from '@integrations/application/services/hook-firings.service';
import type { HookedTaskDto } from '@work/application/ports/hooked-tasks.port';
import type {
  BeforeMoment,
  HookVerdict,
  LifecycleHooksPort,
  ToolUsedMoment,
} from '@work/application/ports/lifecycle-hooks.port';

const eventOf = ({ on: _, ...event }: BeforeMoment | ToolUsedMoment) => event;

export class LifecycleHooks implements LifecycleHooksPort {
  constructor(private readonly firings: HookFirings) {}

  listens(teamId: string, on: BeforeMoment['on']): Promise<boolean> {
    return this.firings.listens(teamId, on);
  }

  before(
    task: HookedTaskDto,
    moment: BeforeMoment,
    until?: Date,
  ): Promise<HookVerdict> {
    return this.firings.before(task, moment.on, eventOf(moment), until ?? null);
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
      task,
      event: eventOf(moment),
    });
  }
}
