import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type {
  AsideOf,
  TaskAsidesPort,
} from '@work/application/ports/task-asides.port';
import { TaskAside } from '@work/domain/aggregates/task-aside.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { TaskAsideRepository } from '@work/domain/repositories/task-aside.repository';
import { AsideAbout } from '@work/domain/value-objects/aside-about.vo';
import { asideForm } from '@work/domain/value-objects/aside-form';
import { TaskAsideId } from '@work/domain/value-objects/task-aside-id.vo';

export class TaskAsides implements TaskAsidesPort {
  constructor(
    private readonly asides: TaskAsideRepository,
    private readonly tasks: TaskRepository,
    private readonly transaction: TransactionPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  raise(asked: AsideOf): Promise<void> {
    const aside = { ...asked, about: AsideAbout.of(asked.about) };

    return this.transaction.run(async () => {
      const task = await this.tasks.find(aside.taskId);

      if (
        !task ||
        (await this.asides.about(
          aside.taskId,
          asideForm(aside.form),
          aside.about,
        ))
      ) {
        return;
      }

      await this.asides.add(
        TaskAside.raised({
          id: TaskAsideId.of(this.ids.generate()),
          workspaceId: task.workspaceId,
          taskId: task.id,
          form: aside.form,
          about: aside.about,
          now: this.clock.now(),
        }),
      );
    });
  }

  settle(asked: AsideOf): Promise<void> {
    const aside = { ...asked, about: AsideAbout.of(asked.about) };

    return this.transaction.run(async () => {
      const held = await this.asides.about(
        aside.taskId,
        asideForm(aside.form),
        aside.about,
      );

      if (held) {
        if (held.open) {
          await this.asides.save(held.settled(this.clock.now()));
        }
        return;
      }

      const task = await this.tasks.find(aside.taskId);

      if (task) {
        const now = this.clock.now();

        await this.asides.add(
          TaskAside.raised({
            id: TaskAsideId.of(this.ids.generate()),
            workspaceId: task.workspaceId,
            taskId: task.id,
            form: aside.form,
            about: aside.about,
            now,
          }).settled(now),
        );
      }
    });
  }
}
