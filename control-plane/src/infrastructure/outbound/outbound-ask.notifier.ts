import type { LoggerPort } from '@application/ports/logger.port';
import type { TaskAskNotifierPort } from '@application/ports/task-ask-notifier.port';
import type { TeamSecretsPort } from '@application/ports/team-secrets.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type { Task } from '@domain/aggregates/task.aggregate';
import { INTEGRATIONS_UNDER } from '@domain/aggregates/team-configuration.aggregate';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { FactoryRepository } from '@domain/repositories/factory.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { ConversationId } from '@domain/value-objects/conversation-id.vo';
import { Mark } from '@domain/value-objects/mark.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import { reads } from '@infrastructure/integrations/expression';
import type {
  OnBindingIR,
  ReadableIntegration,
} from '@infrastructure/integrations/integration.compile';
import type { IntegrationReader } from '@infrastructure/integrations/integration.reader';
import type { OAuth2Access } from '@infrastructure/integrations/oauth2-access';
import type { HttpOutbound } from '@infrastructure/outbound/http-outbound';

const ASKED = 'task.asked';

/**
 * Carries a task's question out to wherever the team's integration says, when
 * it is put to a person. Generic throughout: it derives a target from the
 * task's marks and the binding's routes, runs the named action, and wears back
 * whatever the action captured — no host is named here.
 */
export class OutboundAskNotifier implements TaskAskNotifierPort {
  constructor(
    private readonly lines: AssemblyLineRepository,
    private readonly factories: FactoryRepository,
    private readonly configurations: TeamConfigurationRepository,
    private readonly reader: IntegrationReader,
    private readonly secrets: TeamSecretsPort,
    private readonly outbound: HttpOutbound,
    private readonly oauth2: OAuth2Access,
    private readonly tasks: TaskRepository,
    private readonly workspaces: WorkspaceReaderPort,
    private readonly base: string,
    private readonly log: LoggerPort,
  ) {}

  async onAsked(task: Task): Promise<void> {
    const line = await this.lines.holding(task.stationId);
    if (!line) {
      return;
    }

    const factory = await this.factories.find(line.factoryId);
    if (!factory) {
      return;
    }

    const applied = await this.configurations.findFor(factory.teamId);
    if (!applied) {
      return;
    }

    const bound = this.reader
      .readable(applied.under(INTEGRATIONS_UNDER))
      .integrations.filter((each) =>
        each.on.some((binding) => binding.event === ASKED),
      );

    if (bound.length === 0) {
      return;
    }

    const open = task.openConversation;
    if (!open) {
      return;
    }

    const station = line.stationAt(task.stationId)?.name.value ?? '';
    const slug = await this.workspaces.slugOf(task.workspaceId.value);
    const conversation = ConversationId.of({
      taskId: task.id,
      from: open.from,
    }).value;

    const ask = {
      body: task.notes[open.from]?.body.value ?? '',
      link: slug ? `${this.base}/w/${slug}/inbox/${conversation}` : null,
      station,
    };

    const context = {
      line: line.key.value,
      station,
      marks: marksOf(task),
    };

    for (const readable of bound) {
      const binding = readable.on.find((each) => each.event === ASKED);
      if (binding) {
        await this.post(task, readable, binding, factory.teamId, {
          task: context,
          ask,
        });
      }
    }
  }

  private async post(
    task: Task,
    readable: ReadableIntegration,
    binding: OnBindingIR,
    teamId: TeamId,
    against: Record<string, unknown>,
  ): Promise<void> {
    const action = readable.actions.get(binding.action);
    if (!action) {
      return;
    }

    const target: Record<string, string> = {};
    for (const each of binding.to) {
      const read = reads(each.value, against);
      if (read !== null) {
        target[each.name] = read;
      }
    }

    if (!target.channel) {
      const routed = binding.routes.get(
        (against.task as { line: string }).line,
      );
      if (routed) {
        target.channel = routed;
      }
    }

    // Nowhere to post is not a failure — the team routes this line nowhere.
    if (!target.channel && !target.thread) {
      return;
    }

    const secret = await this.resolved(readable, teamId);
    // A team that authenticates by its connection has the living token wear in;
    // an action that does not use one pays no visit to the connection store.
    const connection =
      action.auth?.kind === 'oauth2'
        ? await this.oauth2.token(teamId, readable)
        : null;
    const bindings = {
      ...against,
      target,
      secret,
      ...(connection ? { connection } : {}),
    };

    let result: Awaited<ReturnType<HttpOutbound['run']>>;
    try {
      result = await this.outbound.run(action, bindings);
    } catch (error) {
      this.log.warn(
        { err: error, task: task.id.value },
        'Posting a task’s ask',
      );
      return;
    }

    if (!result.ok) {
      this.log.warn(
        { task: task.id.value, status: result.status },
        'A host refused a task’s ask',
      );
      return;
    }

    const beside = {
      ...bindings,
      response: result.response,
      capture: result.capture,
    };

    let marked = task;
    for (const mark of binding.mark) {
      const value = reads(mark.value, beside);
      if (value) {
        marked = marked.markedBy(Mark.of(mark.kind.value, value));
      }
    }

    if (marked !== task) {
      await this.tasks.save(marked);
    }
  }

  private async resolved(
    readable: ReadableIntegration,
    teamId: TeamId,
  ): Promise<Record<string, string>> {
    const secret: Record<string, string> = {};

    for (const name of readable.integration.credentials) {
      const value = await this.secrets.resolve(teamId, name);
      if (value !== null) {
        secret[name.value] = value;
      }
    }

    return secret;
  }
}

const marksOf = (task: Task): Record<string, string> => {
  const marks: Record<string, string> = {};

  for (const mark of task.marks) {
    marks[mark.kind] = mark.value;
  }

  return marks;
};
