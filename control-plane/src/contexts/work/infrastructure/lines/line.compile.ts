import { splitFrontmatter } from '@platform/markdown/frontmatter';
import type { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import {
  LINE_FILE,
  lineFolder,
  linePath,
  STATIONS_UNDER,
  stationPath,
} from '@work/application/contracts/line-layout.contract';
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
  lineSchema,
  stationSchema,
} from '@work/infrastructure/lines/line.schema';
import { parse as parseYaml } from 'yaml';
import type { z } from 'zod';

export type CompiledLine =
  | {
      readonly ok: true;
      readonly line: LinePlan;
      readonly problems: readonly ConfigurationProblem[];
    }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

type Read<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

const reasoned = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const refused = (path: string, at: string, reason: string) =>
  ConfigurationProblem.of({ path, at, reason });

const unread = (path: string, reason: string) =>
  ConfigurationProblem.of({
    path,
    at: 'the file',
    reason,
    severity: 'warning',
  });

const parsed = <T>(
  path: string,
  held: unknown,
  schema: z.ZodType<T>,
): Read<T> => {
  const read = schema.safeParse(held);

  return read.success
    ? { ok: true, value: read.data }
    : {
        ok: false,
        problems: read.error.issues.map((issue) =>
          refused(
            path,
            issue.path.length > 0 ? issue.path.join('.') : 'the file',
            issue.message,
          ),
        ),
      };
};

const yamlIn = (path: string, text: string, what: string): Read<unknown> => {
  try {
    return { ok: true, value: parseYaml(text) };
  } catch (error) {
    return {
      ok: false,
      problems: [
        refused(path, 'the file', `${what} not YAML: ${reasoned(error)}`),
      ],
    };
  }
};

const compileStation = (
  key: StationKey,
  file: ConfigurationFile,
): Read<StationPlan> => {
  const fronted = splitFrontmatter(file.text);

  if (!fronted) {
    return {
      ok: false,
      problems: [
        refused(
          file.path,
          'the file',
          'opens with no frontmatter: start it with a --- line, the station’s name and how it works, and another --- line, with its prompt below',
        ),
      ],
    };
  }

  const front = yamlIn(file.path, fronted.front, 'has frontmatter that is');

  if (!front.ok) {
    return front;
  }

  const read = parsed(file.path, front.value ?? {}, stationSchema);

  if (!read.ok) {
    return read;
  }

  const station = read.value;
  let agentPrompt: AgentPrompt | null = null;

  try {
    agentPrompt = fronted.body.trim() ? AgentPrompt.of(fronted.body) : null;
  } catch (error) {
    return {
      ok: false,
      problems: [refused(file.path, 'the prompt', reasoned(error))],
    };
  }

  let check: StationCheck | null = null;

  try {
    check = station.check ? StationCheck.of(station.check) : null;
  } catch (error) {
    return {
      ok: false,
      problems: [refused(file.path, 'check', reasoned(error))],
    };
  }

  let setup: StationSetup | null = null;

  try {
    setup = station.setup ? StationSetup.of(station.setup) : null;
  } catch (error) {
    return {
      ok: false,
      problems: [refused(file.path, 'setup', reasoned(error))],
    };
  }

  if (check && station.diffs && !setup) {
    return {
      ok: false,
      problems: [
        refused(
          file.path,
          'setup',
          'says how to make the checkout ready before the check runs, and a station that checks its layers needs one',
        ),
      ],
    };
  }

  return {
    ok: true,
    value: {
      key,
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

const placed = (
  folder: string,
  part: LinePart,
): { readonly path: string; readonly at: string } => {
  switch (part.of) {
    case 'station':
      return { path: stationPath(folder, part.station), at: part.field };
    case 'reaction':
      return {
        path: linePath(folder),
        at: `reactions.${part.place}${part.field ? `.${part.field}` : ''}`,
      };
    default:
      return { path: linePath(folder), at: part.field ?? 'the file' };
  }
};

export const compileLine = (
  folder: string,
  files: readonly ConfigurationFile[],
): CompiledLine => {
  const path = linePath(folder);
  const failed = (problems: readonly ConfigurationProblem[]): CompiledLine => ({
    ok: false,
    problems,
  });

  let key: LineKey;

  try {
    key = LineKey.of(folder);
  } catch (error) {
    return failed([refused(path, 'its folder', reasoned(error))]);
  }

  const main = files.find((each) => each.path === path);

  if (!main) {
    return failed([
      refused(
        path,
        'the file',
        `is missing, and a line is read from the ${LINE_FILE} in its folder`,
      ),
    ]);
  }

  const held = yamlIn(path, main.text, 'is');

  if (!held.ok) {
    return failed(held.problems);
  }

  const read = parsed(path, held.value, lineSchema);

  if (!read.ok) {
    return failed(read.problems);
  }

  const file = read.value;
  const listed = new Set(
    file.stations.map((station) => stationPath(folder, station)),
  );
  const warnings = files
    .filter((each) => each !== main && !listed.has(each.path))
    .map((each) =>
      each.isUnder(`${lineFolder(folder)}/${STATIONS_UNDER}`) &&
      each.path.endsWith('.md')
        ? unread(
            each.path,
            `is not among the stations ${LINE_FILE} lists, so it is not read`,
          )
        : unread(
            each.path,
            `is not read: a line’s folder holds its ${LINE_FILE} and a ${STATIONS_UNDER} folder with one .md file for each station`,
          ),
    );

  const problems: ConfigurationProblem[] = [];
  const repositories: Repository[] = [];

  for (const [at, named] of file.repositories.entries()) {
    try {
      repositories.push(Repository.of(named));
    } catch (error) {
      problems.push(refused(path, `repositories.${at}`, reasoned(error)));
    }
  }

  let reviews: ReviewPolicy | null = null;

  try {
    reviews = file.reviews ? ReviewPolicy.of(file.reviews) : null;
  } catch (error) {
    problems.push(refused(path, 'reviews', reasoned(error)));
  }

  const stations: StationPlan[] = [];

  for (const [at, named] of file.stations.entries()) {
    const written = files.find(
      (each) => each.path === stationPath(folder, named),
    );

    if (!written) {
      problems.push(
        refused(
          path,
          `stations.${at}`,
          `names ${named}, and there is no ${stationPath(folder, named)} to read it from`,
        ),
      );
      continue;
    }

    const station = compileStation(StationKey.of(named), written);

    if (station.ok) {
      stations.push(station.value);
    } else {
      problems.push(...station.problems);
    }
  }

  if (problems.length > 0) {
    return failed([...problems, ...warnings]);
  }

  try {
    return {
      ok: true,
      line: LinePlan.of({
        key,
        name: LineName.of(file.name),
        stations,
        reactions: file.reactions.map((reaction) => ({
          happening: Happening.of(reaction.happening),
          from: reaction.from ? StationKey.of(reaction.from) : null,
          to: StationKey.of(reaction.to),
        })),
        role: file.role ? LineRole.of(file.role) : null,
        repositories,
        reviews,
      }),
      problems: warnings,
    };
  } catch (error) {
    const where = placed(
      folder,
      error instanceof InvalidLinePlanError
        ? error.part
        : { of: 'line', field: null },
    );

    return failed([
      refused(where.path, where.at, reasoned(error)),
      ...warnings,
    ]);
  }
};
