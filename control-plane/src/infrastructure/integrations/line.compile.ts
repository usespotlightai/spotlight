import { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';
import { Happening } from '@domain/value-objects/happening.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { LineKey } from '@domain/value-objects/line-key.vo';
import { LinePlan } from '@domain/value-objects/line-plan.vo';
import { LineRole } from '@domain/value-objects/line-role.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationDescription } from '@domain/value-objects/station-description.vo';
import { StationKey } from '@domain/value-objects/station-key.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { Tool } from '@domain/value-objects/tool.vo';
import { lineSchema } from '@infrastructure/integrations/line.schema';
import { parse as parseYaml } from 'yaml';

export type CompiledLine =
  | { readonly ok: true; readonly line: LinePlan }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

const reasoned = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** The colour a station is painted where the file does not say. */
const PLAIN = '#a3a8b0';

export const compileLine = (path: string, text: string): CompiledLine => {
  let held: unknown;

  try {
    held = parseYaml(text);
  } catch (error) {
    return {
      ok: false,
      problems: [
        ConfigurationProblem.of({
          path,
          at: 'the file',
          reason: `is not YAML: ${reasoned(error)}`,
        }),
      ],
    };
  }

  const read = lineSchema.safeParse(held);

  if (!read.success) {
    return {
      ok: false,
      problems: read.error.issues.map((issue) =>
        ConfigurationProblem.of({
          path,
          at: issue.path.length > 0 ? issue.path.join('.') : 'the file',
          reason: issue.message,
        }),
      ),
    };
  }

  const file = read.data;
  const problems: ConfigurationProblem[] = [];
  const keys = new Set(file.stations.map((each) => each.key));

  // A station named twice would have the second quietly never reached.
  if (keys.size !== file.stations.length) {
    problems.push(
      ConfigurationProblem.of({
        path,
        at: 'stations',
        reason: 'names one station twice, and each is named once',
      }),
    );
  }

  for (const [at, station] of file.stations.entries()) {
    for (const to of station.passesTo) {
      if (!keys.has(to)) {
        problems.push(
          ConfigurationProblem.of({
            path,
            at: `stations.${at}.passesTo`,
            reason: `names ${to}, which is not a station on this line`,
          }),
        );
      }
    }
  }

  for (const [at, reaction] of file.reactions.entries()) {
    for (const [where, named] of [
      ['to', reaction.to],
      ['from', reaction.from],
    ] as const) {
      if (named && !keys.has(named)) {
        problems.push(
          ConfigurationProblem.of({
            path,
            at: `reactions.${at}.${where}`,
            reason: `names ${named}, which is not a station on this line`,
          }),
        );
      }
    }
  }

  const names = new Set<string>();

  for (const [at, named] of file.repositories.entries()) {
    let repository: Repository;

    try {
      repository = Repository.of(named);
    } catch (error) {
      problems.push(
        ConfigurationProblem.of({
          path,
          at: `repositories.${at}`,
          reason: reasoned(error),
        }),
      );
      continue;
    }

    // The name is the directory a repository is cloned into and the key it is
    // reached by, so two sharing one would collide.
    if (names.has(repository.name)) {
      problems.push(
        ConfigurationProblem.of({
          path,
          at: `repositories.${at}`,
          reason: `names ${repository.name} a second time, and each is cloned into a directory of its own name`,
        }),
      );
    }
    names.add(repository.name);
  }

  if (problems.length > 0) {
    return { ok: false, problems };
  }

  // The domain has the last word on whether this is a plan at all. What it
  // refuses comes back as a problem with the file, because that is what it is.
  try {
    return {
      ok: true,
      line: LinePlan.of({
        key: LineKey.of(file.key),
        name: AssemblyLineName.of(file.name),
        stations: file.stations.map((station) => ({
          key: StationKey.of(station.key),
          name: StationName.of(station.name),
          kind: station.kind,
          color: StationColor.of(station.color ?? PLAIN),
          description: station.description
            ? StationDescription.of(station.description)
            : null,
          harness: station.harness ? HarnessId.of(station.harness) : null,
          agentPrompt: station.prompt ? AgentPrompt.of(station.prompt) : null,
          tools: station.tools.map((each) => Tool.of(each)),
          passesTo: station.passesTo.map((each) => StationKey.of(each)),
          ends: station.ends,
        })),
        reactions: file.reactions.map((reaction) => ({
          happening: Happening.of(reaction.happening),
          from: reaction.from ? StationKey.of(reaction.from) : null,
          to: StationKey.of(reaction.to),
        })),
        role: file.role ? LineRole.of(file.role) : null,
        repositories: file.repositories.map((each) => Repository.of(each)),
      }),
    };
  } catch (error) {
    return {
      ok: false,
      problems: [
        ConfigurationProblem.of({
          path,
          at: 'the file',
          reason: reasoned(error),
        }),
      ],
    };
  }
};
