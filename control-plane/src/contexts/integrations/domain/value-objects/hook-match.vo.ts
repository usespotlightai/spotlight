import { InvalidHookError } from '@integrations/domain/exceptions/invalid-hook.error';
import type { HookEventFacts } from '@integrations/domain/value-objects/hook-event-facts.vo';
import type { HookEvent } from '@integrations/domain/value-objects/hook-event.vo';
import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { InvalidRepositoryError } from '@shared-kernel/domain/exceptions/invalid-repository.error';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';

const REGEX_SPECIAL = /[.+^${}()|[\]\\]/g;

interface HookMatchFields {
  readonly tools: readonly ToolName[];
  readonly lines: readonly LineKey[];
  readonly stations: readonly StationKey[];
  readonly repositories: readonly Repository[];
  readonly paths: readonly string[];
}

export interface WrittenHookMatch {
  readonly tools: readonly ToolName[];
  readonly lines: readonly string[];
  readonly stations: readonly string[];
  readonly repositories: readonly string[];
  readonly paths: readonly string[];
}

export interface MatchedTask {
  readonly line: LineKey;
  readonly stationKey: StationKey;
  readonly repositories: readonly Repository[];
}

const at = (...segments: (string | number)[]) =>
  FieldPath.of(['match', ...segments]);

export const pathPattern = (glob: string): RegExp => {
  const whole = glob.endsWith('/') ? `${glob}**` : glob;
  let pattern = '';

  for (let index = 0; index < whole.length; index += 1) {
    const each = whole[index];

    if (each === '*' && whole[index + 1] === '*') {
      pattern += '.*';
      index += 1;
    } else if (each === '*') {
      pattern += '[^/]*';
    } else if (each === '?') {
      pattern += '[^/]';
    } else {
      pattern += each.replace(REGEX_SPECIAL, '\\$&');
    }
  }

  return new RegExp(`^${pattern}$`);
};

const uniqueTools = (tools: readonly ToolName[]): ToolName[] =>
  tools.filter(
    (tool, index) => tools.findIndex((each) => each.equals(tool)) === index,
  );

const readEach = <T>(
  field: 'lines' | 'stations' | 'repositories',
  written: readonly string[],
  read: (raw: string) => T,
  shape: string,
): T[] =>
  written.map((raw, index) => {
    try {
      return read(raw);
    } catch (error) {
      if (
        error instanceof InvalidIdentifierError ||
        error instanceof InvalidRepositoryError
      ) {
        throw new InvalidHookError(at(field, index), shape);
      }
      throw error;
    }
  });

const guarded = (fields: HookMatchFields, event: HookEvent): void => {
  if (fields.tools.length > 0 && !event.aboutTool) {
    throw new InvalidHookError(
      at('tools'),
      `only applies to tool.using and tool.used, not ${event.name}`,
    );
  }

  if (fields.paths.length > 0 && !event.aboutChanges) {
    throw new InvalidHookError(
      at('paths'),
      `only applies to pull-request.opening and pull-request.merged, not ${event.name}`,
    );
  }

  fields.paths.forEach((path, index) => {
    if (path.length === 0) {
      throw new InvalidHookError(
        at('paths', index),
        'is a path pattern, as in db/migrations/**',
      );
    }
  });
};

export class HookMatch {
  private constructor(
    private readonly event: HookEvent,
    private readonly fields: HookMatchFields,
    private readonly patterns: readonly RegExp[],
  ) {}

  static of(fields: HookMatchFields, event: HookEvent): HookMatch {
    guarded(fields, event);

    return new HookMatch(
      event,
      {
        tools: uniqueTools(fields.tools),
        lines: [...fields.lines],
        stations: [...fields.stations],
        repositories: [...fields.repositories],
        paths: [...fields.paths],
      },
      fields.paths.map(pathPattern),
    );
  }

  static written(written: WrittenHookMatch, event: HookEvent): HookMatch {
    return HookMatch.of(
      {
        tools: written.tools,
        lines: readEach(
          'lines',
          written.lines,
          LineKey.of,
          'is lowercase words joined by dashes, as in delivery',
        ),
        stations: readEach(
          'stations',
          written.stations,
          StationKey.of,
          'is lowercase words joined by dashes, as in implementation, and not review or done',
        ),
        repositories: readEach(
          'repositories',
          written.repositories,
          Repository.of,
          'is owner/name, as in acme/api',
        ),
        paths: written.paths,
      },
      event,
    );
  }

  static anything(event: HookEvent): HookMatch {
    return HookMatch.of(
      { tools: [], lines: [], stations: [], repositories: [], paths: [] },
      event,
    );
  }

  isFor(event: HookEvent): boolean {
    return this.event.equals(event);
  }

  get tools(): readonly ToolName[] {
    return this.fields.tools;
  }

  get lines(): readonly LineKey[] {
    return this.fields.lines;
  }

  get stations(): readonly StationKey[] {
    return this.fields.stations;
  }

  get repositories(): readonly Repository[] {
    return this.fields.repositories;
  }

  get paths(): readonly string[] {
    return this.fields.paths;
  }

  matches(task: MatchedTask, event: HookEventFacts): boolean {
    return (
      this.matchesTool(event) &&
      this.within(this.fields.lines, task.line) &&
      this.within(this.fields.stations, task.stationKey) &&
      this.matchesRepository(task, event) &&
      this.matchesPaths(event)
    );
  }

  equals(other: HookMatch): boolean {
    const same = <T>(
      one: readonly T[],
      two: readonly T[],
      equal: (a: T, b: T) => boolean,
    ) =>
      one.length === two.length && one.every((each, i) => equal(each, two[i]));
    const equalValues = <T extends { equals(other: T): boolean }>(a: T, b: T) =>
      a.equals(b);

    return (
      this.event.equals(other.event) &&
      same(this.fields.tools, other.fields.tools, equalValues) &&
      same(this.fields.lines, other.fields.lines, equalValues) &&
      same(this.fields.stations, other.fields.stations, equalValues) &&
      same(this.fields.repositories, other.fields.repositories, equalValues) &&
      same(this.fields.paths, other.fields.paths, (a, b) => a === b)
    );
  }

  private within<T extends { equals(other: T): boolean }>(
    listed: readonly T[],
    value: T,
  ): boolean {
    return listed.length === 0 || listed.some((each) => each.equals(value));
  }

  private matchesTool(event: HookEventFacts): boolean {
    if (this.fields.tools.length === 0) {
      return true;
    }

    const { tool } = event;

    return (
      tool !== null &&
      this.fields.tools.some((each) => each.value === tool.value)
    );
  }

  private matchesRepository(task: MatchedTask, event: HookEventFacts): boolean {
    const listed = this.fields.repositories;

    if (listed.length === 0) {
      return true;
    }

    if (this.event.aboutChanges) {
      const { repository } = event;

      return (
        repository !== null && listed.some((each) => each.equals(repository))
      );
    }

    return task.repositories.some((repository) =>
      listed.some((each) => each.equals(repository)),
    );
  }

  private matchesPaths(event: HookEventFacts): boolean {
    if (this.patterns.length === 0) {
      return true;
    }

    const { changed } = event;

    return (
      changed?.some((path) =>
        this.patterns.some((pattern) => pattern.test(path)),
      ) ?? false
    );
  }
}
