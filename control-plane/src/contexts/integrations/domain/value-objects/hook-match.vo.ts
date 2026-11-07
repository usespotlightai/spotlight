import { InvalidHookError } from '@integrations/domain/exceptions/invalid-hook.error';
import type { HookEvent } from '@integrations/domain/value-objects/hook-event.vo';
import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { isSlug } from '@shared-kernel/domain/value-objects/identifier-shapes';

const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

const REGEX_SPECIAL = /[.+^${}()|[\]\\]/g;

interface HookMatchFields {
  readonly tools: readonly ToolName[];
  readonly lines: readonly string[];
  readonly stations: readonly string[];
  readonly repositories: readonly string[];
  readonly paths: readonly string[];
}

export interface MatchedTask {
  readonly line: string;
  readonly stationKey: string;
  readonly repositories: readonly string[];
}

const at = (...segments: (string | number)[]) =>
  FieldPath.of(['match', ...segments]);

export const pathPattern = (glob: string): RegExp => {
  const whole = glob.endsWith('/') ? `${glob}**` : glob;
  let pattern = '';

  for (let index = 0; index < whole.length; index += 1) {
    const each = whole[index] as string;

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

const textOf = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const textsOf = (value: unknown): readonly string[] | null =>
  Array.isArray(value) && value.every((each) => typeof each === 'string')
    ? value
    : null;

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

  fields.lines.forEach((line, index) => {
    if (!isSlug(line)) {
      throw new InvalidHookError(
        at('lines', index),
        'is lowercase words joined by dashes, as in delivery',
      );
    }
  });

  fields.stations.forEach((station, index) => {
    if (!isSlug(station)) {
      throw new InvalidHookError(
        at('stations', index),
        'is lowercase words joined by dashes, as in implementation',
      );
    }
  });

  fields.repositories.forEach((repository, index) => {
    if (!REPOSITORY.test(repository)) {
      throw new InvalidHookError(
        at('repositories', index),
        'is owner/name, as in acme/api',
      );
    }
  });

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

  get lines(): readonly string[] {
    return this.fields.lines;
  }

  get stations(): readonly string[] {
    return this.fields.stations;
  }

  get repositories(): readonly string[] {
    return this.fields.repositories;
  }

  get paths(): readonly string[] {
    return this.fields.paths;
  }

  matches(
    task: MatchedTask,
    event: Readonly<Record<string, unknown>>,
  ): boolean {
    return (
      this.matchesTool(event) &&
      this.within(this.fields.lines, task.line) &&
      this.within(this.fields.stations, task.stationKey) &&
      this.matchesRepository(task, event) &&
      this.matchesPaths(event)
    );
  }

  equals(other: HookMatch): boolean {
    const same = (one: readonly string[], two: readonly string[]) =>
      one.length === two.length && one.every((each, i) => each === two[i]);

    return (
      this.event.equals(other.event) &&
      same(
        this.fields.tools.map((each) => each.value),
        other.fields.tools.map((each) => each.value),
      ) &&
      same(this.fields.lines, other.fields.lines) &&
      same(this.fields.stations, other.fields.stations) &&
      same(this.fields.repositories, other.fields.repositories) &&
      same(this.fields.paths, other.fields.paths)
    );
  }

  private within(listed: readonly string[], value: string): boolean {
    return listed.length === 0 || listed.includes(value);
  }

  private matchesTool(event: Readonly<Record<string, unknown>>): boolean {
    if (this.fields.tools.length === 0) {
      return true;
    }

    const tool = textOf(event.tool);

    return (
      tool !== null && this.fields.tools.some((each) => each.value === tool)
    );
  }

  private matchesRepository(
    task: MatchedTask,
    event: Readonly<Record<string, unknown>>,
  ): boolean {
    const listed = this.fields.repositories;

    if (listed.length === 0) {
      return true;
    }

    if (this.event.aboutChanges) {
      const repository = textOf(event.repository);

      return repository !== null && listed.includes(repository);
    }

    return task.repositories.some((each) => listed.includes(each));
  }

  private matchesPaths(event: Readonly<Record<string, unknown>>): boolean {
    if (this.patterns.length === 0) {
      return true;
    }

    const changed = textsOf(event.changed);

    return (
      changed?.some((path) =>
        this.patterns.some((pattern) => pattern.test(path)),
      ) ?? false
    );
  }
}
