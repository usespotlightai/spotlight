import type { PullRequestPort } from '@github/application/ports/pull-request.port';
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

interface Opening {
  readonly chat: Chat;
  readonly runId: RunId;
  readonly repository: Repository;
  readonly branch: Branch;
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
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async call(
    { runId, chatId }: ChatToolContext,
    inputs: ToolInputs,
  ): Promise<unknown> {
    const chat = await this.found(chatId);
    const opening: Opening = {
      chat,
      runId,
      repository: chat.mayOpenPullRequestFrom(runId, inputs.text('repository')),
      branch: Branch.of(inputs.requiredText(this.tool, 'branch')),
      title: PullRequestTitle.of(inputs.requiredText(this.tool, 'title')),
      body: inputs.text('body')?.trim() ?? '',
    };
    const lines = await this.lines.ofTeam(chat.teamId);
    const onBranch = await this.tasks.onBranch(
      chat.workspaceId,
      opening.branch,
    );
    const { line, task, created } = onBranch
      ? { ...this.reused(opening, lines, onBranch), created: false }
      : await this.created(opening, lines, inputs);
    const url =
      task.pullRequestIn(opening.repository) ??
      (await this.opened(opening, line, task, created));

    await this.transaction.inTransaction(async () => {
      await this.chats.save(
        (await this.found(chatId)).openedPullRequest({
          runId,
          title: opening.title.value,
          pullRequest: ChatPullRequest.of({ task: task.id, url }),
          at: this.clock.now(),
        }),
      );
    });

    return { url: url.value, task: task.id.value, next: NEXT };
  }

  private reused(
    opening: Opening,
    lines: readonly LineMap[],
    task: Task,
  ): { line: LineMap; task: Task } {
    const { chat, branch, repository } = opening;
    const line = lines.find((each) => each.stationAt(task.stationId));

    if (!line || !task.wasHeldFor(chat.id)) {
      throw new InvalidChatTransitionError(
        `Branch ${branch.value} belongs to another task. Push the change to a new branch.`,
      );
    }

    if (task.pullRequestIn(repository)) {
      return { line, task };
    }

    if (!task.heldFor(chat.id)) {
      throw new InvalidChatTransitionError(
        `The task of branch ${branch.value} ${task.finished ? 'is completed' : 'was handed to the line'}. Push the change to a new branch.`,
      );
    }

    if (!line.names(repository)) {
      throw new InvalidChatTransitionError(
        `The task of branch ${branch.value} is on ${line.name.value}, which does not work on ${repository.value}. Push the change in ${repository.value} to a branch with another name.`,
      );
    }

    return { line, task };
  }

  private async created(
    opening: Opening,
    lines: readonly LineMap[],
    inputs: ToolInputs,
  ): Promise<{ line: LineMap; task: Task; created: boolean }> {
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
    );

    if (changed.length === 0) {
      throw new InvalidChatTransitionError(
        `Branch ${branch.value} has no changes from the default branch of ${repository.value}. Commit the change on its own branch, push it, then open the pull request.`,
      );
    }

    const now = this.clock.now();
    const opened = Task.openedInChat({
      line,
      at: station.id,
      title: TaskTitle.of(opening.title.value),
      description: opening.body ? TaskDescription.of(opening.body) : null,
      branch,
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
      now,
      newId: () => this.ids.generate(),
    });

    try {
      return {
        line,
        task: await this.createTask.create({ task: opened, line }),
        created: true,
      };
    } catch (error) {
      const raced = await this.tasks.onBranch(chat.workspaceId, branch);

      if (!raced) {
        throw error;
      }

      return { ...this.reused(opening, lines, raced), created: false };
    }
  }

  private async opened(
    opening: Opening,
    line: LineMap,
    task: Task,
    created: boolean,
  ): Promise<PullRequestUrl> {
    let url: PullRequestUrl;

    try {
      await this.openingHook.allows({
        task,
        runId: null,
        repository: opening.repository,
        title: opening.title.value,
      });

      url = PullRequestUrl.of(
        (
          await this.pullRequests.open({
            workspaceId: opening.chat.workspaceId,
            repository: opening.repository,
            branch: opening.branch.value,
            title: opening.title.value,
            body: opening.body,
          })
        ).url,
      );
    } catch (error) {
      if (created) {
        await this.removed(task.id);
      }

      throw error;
    }

    await this.transaction.inTransaction(async () => {
      await this.tasks.save(
        (await this.taskFound(task.id)).recordChatPullRequest(
          opening.chat.id,
          url,
          this.clock.now(),
          line,
        ),
      );
    });

    return url;
  }

  private async removed(taskId: TaskId): Promise<void> {
    await this.transaction.inTransaction(async () => {
      const task = await this.tasks.find(taskId);

      if (task && task.pullRequests.length === 0) {
        await this.tasks.remove(task.deleted());
      }
    });
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
