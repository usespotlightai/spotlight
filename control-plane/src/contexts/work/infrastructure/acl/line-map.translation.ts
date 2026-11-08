import { WELCOME_LINE_KEY } from '@lines/application/contracts/built-in-lines.contract';
import type {
  LineView,
  StationView,
} from '@lines/application/contracts/line-view.contract';
import { Effort } from '@shared-kernel/domain/value-objects/effort.vo';
import { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { LineRole } from '@shared-kernel/domain/value-objects/line-role.vo';
import { ProfileKey } from '@shared-kernel/domain/value-objects/profile-key.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { WarmSandboxCount } from '@shared-kernel/domain/value-objects/warm-sandbox-count.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { JudgeSettings } from '@work/domain/value-objects/judge-settings.vo';
import { LineMap } from '@work/domain/value-objects/line-map.vo';
import { LineRepositories } from '@work/domain/value-objects/line-repositories.vo';
import { Reaction } from '@work/domain/value-objects/reaction.vo';
import { ReviewIntake } from '@work/domain/value-objects/review-intake.vo';
import { Station } from '@work/domain/value-objects/station.vo';

const optional = <T>(
  value: string | null,
  made: (value: string) => T,
): T | null => (value === null ? null : made(value));

const stationOf = (view: StationView): Station =>
  Station.of({
    id: StationId.of(view.id),
    key: StationKey.of(view.key),
    name: StationName.of(view.name),
    kind: view.kind,
    position: view.position,
    description: view.description,
    passesTo: view.passesTo.map(StationId.of),
    ends: view.ends,
    harness: optional(view.harness, HarnessId.of),
    model: optional(view.model, HarnessModel.of),
    effort: optional(view.effort, Effort.of),
    profile: optional(view.profile, ProfileKey.of),
    agentPrompt: view.agentPrompt,
    check: view.check,
    placement: RunnerPlacement.of(view.runners),
    diffs: view.diffs,
    decisions: view.decisions,
    memories: view.memories,
    judge: view.judge && JudgeSettings.of(view.judge),
    tools: view.tools.map(Tool.of),
    skills: view.skills.map(SkillKey.of),
  });

export const lineMapOf = (view: LineView): LineMap =>
  LineMap.of({
    id: LineId.of(view.id),
    workspaceId: WorkspaceId.of(view.workspaceId),
    teamId: TeamId.of(view.teamId),
    key: LineKey.of(view.key),
    name: LineName.of(view.name),
    role: optional(view.role, LineRole.of),
    welcomesTeams: view.key === WELCOME_LINE_KEY,
    stations: view.stations.map(stationOf),
    reactions: view.reactions.map((each) =>
      Reaction.of({
        happening: Happening.of(each.happening),
        from: optional(each.from, StationId.of),
        to: StationId.of(each.to),
      }),
    ),
    repositories: LineRepositories.of(
      view.repositories.map((each) => ({
        repository: Repository.of(each.repository),
        setup: each.setup,
      })),
      optional(view.image, RunnerImage.of),
    ),
    reviews: view.reviews && ReviewIntake.of(view.reviews),
    placement: RunnerPlacement.of(view.runners),
    warmSandboxes: WarmSandboxCount.of(view.warmSandboxes),
  });
