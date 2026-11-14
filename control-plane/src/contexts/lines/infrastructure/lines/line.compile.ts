import type {
  LineCompilerPort,
  ParsedLine,
} from '@lines/application/ports/line-compiler.port';
import {
  LINE_DEFINITIONS,
  lineAt,
} from '@lines/application/rendering/line-problems';
import { InvalidConfigSourceError } from '@lines/domain/exceptions/invalid-config-source.error';
import { InvalidLinePlanError } from '@lines/domain/exceptions/invalid-line-plan.error';
import { InvalidReplayCheckPolicyError } from '@lines/domain/exceptions/invalid-replay-check-policy.error';
import { InvalidSearchPolicyError } from '@lines/domain/exceptions/invalid-search-policy.error';
import { InvalidStationAlertError } from '@lines/domain/exceptions/invalid-station-alert.error';
import { InvalidStationJudgeError } from '@lines/domain/exceptions/invalid-station-judge.error';
import { AgentPrompt } from '@lines/domain/value-objects/agent-prompt.vo';
import { ConfigSource } from '@lines/domain/value-objects/config-source.vo';
import { DefaultAssignee } from '@lines/domain/value-objects/default-assignee.vo';
import {
  LinePlan,
  type StationPlan,
} from '@lines/domain/value-objects/line-plan.vo';
import { LineRepositoryConfig } from '@lines/domain/value-objects/line-repository-config.vo';
import type { PlanFlaw } from '@lines/domain/value-objects/plan-flaw';
import { ReplayCheckPolicy } from '@lines/domain/value-objects/replay-check-policy.vo';
import { RepositorySetup } from '@lines/domain/value-objects/repository-setup.vo';
import { ReviewPolicy } from '@lines/domain/value-objects/review-policy.vo';
import {
  LineSearchPolicy,
  SearchAgent,
  StationSearchOverride,
} from '@lines/domain/value-objects/search-policy.vo';
import { StationAlert } from '@lines/domain/value-objects/station-alert.vo';
import { StationCheck } from '@lines/domain/value-objects/station-check.vo';
import { StationColor } from '@lines/domain/value-objects/station-color.vo';
import { StationDescription } from '@lines/domain/value-objects/station-description.vo';
import { StationJudge } from '@lines/domain/value-objects/station-judge.vo';
import { WarmSandboxCount } from '@lines/domain/value-objects/warm-sandbox-count.vo';
import { refusalOf } from '@lines/infrastructure/lines/definition-errors';
import {
  type LineFields,
  lineSchema,
} from '@lines/infrastructure/lines/line-definition.schema';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { Effort } from '@shared-kernel/domain/value-objects/effort.vo';
import {
  FieldPath,
  type FieldSegment,
} from '@shared-kernel/domain/value-objects/field-path.vo';
import { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { LineRole } from '@shared-kernel/domain/value-objects/line-role.vo';
import { ProfileKey } from '@shared-kernel/domain/value-objects/profile-key.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';

type StationDefinition = LineFields['stations'][number];

type RepositoryDefinition = LineFields['repositories'][number];

type Read<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

const reasoned = (error: unknown): string => refusalOf(error).message;

const addressOf = (input: unknown): string => {
  const key =
    typeof input === 'object' && input !== null && 'key' in input
      ? input.key
      : null;

  try {
    return typeof key === 'string'
      ? lineAt(LineKey.of(key).value)
      : LINE_DEFINITIONS;
  } catch (error) {
    refusalOf(error);
    return LINE_DEFINITIONS;
  }
};

interface WrittenAgent {
  readonly harness?: string;
  readonly model?: string;
  readonly effort?: string;
}

type AgentChoice =
  | {
      readonly ok: true;
      readonly harness: HarnessId | null;
      readonly model: HarnessModel | null;
      readonly effort: Effort | null;
    }
  | { readonly ok: false; readonly field: string; readonly error: unknown };

const compileAgentChoice = (written: WrittenAgent): AgentChoice => {
  let harness: HarnessId | null = null;

  try {
    harness =
      written.harness === undefined ? null : HarnessId.of(written.harness);
  } catch (error) {
    return { ok: false, field: 'harness', error };
  }

  let model: HarnessModel | null = null;

  try {
    model = written.model === undefined ? null : HarnessModel.of(written.model);
  } catch (error) {
    return { ok: false, field: 'model', error };
  }

  let effort: Effort | null = null;

  try {
    effort = written.effort === undefined ? null : Effort.of(written.effort);
  } catch (error) {
    return { ok: false, field: 'effort', error };
  }

  return { ok: true, harness, model, effort };
};

const compileStation = (
  path: string,
  at: number,
  station: StationDefinition,
): Read<StationPlan> => {
  const invalid = (
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
    return invalid(['prompt'], error);
  }

  let check: StationCheck | null = null;

  try {
    check = station.check ? StationCheck.of(station.check) : null;
  } catch (error) {
    return invalid(['check'], error);
  }

  let name: StationName;

  try {
    name = StationName.of(station.name);
  } catch (error) {
    return invalid(['name'], error);
  }

  let description: StationDescription | null = null;

  try {
    description = station.description
      ? StationDescription.of(station.description)
      : null;
  } catch (error) {
    return invalid(['description'], error);
  }

  const agent = compileAgentChoice(station);

  if (!agent.ok) {
    return invalid([agent.field], agent.error);
  }

  const { harness, model, effort } = agent;

  let placement = RunnerPlacement.anywhere();

  try {
    placement = RunnerPlacement.of(station.runners ?? []);
  } catch (error) {
    return invalid(['runners'], error);
  }

  let judge: StationJudge | null = null;

  try {
    judge = station.judge ? StationJudge.of(station.judge) : null;
  } catch (error) {
    return invalid(
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
      return invalid(
        error instanceof InvalidStationAlertError && error.field
          ? ['alerts', place, error.field]
          : ['alerts', place],
        error,
      );
    }
  }

  let search: StationSearchOverride | null = null;

  if (station.search) {
    const { agent, ...rest } = station.search;
    const chosen = agent ? compileAgentChoice(agent) : null;

    if (chosen && !chosen.ok) {
      return invalid(['search', 'agent', chosen.field], chosen.error);
    }

    try {
      search = StationSearchOverride.of({
        ...rest,
        agent: chosen?.harness
          ? SearchAgent.of({
              harness: chosen.harness,
              model: chosen.model,
              effort: chosen.effort,
            })
          : null,
      });
    } catch (error) {
      return invalid(
        error instanceof InvalidSearchPolicyError
          ? ['search', error.field]
          : ['search'],
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
      search,
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
): Read<LineRepositoryConfig> => {
  const invalid = (
    field: string,
    error: unknown,
  ): Read<LineRepositoryConfig> => ({
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
    return invalid('name', error);
  }

  let image: RunnerImage | null = null;

  try {
    image = repository.image ? RunnerImage.of(repository.image) : null;
  } catch (error) {
    return invalid('image', error);
  }

  let setup: RepositorySetup | null = null;

  try {
    setup = repository.setup ? RepositorySetup.of(repository.setup) : null;
  } catch (error) {
    return invalid('setup', error);
  }

  return { ok: true, value: LineRepositoryConfig.of(named, { image, setup }) };
};

const STATION_FIELDS: Readonly<
  Record<Extract<PlanFlaw, { in: 'station' }>['rule'], string>
> = {
  routes: 'passesTo',
  tools: 'tools',
  skills: 'skills',
  judge: 'judge',
  alerts: 'alerts',
  search: 'search',
  harness: 'harness',
  model: 'model',
  effort: 'effort',
  profile: 'profile',
  prompt: 'prompt',
  check: 'check',
  runners: 'runners',
  diffs: 'diffs',
  decisions: 'decisions',
  memories: 'memories',
};

const REACTION_FIELDS: Readonly<
  Record<Extract<PlanFlaw, { in: 'reaction' }>['rule'], readonly string[]>
> = {
  destination: ['to'],
  origin: ['from'],
  claim: [],
};

const sameRepository = (written: string, repository: Repository): boolean => {
  try {
    return Repository.of(written).equals(repository);
  } catch (error) {
    refusalOf(error);
    return false;
  }
};

const placed = (definition: LineFields, flaw: PlanFlaw): FieldPath => {
  switch (flaw.in) {
    case 'station': {
      const at = definition.stations.findIndex(
        (each) => each.key === flaw.station.value,
      );

      return FieldPath.of(
        at < 0
          ? ['stations']
          : [
              'stations',
              at,
              STATION_FIELDS[flaw.rule],
              ...(flaw.setting ? [flaw.setting] : []),
            ],
      );
    }
    case 'repository': {
      const at = definition.repositories.findIndex((each) =>
        sameRepository(each.name, flaw.repository),
      );

      return FieldPath.of(
        at < 0 ? ['repositories'] : ['repositories', at, flaw.rule],
      );
    }
    case 'reaction':
      return FieldPath.of([
        'reactions',
        flaw.reaction,
        ...REACTION_FIELDS[flaw.rule],
      ]);
    case 'line':
      return FieldPath.of(flaw.rule ? [flaw.rule] : []);
  }
};

export const compileLine = (input: unknown): ParsedLine => {
  const read = lineSchema.safeParse(input);

  if (!read.success) {
    const path = addressOf(input);

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
  const repositories: LineRepositoryConfig[] = [];
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
      ? ReplayCheckPolicy.withDefaults(definition.replayCheck)
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

  let search: LineSearchPolicy | null = null;

  try {
    search = definition.search ? LineSearchPolicy.of(definition.search) : null;
  } catch (error) {
    problems.push(
      ConfigurationProblem.of({
        path,
        at: FieldPath.of(
          error instanceof InvalidSearchPolicyError
            ? ['search', error.field]
            : ['search'],
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

  let warmSandboxes = WarmSandboxCount.NONE;

  try {
    warmSandboxes = WarmSandboxCount.of(definition.warmSandboxes ?? 0);
  } catch (error) {
    problems.push(
      ConfigurationProblem.of({
        path,
        at: FieldPath.of(['warmSandboxes']),
        reason: reasoned(error),
      }),
    );
  }

  let defaultAssignee: DefaultAssignee | null = null;

  try {
    defaultAssignee =
      definition.defaultAssignee === undefined
        ? null
        : DefaultAssignee.of(definition.defaultAssignee);
  } catch (error) {
    problems.push(
      ConfigurationProblem.of({
        path,
        at: FieldPath.of(['defaultAssignee']),
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
        warmSandboxes,
        defaultAssignee,
        replayCheck,
        search,
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
              ? error.flaw
              : { in: 'line', rule: null },
          ),
          reason: reasoned(error),
        }),
      ],
    };
  }
};

export class LineCompiler implements LineCompilerPort {
  compile(input: unknown): ParsedLine {
    return compileLine(input);
  }
}
