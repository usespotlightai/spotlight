import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ToolDeclaration } from '@work/application/contracts/tools.contract';
import { recordingRuns } from '@work/application/ports/runs.fake-spec';
import { ResumeTaskRun } from '@work/application/services/resume-task-run.service';
import { TeamIntegrations } from '@work/application/services/team-integrations.service';
import { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import { runOrderOf } from '@work/domain/value-objects/dispatch-order.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { StationConfig } from '@work/domain/value-objects/station-config.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { describe, expect, it } from 'vitest';

const RUN = RunId.of('run_1');
const TEAM = TeamId.of('team_1');
const LINE = { teamId: TEAM } as unknown as LineMap;
const ISSUE = Tool.of('sentry.get-issue');
const LINEAR = Tool.of('linear.get-issue');

const CONFIG = StationConfig.rehydrate(
  {
    prompt: null,
    harness: 'dev',
    model: null,
    effort: null,
    profile: null,
    image: null,
    repositories: [],
    skills: [],
    tools: [],
    decisions: false,
    memories: false,
  },
  'f'.repeat(64),
);

const declared = (tool: Tool): ToolDeclaration => ({
  tool: tool.value,
  integrationName: tool.integration ?? 'sentry',
  description: `Reads with ${tool.value}.`,
  inputs: [],
  approval: null,
  inferredOutput: null,
});

const dispatchedWith = (toolsOnMarks: readonly Tool[]) =>
  Dispatch.ordered({
    id: RUN,
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TEAM,
    subject: {
      kind: 'task',
      taskId: TaskId.of('task_1'),
      revision: TaskRevision.of(0),
      stationId: StationId.of('station_1'),
    },
    configuredAs: CONFIG,
    toolsOnMarks,
    order: runOrderOf(RUN),
    now: new Date('2026-11-14T06:25:00.000Z'),
  });

const resuming = ({
  before = [] as readonly Tool[],
  onMarks = [] as readonly Tool[],
  undescribed = [] as readonly Tool[],
  resumes = true,
  lookupFails = false,
} = {}) => {
  const saved: Dispatch[] = [];
  const asked: string[][] = [];
  const steps: string[] = [];
  const warned: string[] = [];
  let open = false;
  const runs = recordingRuns({
    resume: async () => {
      steps.push(open ? 'resume in transaction' : 'resume');
      return resumes;
    },
  });
  const dispatches: DispatchRepository = {
    find: async () => dispatchedWith(before),
    add: async () => undefined,
    save: async (each) => {
      steps.push(open ? 'save in transaction' : 'save');
      saved.push(each);
    },
  };
  const service = new ResumeTaskRun(
    runs,
    dispatches,
    new TeamIntegrations({
      provided: async (_team, tools) =>
        tools
          .filter((each) => !undescribed.some((tool) => tool.value === each))
          .map((each) => declared(Tool.of(each))),
      toolsOnMarks: async (_team, kinds) => {
        if (lookupFails) {
          throw new Error('Integrations unavailable');
        }
        asked.push([...kinds]);
        return [...onMarks, ...undescribed].map((each) => each.value);
      },
    }),
    {
      inTransaction: async (work) => {
        open = true;
        try {
          return await work();
        } finally {
          open = false;
        }
      },
    },
    {
      debug: () => undefined,
      info: () => undefined,
      warn: (_fields, message) => {
        warned.push(message);
      },
      error: () => undefined,
    },
  );
  const task = {
    id: TaskId.of('task_1'),
    marks: [Mark.of('sentry.issue', '158744890')],
  } as unknown as Task;
  const resume = (line: LineMap | null = LINE) =>
    service.resume({
      task,
      line,
      runId: RUN,
      attempt: 1,
      because: 'answered',
      checkouts: [],
    });

  return { resume, runs, saved, asked, steps, warned };
};

describe('ResumeTaskRun', () => {
  it('gives a resumed run the tools its task’s marks enable now, and takes away the ones they no longer do', async () => {
    const { resume, runs, saved, asked } = resuming({
      before: [LINEAR],
      onMarks: [ISSUE],
    });

    await resume();

    expect(asked).toEqual([['sentry.issue']]);
    expect(runs.resume).toHaveBeenCalledWith(RUN, 1, 'answered', [], {
      removed: ['linear.get-issue'],
      added: [
        expect.objectContaining({
          name: 'sentry.get-issue',
          description: 'Reads with sentry.get-issue.',
        }),
      ],
    });
    expect(saved.map((each) => each.toolsOnMarks)).toEqual([[ISSUE]]);
  });

  it('resumes the run and records its new tools in one transaction', async () => {
    const { resume, steps } = resuming({ onMarks: [ISSUE] });

    await resume();

    expect(steps).toEqual(['resume in transaction', 'save in transaction']);
  });

  it('records only the tools it can describe to the agent, so a tool described later is given then', async () => {
    const { resume, runs, saved } = resuming({
      onMarks: [ISSUE],
      undescribed: [LINEAR],
    });

    await resume();

    expect(runs.resume).toHaveBeenCalledWith(RUN, 1, 'answered', [], {
      removed: [],
      added: [expect.objectContaining({ name: 'sentry.get-issue' })],
    });
    expect(saved.map((each) => each.toolsOnMarks)).toEqual([[ISSUE]]);
  });

  it('still resumes, with the tools the run had, when the tools on its marks cannot be read', async () => {
    const { resume, runs, saved, warned } = resuming({
      before: [LINEAR],
      lookupFails: true,
    });

    await resume();

    expect(runs.resume).toHaveBeenCalledWith(RUN, 1, 'answered', [], {
      removed: [],
      added: [],
    });
    expect(saved).toEqual([]);
    expect(warned).toHaveLength(1);
  });

  it('changes no tools, and keeps the dispatch, when the marks enable what the run has', async () => {
    const { resume, runs, saved } = resuming({
      before: [ISSUE],
      onMarks: [ISSUE],
    });

    await resume();

    expect(runs.resume).toHaveBeenCalledWith(RUN, 1, 'answered', [], {
      removed: [],
      added: [],
    });
    expect(saved).toEqual([]);
  });

  it('keeps the dispatch as it was when the run did not resume', async () => {
    const { resume, saved } = resuming({ onMarks: [ISSUE], resumes: false });

    await resume();

    expect(saved).toEqual([]);
  });

  it('resumes without a tool change when the task’s station is on no line', async () => {
    const { resume, runs, asked } = resuming({ onMarks: [ISSUE] });

    await resume(null);

    expect(asked).toEqual([]);
    expect(runs.resume).toHaveBeenCalledWith(RUN, 1, 'answered', [], {
      removed: [],
      added: [],
    });
  });
});
