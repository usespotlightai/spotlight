import { HookEventFacts } from '@integrations/domain/value-objects/hook-event-facts.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';

type Inputs = Readonly<Record<string, unknown>>;

export const usedTool = (
  tool: string,
  more: { inputs?: Inputs; output?: unknown; failed?: boolean } = {},
): HookEventFacts =>
  HookEventFacts.of({
    on: 'tool.used',
    tool: Tool.of(tool),
    inputs: more.inputs ?? {},
    output: more.output ?? null,
    failed: more.failed ?? false,
  });

export const usingTool = (tool: string, inputs: Inputs = {}): HookEventFacts =>
  HookEventFacts.of({ on: 'tool.using', tool: Tool.of(tool), inputs });

export const runStarting = (): HookEventFacts =>
  HookEventFacts.of({ on: 'run.starting' });

export const runEnded = (outcome = 'completed'): HookEventFacts =>
  HookEventFacts.of({ on: 'run.ended', outcome });

export const pullRequestOpening = (
  changed: readonly string[],
  repository = 'acme/web',
): HookEventFacts =>
  HookEventFacts.of({
    on: 'pull-request.opening',
    repository: Repository.of(repository),
    branch: 'spotlight/change',
    title: 'A change',
    changed,
  });

export const pullRequestMerged = (
  repository = 'acme/web',
  changed: readonly string[] | null = null,
  url = `https://github.com/${repository}/pull/7`,
): HookEventFacts =>
  HookEventFacts.of({
    on: 'pull-request.merged',
    pullRequest: PullRequestUrl.of(url),
    repository: Repository.of(repository),
    mergeCommit: 'abc123',
    changed,
  });

export const taskMoved = (from = 'triage', to = 'build'): HookEventFacts =>
  HookEventFacts.of({ on: 'task.moved', from, to });
