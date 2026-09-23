import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { DefinitionDocument } from '@shared-kernel/domain/value-objects/definition-document.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type {
  CompiledLine,
  LineCompilerPort,
} from '@work/application/ports/line-compiler.port';
import { LINES, lineAt } from '@work/application/rendering/line-problems';
import { InvalidLinePlanError } from '@work/domain/exceptions/invalid-line-plan.error';
import type { LinePart } from '@work/domain/services/line-layout';
import { AgentPrompt } from '@work/domain/value-objects/agent-prompt.vo';
import { Effort } from '@work/domain/value-objects/effort.vo';
import { Happening } from '@work/domain/value-objects/happening.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import {
  LinePlan,
  type StationPlan,
} from '@work/domain/value-objects/line-plan.vo';
import { LineRole } from '@work/domain/value-objects/line-role.vo';
import { ReviewPolicy } from '@work/domain/value-objects/review-policy.vo';
import { SkillKey } from '@work/domain/value-objects/skill-key.vo';
import { StationCheck } from '@work/domain/value-objects/station-check.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationDescription } from '@work/domain/value-objects/station-description.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { StationSetup } from '@work/domain/value-objects/station-setup.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import {
  type LineFields,
  lineSchema,
} from '@work/infrastructure/lines/line.schema';

type StationDefinition = LineFields['stations'][number];

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
  const refused = (field: string, error: unknown): Read<StationPlan> => ({
    ok: false,
    problems: [
      ConfigurationProblem.of({
        path,
        at: `stations.${at}.${field}`,
        reason: reasoned(error),
      }),
    ],
  });

  let agentPrompt: AgentPrompt | null = null;

  try {
    agentPrompt = station.prompt?.trim()
      ? AgentPrompt.of(station.prompt)
      : null;
  } catch (error) {
    return refused('prompt', error);
  }

  let check: StationCheck | null = null;

  try {
    check = station.check ? StationCheck.of(station.check) : null;
  } catch (error) {
    return refused('check', error);
  }

  let setup: StationSetup | null = null;

  try {
    setup = station.setup ? StationSetup.of(station.setup) : null;
  } catch (error) {
    return refused('setup', error);
  }

  if (check && station.diffs && !setup) {
    return refused(
      'setup',
      'says how to make the checkout ready before the check runs, and a station that checks its layers needs one',
    );
  }

  return {
    ok: true,
    value: {
      key: StationKey.of(station.key),
      name: StationName.of(station.name),
      kind: station.kind,
      color: station.color
        ? StationColor.of(station.color)
        : StationColor.plain(),
      description: station.description
        ? StationDescription.of(station.description)
        : null,
      harness: station.harness ? HarnessId.of(station.harness) : null,
      model: station.model ? HarnessModel.of(station.model) : null,
      effort: station.effort ? Effort.of(station.effort) : null,
      agentPrompt,
      check,
      setup,
      diffs: station.diffs ?? false,
      decisions: station.decisions ?? false,
      tools: station.tools.map((each) => Tool.of(each)),
      skills: station.skills.map((each) => SkillKey.of(each)),
      passesTo: station.passesTo.map((each) => StationKey.of(each)),
      ends: station.ends,
    },
  };
};

const placed = (definition: LineFields, part: LinePart): string => {
  switch (part.of) {
    case 'station': {
      const at = definition.stations.findIndex(
        (each) => each.key === part.station,
      );

      return at < 0 ? 'stations' : `stations.${at}.${part.field}`;
    }
    case 'reaction':
      return `reactions.${part.place}${part.field ? `.${part.field}` : ''}`;
    default:
      return part.field ?? '';
  }
};

export const compileLine = (held: unknown): CompiledLine => {
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
  const repositories: Repository[] = [];

  for (const [at, named] of definition.repositories.entries()) {
    try {
      repositories.push(Repository.of(named));
    } catch (error) {
      problems.push(
        ConfigurationProblem.of({
          path,
          at: `repositories.${at}`,
          reason: reasoned(error),
        }),
      );
    }
  }

  let reviews: ReviewPolicy | null = null;

  try {
    reviews = definition.reviews ? ReviewPolicy.of(definition.reviews) : null;
  } catch (error) {
    problems.push(
      ConfigurationProblem.of({ path, at: 'reviews', reason: reasoned(error) }),
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

  if (problems.length > 0) {
    return { ok: false, problems };
  }

  try {
    return {
      ok: true,
      line: LinePlan.of({
        key,
        name: LineName.of(definition.name),
        stations,
        reactions: definition.reactions.map((reaction) => ({
          happening: Happening.of(reaction.happening),
          from: reaction.from ? StationKey.of(reaction.from) : null,
          to: StationKey.of(reaction.to),
        })),
        role: definition.role ? LineRole.of(definition.role) : null,
        repositories,
        reviews,
        definition: DefinitionDocument.of(definition),
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
  compile(held: unknown): CompiledLine {
    return compileLine(held);
  }
}
