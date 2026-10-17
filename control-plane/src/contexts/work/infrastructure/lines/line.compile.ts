import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import {
  FieldPath,
  type FieldSegment,
} from '@shared-kernel/domain/value-objects/field-path.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type {
  LineCompilerPort,
  ParsedLine,
} from '@work/application/ports/line-compiler.port';
import { LINES, lineAt } from '@work/application/rendering/line-problems';
import { InvalidConfigSourceError } from '@work/domain/exceptions/invalid-config-source.error';
import { InvalidLinePlanError } from '@work/domain/exceptions/invalid-line-plan.error';
import { InvalidReplayCheckPolicyError } from '@work/domain/exceptions/invalid-replay-check-policy.error';
import { InvalidStationAlertError } from '@work/domain/exceptions/invalid-station-alert.error';
import { InvalidStationJudgeError } from '@work/domain/exceptions/invalid-station-judge.error';
import type { LinePart } from '@work/domain/services/line-layout';
import { AgentPrompt } from '@work/domain/value-objects/agent-prompt.vo';
import { ConfigSource } from '@work/domain/value-objects/config-source.vo';
import { Effort } from '@work/domain/value-objects/effort.vo';
import { Happening } from '@work/domain/value-objects/happening.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import {
  LinePlan,
  type StationPlan,
} from '@work/domain/value-objects/line-plan.vo';
import { LineRole } from '@work/domain/value-objects/line-role.vo';
import { ProfileKey } from '@work/domain/value-objects/profile-key.vo';
import { ReplayCheckPolicy } from '@work/domain/value-objects/replay-check-policy.vo';
import { RepositorySetup } from '@work/domain/value-objects/repository-setup.vo';
import { ReviewPolicy } from '@work/domain/value-objects/review-policy.vo';
import { SkillKey } from '@work/domain/value-objects/skill-key.vo';
import { StationAlert } from '@work/domain/value-objects/station-alert.vo';
import { StationCheck } from '@work/domain/value-objects/station-check.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationDescription } from '@work/domain/value-objects/station-description.vo';
import { StationJudge } from '@work/domain/value-objects/station-judge.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { WorkedRepository } from '@work/domain/value-objects/worked-repository.vo';
import {
  type LineFields,
  lineSchema,
} from '@work/infrastructure/lines/line.schema';

type StationDefinition = LineFields['stations'][number];

type RepositoryDefinition = LineFields['repositories'][number];

type Read<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

const reasoned = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const addressOf = (held: unknown): string => {
  const key =
    typeof held === 'object' && held !== null && 'key' in held
      ? held.key
      : null;

  try {
    return typeof key === 'string' ? lineAt(LineKey.of(key).value) : LINES;
  } catch {
    return LINES;
  }
};

const compileStation = (
  path: string,
  at: number,
  station: StationDefinition,
): Read<StationPlan> => {
  const refused = (
    within: readonly FieldSegment[],
    error: unknown,
  ): Read<StationPlan> => ({
    ok: false,
    problems: [
      ConfigurationProblem.of({
        path,
        at: FieldPath.of(['stations', at, ...within]),
        reason: reasoned(error),
      }),
    ],
  });

  let agentPrompt: AgentPrompt | null = null;

  try {
    agentPrompt = station.prompt ? AgentPrompt.of(station.prompt) : null;
  } catch (error) {
    return refused(['prompt'], error);
  }

  let check: StationCheck | null = null;

  try {
    check = station.check ? StationCheck.of(station.check) : null;
  } catch (error) {
    return refused(['check'], error);
  }

  let name: StationName;

  try {
    name = StationName.of(station.name);
  } catch (error) {
    return refused(['name'], error);
  }

  let description: StationDescription | null = null;

  try {
    description = station.description
      ? StationDescription.of(station.description)
      : null;
  } catch (error) {
    return refused(['description'], error);
  }

  let harness: HarnessId | null = null;

  try {
    harness = station.harness ? HarnessId.of(station.harness) : null;
  } catch (error) {
    return refused(['harness'], error);
  }

  let model: HarnessModel | null = null;

  try {
    model = station.model ? HarnessModel.of(station.model) : null;
  } catch (error) {
    return refused(['model'], error);
  }

  let effort: Effort | null = null;

  try {
    effort = station.effort ? Effort.of(station.effort) : null;
  } catch (error) {
    return refused(['effort'], error);
  }

  let placement = RunnerPlacement.anywhere();

  try {
    placement = RunnerPlacement.of(station.runners ?? []);
  } catch (error) {
    return refused(['runners'], error);
  }

  let judge: StationJudge | null = null;

  try {
    judge = station.judge ? StationJudge.of(station.judge) : null;
  } catch (error) {
    return refused(
      error instanceof InvalidStationJudgeError
        ? ['judge', error.field]
        : ['judge'],
      error,
    );
  }

  const alerts: StationAlert[] = [];

  for (const [place, alert] of station.alerts.entries()) {
    try {
      alerts.push(StationAlert.of(alert).alongside(alerts));
    } catch (error) {
      return refused(
        error instanceof InvalidStationAlertError && error.field
          ? ['alerts', place, error.field]
          : ['alerts', place],
        error,
      );
    }
  }

  return {
    ok: true,
    value: {
      key: StationKey.of(station.key),
      name,
      kind: station.kind,
      color: station.color
        ? StationColor.of(station.color)
        : StationColor.plain(),
      description,
      harness,
      model,
      effort,
      profile: station.profile ? ProfileKey.of(station.profile) : null,
      agentPrompt,
      check,
      placement,
      diffs: station.diffs ?? false,
      decisions: station.decisions ?? false,
      memories: station.memories ?? false,
      judge,
      alerts,
      tools: station.tools.map((each) => Tool.of(each)),
      skills: station.skills.map((each) => SkillKey.of(each)),
      passesTo: station.passesTo.map((each) => StationKey.of(each)),
      ends: station.ends,
    },
  };
};

const compileRepository = (
  path: string,
  at: number,
  repository: RepositoryDefinition,
): Read<WorkedRepository> => {
  const refused = (field: string, error: unknown): Read<WorkedRepository> => ({
    ok: false,
    problems: [
      ConfigurationProblem.of({
        path,
        at: FieldPath.of(['repositories', at, field]),
        reason: reasoned(error),
      }),
    ],
  });

  let named: Repository;

  try {
    named = Repository.of(repository.name);
  } catch (error) {
    return refused('name', error);
  }

  let image: RunnerImage | null = null;

  try {
    image = repository.image ? RunnerImage.of(repository.image) : null;
  } catch (error) {
    return refused('image', error);
  }

  let setup: RepositorySetup | null = null;

  try {
    setup = repository.setup ? RepositorySetup.of(repository.setup) : null;
  } catch (error) {
    return refused('setup', error);
  }

  return { ok: true, value: WorkedRepository.of(named, { image, setup }) };
};

const placed = (definition: LineFields, part: LinePart): FieldPath => {
  switch (part.of) {
    case 'station': {
      const at = definition.stations.findIndex(
        (each) => each.key === part.station,
      );

      return FieldPath.of(at < 0 ? ['stations'] : ['stations', at, part.field]);
    }
    case 'repository':
      return FieldPath.of(['repositories', part.place, part.field]);
    case 'reaction':
      return FieldPath.of([
        'reactions',
        part.place,
        ...(part.field ? [part.field] : []),
      ]);
    default:
      return FieldPath.of(part.field ? [part.field] : []);
  }
};

export const compileLine = (held: unknown): ParsedLine => {
  const read = lineSchema.safeParse(held);

  if (!read.success) {
    const path = addressOf(held);

    return {
      ok: false,
      problems: read.error.issues.map((issue) =>
        ConfigurationProblem.of({
          path,
          at: FieldPath.of(issue.path),
          reason: issue.message,
        }),
      ),
    };
  }

  const definition = read.data;
  const key = LineKey.of(definition.key);
  const path = lineAt(key.value);
  const problems: ConfigurationProblem[] = [];
  const repositories: WorkedRepository[] = [];
  let name: LineName | null = null;

  try {
    name = LineName.of(definition.name);
  } catch (error) {
    problems.push(
      ConfigurationProblem.of({
        path,
        at: FieldPath.of(['name']),
        reason: reasoned(error),
      }),
    );
  }

  for (const [at, repository] of definition.repositories.entries()) {
    const compiled = compileRepository(path, at, repository);

    if (compiled.ok) {
      repositories.push(compiled.value);
    } else {
      problems.push(...compiled.problems);
    }
  }

  let reviews: ReviewPolicy | null = null;

  try {
    reviews = definition.reviews ? ReviewPolicy.of(definition.reviews) : null;
  } catch (error) {
    problems.push(
      ConfigurationProblem.of({
        path,
        at: FieldPath.of(['reviews']),
        reason: reasoned(error),
      }),
    );
  }

  let replayCheck: ReplayCheckPolicy | null = null;

  try {
    replayCheck = definition.replayCheck
      ? ReplayCheckPolicy.of(definition.replayCheck)
      : null;
  } catch (error) {
    problems.push(
      ConfigurationProblem.of({
        path,
        at: FieldPath.of(
          error instanceof InvalidReplayCheckPolicyError
            ? ['replayCheck', error.field]
            : ['replayCheck'],
        ),
        reason: reasoned(error),
      }),
    );
  }

  let source: ConfigSource | null = null;

  try {
    source = definition.source ? ConfigSource.of(definition.source) : null;
  } catch (error) {
    problems.push(
      ConfigurationProblem.of({
        path,
        at: FieldPath.of(
          error instanceof InvalidConfigSourceError
            ? ['source', error.field]
            : ['source'],
        ),
        reason: reasoned(error),
      }),
    );
  }

  let placement = RunnerPlacement.anywhere();

  try {
    placement = RunnerPlacement.of(definition.runners ?? []);
  } catch (error) {
    problems.push(
      ConfigurationProblem.of({
        path,
        at: FieldPath.of(['runners']),
        reason: reasoned(error),
      }),
    );
  }

  const stations: StationPlan[] = [];

  for (const [at, station] of definition.stations.entries()) {
    const compiled = compileStation(path, at, station);

    if (compiled.ok) {
      stations.push(compiled.value);
    } else {
      problems.push(...compiled.problems);
    }
  }

  if (!name || problems.length > 0) {
    return { ok: false, problems };
  }

  try {
    return {
      ok: true,
      line: LinePlan.of({
        key,
        name,
        stations,
        reactions: definition.reactions.map((reaction) => ({
          happening: Happening.of(reaction.happening),
          from: reaction.from ? StationKey.of(reaction.from) : null,
          to: StationKey.of(reaction.to),
        })),
        role: definition.role ? LineRole.of(definition.role) : null,
        repositories,
        reviews,
        placement,
        replayCheck,
        source,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      problems: [
        ConfigurationProblem.of({
          path,
          at: placed(
            definition,
            error instanceof InvalidLinePlanError
              ? error.part
              : { of: 'line', field: null },
          ),
          reason: reasoned(error),
        }),
      ],
    };
  }
};

export class LineCompiler implements LineCompilerPort {
  compile(held: unknown): ParsedLine {
    return compileLine(held);
  }
}
