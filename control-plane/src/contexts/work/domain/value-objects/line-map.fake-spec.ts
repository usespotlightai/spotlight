import { createHash } from 'node:crypto';

import type { Effort } from '@shared-kernel/domain/value-objects/effort.vo';
import { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { LineRole } from '@shared-kernel/domain/value-objects/line-role.vo';
import type { ProfileKey } from '@shared-kernel/domain/value-objects/profile-key.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { JudgeSettings } from '@work/domain/value-objects/judge-settings.vo';
import { LineMap } from '@work/domain/value-objects/line-map.vo';
import { LineRepositories } from '@work/domain/value-objects/line-repositories.vo';
import { Reaction } from '@work/domain/value-objects/reaction.vo';
import {
  ReviewIntake,
  type ReviewSkips,
  type ReviewStart,
} from '@work/domain/value-objects/review-intake.vo';
import {
  Station,
  type StationInput,
  type StationKind,
} from '@work/domain/value-objects/station.vo';

export interface RoutesSpec {
  readonly stations: readonly StationId[];
  readonly ends: boolean;
}

export const routesOf = (input: {
  stations?: readonly StationId[];
  ends?: boolean;
}): RoutesSpec => ({
  stations: [...(input.stations ?? [])],
  ends: input.ends ?? false,
});

export const stationOf = (input: {
  id: StationId;
  key: StationKey;
  name: StationName;
  position: number;
  kind?: StationKind;
  color?: string;
  description?: string | null;
  routes?: RoutesSpec;
  harness?: HarnessId | null;
  model?: HarnessModel | null;
  effort?: Effort | null;
  profile?: ProfileKey | null;
  agentPrompt?: string | null;
  check?: string | null;
  placement?: RunnerPlacement;
  diffs?: boolean;
  decisions?: boolean;
  memories?: boolean;
  judge?: JudgeSettings | null;
  tools?: readonly Tool[];
  skills?: readonly SkillKey[];
}): Station =>
  Station.of({
    ...input,
    kind: input.kind ?? 'work',
    passesTo: input.routes?.stations ?? [],
    ends: input.routes?.ends ?? false,
  });

export const judgeOf = (input: {
  rubric?: string | null;
  claims?: readonly string[] | null;
  passThreshold?: number | null;
  sample: number;
  minAgreement: number;
}): JudgeSettings =>
  JudgeSettings.of({
    rubric: input.rubric ?? null,
    claims: input.claims ?? [],
    passThreshold: input.passThreshold ?? 1,
    rubricVersion: createHash('sha256')
      .update(
        JSON.stringify({
          rubric: input.rubric ?? null,
          claims: input.claims ?? [],
          passThreshold: input.passThreshold ?? 1,
        }),
      )
      .digest('hex'),
    sample: input.sample,
    minAgreement: input.minAgreement,
  });

export interface RepositorySpec {
  readonly repository: Repository;
  readonly setup: string | null;
  readonly image: RunnerImage | null;
}

export const repositoryOf = (
  repository: Repository,
  config: { setup?: string | null; image?: RunnerImage | null } = {},
): RepositorySpec => ({
  repository,
  setup: config.setup ?? null,
  image: config.image ?? null,
});

export const reviewsOf = (
  input: {
    start?: ReviewStart;
    mention?: string;
    label?: string;
    skip?: Partial<ReviewSkips>;
  } = {},
): ReviewIntake =>
  ReviewIntake.of({
    start: input.start ?? 'mentioned',
    mention: input.mention ?? '@spotlight',
    label: input.label ?? 'spotlight',
    skip: {
      spotlight: input.skip?.spotlight ?? true,
      drafts: input.skip?.drafts ?? true,
      authors: [...(input.skip?.authors ?? [])],
    },
  });

export const lineMapOf = (input: {
  id: LineId;
  workspaceId: WorkspaceId;
  teamId: TeamId;
  key: LineKey;
  name: LineName;
  stations: readonly Station[];
  reactions?: readonly Reaction[];
  role?: LineRole | null;
  repositories?: readonly RepositorySpec[];
  reviews?: ReviewIntake | null;
  placement?: RunnerPlacement;
  version?: number;
}): LineMap =>
  LineMap.of({
    ...input,
    repositories: LineRepositories.of(
      input.repositories ?? [],
      input.repositories?.find((each) => each.image)?.image ?? null,
    ),
  });

export type StationSpec = Parameters<typeof stationOf>[0];

export const stationWith = (
  station: Station,
  part: Partial<StationInput>,
): Station =>
  Station.of({
    id: station.id,
    key: station.key,
    name: station.name,
    kind: station.kind,
    position: station.position,
    description: station.description,
    passesTo: station.passesTo,
    ends: station.ends,
    harness: station.harness,
    model: station.model,
    effort: station.effort,
    profile: station.profile,
    agentPrompt: station.agentPrompt,
    check: station.check,
    placement: station.placement,
    diffs: station.diffs,
    decisions: station.decisions,
    memories: station.memories,
    judge: station.judge,
    tools: station.tools,
    skills: station.skills,
    ...part,
  });

interface MappedStation {
  readonly key: string;
  readonly name: string;
  readonly kind?: StationKind;
  readonly passesTo?: readonly string[];
  readonly ends?: boolean;
  readonly tools?: readonly string[];
  readonly diffs?: boolean;
  readonly decisions?: boolean;
}

const mapped = (input: {
  key: string;
  name: string;
  role: string;
  stations: readonly MappedStation[];
  reactions: readonly { happening: string; to: string }[];
  harness: HarnessId | null;
  newId: () => string;
  workspaceId: WorkspaceId;
  teamId: TeamId;
  reviews?: ReviewIntake | null;
  repositories?: readonly RepositorySpec[];
  defaultAssignee?: string | null;
}): LineMap => {
  const ids = new Map(
    input.stations.map((each) => [each.key, StationId.of(input.newId())]),
  );
  const idOf = (key: string): StationId => ids.get(key) as StationId;

  return LineMap.of({
    id: LineId.of(input.newId()),
    workspaceId: input.workspaceId,
    teamId: input.teamId,
    key: LineKey.of(input.key),
    name: LineName.of(input.name),
    role: LineRole.of(input.role),
    welcomesTeams: input.key === 'delivery',
    reviews: input.reviews ?? null,
    repositories: LineRepositories.of(input.repositories ?? [], null),
    defaultAssignee: input.defaultAssignee ?? null,
    stations: input.stations.map((each, position) =>
      Station.of({
        id: idOf(each.key),
        key: StationKey.of(each.key),
        name: StationName.of(each.name),
        kind: each.kind ?? 'work',
        position,
        passesTo: (each.passesTo ?? []).map(idOf),
        ends: each.ends ?? false,
        harness: (each.kind ?? 'work') === 'work' ? input.harness : null,
        diffs: each.diffs ?? false,
        decisions: each.decisions ?? false,
        tools: (each.tools ?? []).map(Tool.of),
      }),
    ),
    reactions: input.reactions.map((each) =>
      Reaction.of({
        happening: Happening.of(each.happening),
        to: idOf(each.to),
      }),
    ),
  });
};

interface BuiltInLineInput {
  workspaceId: WorkspaceId;
  teamId: TeamId;
  newId: () => string;
  key?: string;
  name?: string;
  harness?: HarnessId | null;
  reviews?: ReviewIntake | null;
  repositories?: readonly RepositorySpec[];
  defaultAssignee?: string | null;
}

export const deliveryLineOf = (input: BuiltInLineInput): LineMap =>
  mapped({
    ...input,
    harness: input.harness ?? null,
    key: input.key ?? 'delivery',
    name: input.name ?? 'Delivery',
    role: 'delivery',
    stations: [
      {
        key: 'backlog',
        name: 'Backlog',
        kind: 'backlog',
        passesTo: ['triage'],
      },
      { key: 'triage', name: 'Triage', passesTo: ['spec', 'implementation'] },
      { key: 'spec', name: 'Spec', passesTo: ['implementation'] },
      {
        key: 'implementation',
        name: 'Implementation',
        passesTo: ['code-review', 'spec'],
        decisions: true,
        tools: ['checks'],
      },
      {
        key: 'code-review',
        name: 'Code Review',
        passesTo: ['spec', 'implementation'],
        ends: true,
        tools: ['pull-request'],
      },
      { key: 'completed', name: 'Completed', kind: 'completed' },
    ],
    reactions: [
      { happening: 'github.checks.failed', to: 'implementation' },
      { happening: 'github.pull_request.commented', to: 'code-review' },
      { happening: 'github.pull_request.changes-requested', to: 'code-review' },
      { happening: 'github.pull_request.merged', to: 'completed' },
    ],
  });

export const reviewLineOf = (input: BuiltInLineInput): LineMap =>
  mapped({
    ...input,
    harness: input.harness ?? null,
    reviews: input.reviews === undefined ? reviewsOf() : input.reviews,
    key: input.key ?? 'review',
    name: input.name ?? 'Review',
    role: 'review',
    stations: [
      {
        key: 'backlog',
        name: 'Backlog',
        kind: 'backlog',
        passesTo: ['code-review'],
      },
      {
        key: 'code-review',
        name: 'Review',
        ends: true,
        diffs: true,
        tools: ['review-comment', 'review'],
      },
      { key: 'completed', name: 'Completed', kind: 'completed' },
    ],
    reactions: [
      { happening: 'github.pull_request.mentioned', to: 'code-review' },
      { happening: 'github.pull_request.labelled', to: 'code-review' },
      { happening: 'github.pull_request.merged', to: 'completed' },
      { happening: 'github.pull_request.closed-unmerged', to: 'completed' },
    ],
  });
