import type { PullRequestPort } from '@github/application/ports/pull-request.port';
import type { RepositorySettingsPort } from '@github/application/ports/repository-settings.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { BuiltInToolUse } from '@work/application/ports/built-in-tool-uses.port';
import type { ChatToolContext } from '@work/application/ports/integration-tools.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import { ChatRefused } from '@work/application/rendering/chat-refused';
import type { CreateTask } from '@work/application/services/create-task';
import type { PullRequestOpeningHook } from '@work/application/services/pull-request-opening-hook';
import type { WorkAccess } from '@work/application/services/work-access.service';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { InvalidChatTransitionError } from '@work/domain/exceptions/invalid-chat-transition.error';
import { UnknownChatError } from '@work/domain/exceptions/unknown-chat.error';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { chatPullRequestPlacement } from '@work/domain/services/chat-pull-request-placement';
import { Placement } from '@work/domain/services/placement';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { OPEN_PULL_REQUEST } from '@work/domain/value-objects/built-in-tools';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ChatPullRequest } from '@work/domain/value-objects/chat-pull-request.vo';
import { HoldId } from '@work/domain/value-objects/hold-id.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { PullRequestTitle } from '@work/domain/value-objects/pull-request-title.vo';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import type { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';

const NEXT =
  'The pull request is open. When a check fails or someone reviews it, you hear about it here: fix it and push to the same branch. The person can hand the task to the line at any time.';

const baseOf = (named: string | null | undefined): Branch | null => {
  const trimmed = named?.trim();

  return trimmed ? Branch.of(trimmed) : null;
};

interface Opening {
  readonly chat: Chat;
  readonly runId: RunId;
  readonly repository: Repository;
  readonly branch: Branch;
  readonly base: Branch | null;
  readonly defaultBranch: Branch;
  readonly title: PullRequestTitle;
  readonly body: string;
}

export class ChatPullRequestToolUse implements BuiltInToolUse<ChatToolContext> {
  readonly tool = OPEN_PULL_REQUEST;

  constructor(
    private readonly chats: ChatRepository,
    private readonly tasks: TaskRepository,
    private readonly lines: LineMapsPort,
    private readonly placements: TaskPlacementsPort,
    private readonly access: WorkAccess,
    private readonly createTask: CreateTask,
    private readonly pullRequests: PullRequestPort,
    private readonly openingHook: PullRequestOpeningHook,
    private readonly transaction: TransactionPort,
    private readonly settings: RepositorySettingsPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async call(
    { runId, chatId }: ChatToolContext,
    inputs: ToolInputs,
  ): Promise<unknown> {
    const chat = await this.found(chatId);
    const repository = chat.mayOpenPullRequestFrom(
      runId,
      inputs.text('repository'),
    );
    const defaultBranch = Branch.of(
      await this.settings.defaultBranchNameOf(chat.workspaceId, repository),
    );
    const base = baseOf(inputs.text('base'));
    const opening: Opening = {
      chat,
      runId,
      repository,
      branch: Branch.of(inputs.requiredText(this.tool, 'branch')),
      base,
      defaultBranch,
      title: PullRequestTitle.of(inputs.requiredText(this.tool, 'title')),
      body: inputs.text('body')?.trim() ?? '',
    };
    const lines = await this.lines.ofTeam(chat.teamId);
    const onBranch = await this.tasks.onBranch(
      chat.workspaceId,
      opening.branch,
    );
    const { task, url } = onBranch
      ? await this.onTaskOf(opening, lines, onBranch)
      : await this.withNewTask(opening, lines, inputs);

    await this.transaction.inTransaction(async () => {
      await this.chats.save(
        (await this.found(chatId)).openedPullRequest({
          runId,
          title: opening.title.value,
          repository: opening.repository,
          pullRequest: ChatPullRequest.of({ task: task.id, url }),
          at: this.clock.now(),
        }),
      );
    });

    return { url: url.value, task: task.id.value, next: NEXT };
  }

  private async onTaskOf(
    opening: Opening,
    lines: readonly LineMap[],
    task: Task,
  ): Promise<{ task: Task; url: PullRequestUrl }> {
    const step = task.chatPullRequestStep(
      opening.chat.id,
      opening.repository,
      lines.find((each) => each.stationAt(task.stationId)) ?? null,
      { base: opening.base, defaultBranch: opening.defaultBranch },
    );

    if (step.kind === 'refused') {
      throw new InvalidChatTransitionError(ChatRefused.text(step.refusal));
    }

    if (step.kind === 'known') {
      return { task, url: step.url };
    }

    await this.openingHook.allows({
      task,
      runId: null,
      repository: opening.repository,
      title: opening.title.value,
    });

    const url = await this.opened({ ...opening, base: task.base });

    await this.transaction.inTransaction(async () => {
      await this.tasks.save(
        (await this.taskFound(task.id)).recordChatPullRequest(
          opening.chat.id,
          url,
          this.clock.now(),
          step.line,
        ),
      );
    });

    return { task, url };
  }

  private async withNewTask(
    opening: Opening,
    lines: readonly LineMap[],
    inputs: ToolInputs,
  ): Promise<{ task: Task; url: PullRequestUrl }> {
    const { chat, branch, repository } = opening;
    const { line, station } = chatPullRequestPlacement(
      lines,
      repository,
      inputs.text('line'),
    );
    const changed = await this.pullRequests.changedOn(
      chat.workspaceId,
      repository,
      branch.value,
      opening.base?.value ?? null,
    );

    if (changed.length === 0) {
      throw new InvalidChatTransitionError(
        `Branch ${branch.value} has no changes from ${opening.base ? `branch ${opening.base.value}` : 'the default branch'} of ${repository.value}. Commit the change on its own branch, push it, then open the pull request.`,
      );
    }

    const draft = Task.openedInChat({
      line,
      at: station.id,
      title: TaskTitle.of(opening.title.value),
      description: opening.body ? TaskDescription.of(opening.body) : null,
      branch,
      base: opening.base,
      defaultBranch: opening.defaultBranch,
      rank: Placement.entering(
        'opened',
        (await this.placements.placementsAt(station.id)).map(
          (each) => each.rank,
        ),
      ),
      by: chat.startedBy,
      members: (await this.access.membersOf(line.teamId)) ?? TeamMembers.of([]),
      chat: chat.id,
      hold: HoldId.of(this.ids.generate()),
      now: this.clock.now(),
      newId: () => this.ids.generate(),
    });

    await this.openingHook.allowsNew({
      task: draft,
      repository,
      title: opening.title.value,
      changed,
    });

    const url = await this.opened(opening);

    try {
      return {
        task: await this.createTask.create({
          task: draft.recordChatPullRequest(
            chat.id,
            url,
            this.clock.now(),
            line,
          ),
          line,
        }),
        url,
      };
    } catch (error) {
      const raced = await this.tasks.onBranch(chat.workspaceId, branch);

      if (!raced) {
        throw error;
      }

      return this.onTaskOf(opening, lines, raced);
    }
  }

  private async opened(opening: Opening): Promise<PullRequestUrl> {
    const opened = await this.pullRequests.open({
      workspaceId: opening.chat.workspaceId,
      repository: opening.repository,
      branch: opening.branch.value,
      base: opening.base?.value ?? null,
      title: opening.title.value,
      body: opening.body,
    });

    return PullRequestUrl.of(opened.url);
  }

  private async found(chatId: ChatId): Promise<Chat> {
    const chat = await this.chats.find(chatId);

    if (!chat) {
      throw new UnknownChatError(chatId.value);
    }

    return chat;
  }

  private async taskFound(taskId: TaskId): Promise<Task> {
    const task = await this.tasks.find(taskId);

    if (!task) {
      throw new UnknownTaskError(taskId.value);
    }

    return task;
  }
}
