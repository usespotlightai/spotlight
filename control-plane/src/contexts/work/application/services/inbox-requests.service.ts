import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type {
  InboxRequestOf,
  InboxRequestsPort,
} from '@work/application/ports/inbox-requests.port';
import { InboxRequest } from '@work/domain/aggregates/inbox-request.aggregate';
import type { InboxRequestRepository } from '@work/domain/repositories/inbox-request.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { inboxRequestForm } from '@work/domain/value-objects/inbox-request-form';
import { InboxRequestId } from '@work/domain/value-objects/inbox-request-id.vo';
import { InboxRequestSubject } from '@work/domain/value-objects/inbox-request-subject.vo';

export class InboxRequests implements InboxRequestsPort {
  constructor(
    private readonly inboxRequests: InboxRequestRepository,
    private readonly tasks: TaskRepository,
    private readonly transaction: TransactionPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  create(input: InboxRequestOf): Promise<void> {
    const inboxRequest = {
      ...input,
      about: InboxRequestSubject.of(input.about),
    };

    return this.transaction.inTransaction(async () => {
      const task = await this.tasks.find(inboxRequest.taskId);

      if (
        !task ||
        (await this.inboxRequests.about(
          inboxRequest.taskId,
          inboxRequestForm(inboxRequest.form),
          inboxRequest.about,
        ))
      ) {
        return;
      }

      await this.inboxRequests.add(
        InboxRequest.create({
          id: InboxRequestId.of(this.ids.generate()),
          workspaceId: task.workspaceId,
          taskId: task.id,
          form: inboxRequest.form,
          about: inboxRequest.about,
          now: this.clock.now(),
        }),
      );
    });
  }

  reopen(input: InboxRequestOf): Promise<void> {
    const inboxRequest = {
      ...input,
      about: InboxRequestSubject.of(input.about),
    };

    return this.transaction.inTransaction(async () => {
      const existing = await this.inboxRequests.about(
        inboxRequest.taskId,
        inboxRequestForm(inboxRequest.form),
        inboxRequest.about,
      );

      if (existing) {
        if (!existing.open) {
          await this.inboxRequests.save(existing.reopen(this.clock.now()));
        }
        return;
      }

      const task = await this.tasks.find(inboxRequest.taskId);

      if (task) {
        await this.inboxRequests.add(
          InboxRequest.create({
            id: InboxRequestId.of(this.ids.generate()),
            workspaceId: task.workspaceId,
            taskId: task.id,
            form: inboxRequest.form,
            about: inboxRequest.about,
            now: this.clock.now(),
          }),
        );
      }
    });
  }

  async idOf(input: InboxRequestOf): Promise<string | null> {
    const existing = await this.inboxRequests.about(
      input.taskId,
      inboxRequestForm(input.form),
      InboxRequestSubject.of(input.about),
    );

    return existing?.id.value ?? null;
  }

  resolve(input: InboxRequestOf): Promise<void> {
    const inboxRequest = {
      ...input,
      about: InboxRequestSubject.of(input.about),
    };

    return this.transaction.inTransaction(async () => {
      const existing = await this.inboxRequests.about(
        inboxRequest.taskId,
        inboxRequestForm(inboxRequest.form),
        inboxRequest.about,
      );

      if (existing) {
        if (existing.open) {
          await this.inboxRequests.save(existing.resolve(this.clock.now()));
        }
        return;
      }

      const task = await this.tasks.find(inboxRequest.taskId);

      if (task) {
        const now = this.clock.now();

        await this.inboxRequests.add(
          InboxRequest.create({
            id: InboxRequestId.of(this.ids.generate()),
            workspaceId: task.workspaceId,
            taskId: task.id,
            form: inboxRequest.form,
            about: inboxRequest.about,
            now,
          }).resolve(now),
        );
      }
    });
  }
}
