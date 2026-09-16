import { integrationFilesIn } from '@application/contracts/configuration-layout.contract';
import type { LoggerPort } from '@application/ports/logger.port';
import type { OutboundTaskNotifierPort } from '@application/ports/outbound-task-notifier.port';
import type { TeamSecretsPort } from '@application/ports/team-secrets.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type { Task } from '@domain/aggregates/task.aggregate';
import type { FactoryRepository } from '@domain/repositories/factory.repository';
import type { LineRepository } from '@domain/repositories/line.repository';
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
import { taskBinding } from '@infrastructure/outbound/task-bindings';

const waiting = (station: string, link: string | null): string => {
  const where = station ? ` at ${station}` : '';

  return `A task${where} is waiting on you.${link ? ` ${link}` : ''}`;
};

export class OutboundTaskNotifier implements OutboundTaskNotifierPort {
  constructor(
    private readonly lines: LineRepository,
    private readonly factories: FactoryRepository,
    private readonly configurations: TeamConfigurationRepository,
    private readonly reader: IntegrationReader,
    private readonly secrets: TeamSecretsPort,
    private readonly outbound: HttpOutbound,
    private readonly oauth2: OAuth2Access,
    private readonly workspaces: WorkspaceReaderPort,
    private readonly base: string,
    private readonly log: LoggerPort,
  ) {}

  async notify(task: Task, event: string): Promise<readonly Mark[]> {
    const line = await this.lines.holding(task.stationId);
    if (!line) {
      return [];
    }

    const factory = await this.factories.find(line.factoryId);
    if (!factory) {
      return [];
    }

    const applied = await this.configurations.findFor(factory.teamId);
    if (!applied) {
      return [];
    }

    const bound = this.reader
      .readable(integrationFilesIn(applied.files))
      .integrations.filter((each) =>
        each.on.some((binding) => binding.event === event),
      );

    if (bound.length === 0) {
      return [];
    }

    const context = taskBinding(task, line);
    const ask = await this.asking(task, context.station);

    const kept: Mark[] = [];
    for (const readable of bound) {
      const binding = readable.on.find((each) => each.event === event);
      if (binding) {
        kept.push(
          ...(await this.post(task, readable, binding, factory.teamId, {
            task: context,
            ask,
          })),
        );
      }
    }

    return kept;
  }

  private async asking(
    task: Task,
    station: string,
  ): Promise<{ body: string; link: string | null; station: string }> {
    const open = task.openConversation;
    if (!open) {
      return { body: '', link: null, station };
    }

    const slug = await this.workspaces.slugOf(task.workspaceId.value);
    const conversation = ConversationId.of({
      taskId: task.id,
      from: open.from,
    }).value;

    const link = slug ? `${this.base}/w/${slug}/inbox/${conversation}` : null;
    const said = task.notes[open.from]?.body.value?.trim() ?? '';

    return { body: said || waiting(station, link), link, station };
  }

  private async post(
    task: Task,
    readable: ReadableIntegration,
    binding: OnBindingIR,
    teamId: TeamId,
    against: Record<string, unknown>,
  ): Promise<readonly Mark[]> {
    const action = readable.actions.get(binding.action);
    if (!action) {
      return [];
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

    if (!target.channel && !target.thread) {
      return [];
    }

    const secret = {
      ...(await this.secrets.resolveAll(
        teamId,
        readable.integration.credentials,
      )),
    };
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
        'Posting a task’s word to a host',
      );
      return [];
    }

    if (!result.ok) {
      this.log.warn(
        {
          task: task.id.value,
          status: result.status,
          response: result.response,
          target,
          marks: (against.task as { marks?: unknown }).marks,
        },
        'A host refused a task’s word',
      );
      return [];
    }

    const beside = {
      ...bindings,
      response: result.response,
      capture: result.capture,
    };

    const kept: Mark[] = [];
    for (const mark of binding.mark) {
      const value = reads(mark.value, beside);
      if (value) {
        kept.push(Mark.of(mark.kind.value, value));
      }
    }

    return kept;
  }
}
