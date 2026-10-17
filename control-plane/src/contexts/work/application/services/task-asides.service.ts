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

    return this.transaction.inTransaction(async () => {
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
        TaskAside.raise({
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

  reopen(asked: AsideOf): Promise<void> {
    const aside = { ...asked, about: AsideAbout.of(asked.about) };

    return this.transaction.inTransaction(async () => {
      const existing = await this.asides.about(
        aside.taskId,
        asideForm(aside.form),
        aside.about,
      );

      if (existing) {
        if (!existing.open) {
          await this.asides.save(existing.reopen(this.clock.now()));
        }
        return;
      }

      const task = await this.tasks.find(aside.taskId);

      if (task) {
        await this.asides.add(
          TaskAside.raise({
            id: TaskAsideId.of(this.ids.generate()),
            workspaceId: task.workspaceId,
            taskId: task.id,
            form: aside.form,
            about: aside.about,
            now: this.clock.now(),
          }),
        );
      }
    });
  }

  async idOf(asked: AsideOf): Promise<string | null> {
    const existing = await this.asides.about(
      asked.taskId,
      asideForm(asked.form),
      AsideAbout.of(asked.about),
    );

    return existing?.id.value ?? null;
  }

  resolve(asked: AsideOf): Promise<void> {
    const aside = { ...asked, about: AsideAbout.of(asked.about) };

    return this.transaction.inTransaction(async () => {
      const existing = await this.asides.about(
        aside.taskId,
        asideForm(aside.form),
        aside.about,
      );

      if (existing) {
        if (existing.open) {
          await this.asides.save(existing.resolve(this.clock.now()));
        }
        return;
      }

      const task = await this.tasks.find(aside.taskId);

      if (task) {
        const now = this.clock.now();

        await this.asides.add(
          TaskAside.raise({
            id: TaskAsideId.of(this.ids.generate()),
            workspaceId: task.workspaceId,
            taskId: task.id,
            form: aside.form,
            about: aside.about,
            now,
          }).resolve(now),
        );
      }
    });
  }
}
