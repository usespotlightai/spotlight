import { posix } from 'node:path';
import {
  attribute,
  type HclAttribute,
  HclExpression,
  type HclValue,
} from '@platform/hcl/hcl';
import { formatHclAttributes, formatHclValue } from '@platform/hcl/hcl.format';
import {
  type HclLiteral,
  type HclRead,
  type HclReference,
  HclSyntaxError,
  type ParsedAttribute,
  type ParsedBlock,
  type ParsedBody,
  parsedHcl,
} from '@platform/hcl/hcl.parse';

interface HclFile {
  readonly path: string;
  readonly content: string;
}

export interface HclReferenceRule {
  readonly type: string;
  readonly attribute: string;
  readonly storedAt: string;
  readonly tool: boolean;
}

export interface HclField {
  readonly name: string;
  readonly was: HclLiteral;
  readonly now: HclLiteral;
  readonly unset: HclLiteral;
  readonly references?: HclReferenceRule;
  readonly freshFile?: string;
}

export interface HclGuardedBlock {
  readonly type: string;
  readonly was: Readonly<Record<string, HclLiteral>> | null;
  readonly unset?: Readonly<Record<string, HclLiteral>>;
}

export interface HclBlockEdit {
  readonly file: HclFile;
  readonly owner: {
    readonly attribute: string;
    readonly type: string;
    readonly key: string;
  };
  readonly resource: { readonly type: string; readonly key: string };
  readonly block: { readonly type: string; readonly key: string };
  readonly fields: readonly HclField[];
  readonly blocks: readonly HclGuardedBlock[];
  readonly read: (path: string) => Promise<string | null>;
}

export type HclEditRefusalCode =
  | 'unparsable'
  | 'block-not-found'
  | 'blocks-ambiguous'
  | 'computed-attribute'
  | 'drifted'
  | 'file-missing'
  | 'edit-failed';

interface HclEditRefusal {
  readonly code: HclEditRefusalCode;
  readonly message: string;
  readonly attribute: string | null;
  readonly expression: string | null;
  readonly wanted: HclLiteral | null;
}

export type HclBlockEdited =
  | {
      readonly ok: true;
      readonly files: readonly HclFile[];
      readonly unchecked: readonly string[];
    }
  | { readonly ok: false; readonly refusal: HclEditRefusal };

interface Splice {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

type Resolved =
  | { readonly ok: true; readonly value: HclLiteral; readonly path?: string }
  | { readonly ok: false; readonly why: string };

class Refused extends Error {
  constructor(readonly refusal: HclEditRefusal) {
    super(refusal.message);
  }
}

class OneLineBlock extends Error {}

const refused = (
  code: HclEditRefusalCode,
  message: string,
  more: Partial<Omit<HclEditRefusal, 'code' | 'message'>> = {},
): never => {
  throw new Refused({
    code,
    message,
    attribute: more.attribute ?? null,
    expression: more.expression ?? null,
    wanted: more.wanted ?? null,
  });
};

const normalised = (value: HclLiteral): HclLiteral =>
  typeof value === 'string'
    ? value.replace(/\r\n/g, '\n')
    : Array.isArray(value)
      ? value.map(normalised)
      : value;

const same = (one: HclLiteral, other: HclLiteral): boolean =>
  JSON.stringify(normalised(one)) === JSON.stringify(normalised(other));

const quotedKey = (key: string): string => JSON.stringify(key);

const nameOf = (...keys: readonly string[]): string => {
  const joined = keys.join('_');

  return /^[A-Za-z_]/.test(joined) ? joined : `_${joined}`;
};

const literalAt = (body: ParsedBody, path: string): string | null => {
  const [name, ...within] = path.split('.');
  const found = body.attributes.find((each) => each.name === name);
  const [key, ...deeper] = within;
  const read =
    key === undefined
      ? found?.read
      : deeper.length === 0
        ? found?.entries?.[key]
        : undefined;

  return read?.kind === 'literal' && typeof read.value === 'string'
    ? read.value
    : null;
};

const countOf = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`;

const lineStart = (text: string, at: number): number =>
  text.lastIndexOf('\n', at - 1) + 1;

const indentAt = (text: string, at: number): string => {
  const before = text.slice(lineStart(text, at), at);

  return /^[ \t]*$/.test(before) ? before : '';
};

const levelOf = (indent: string): number =>
  Math.round(indent.replace(/\t/g, '  ').length / 2);

const restOfLine = (text: string, at: number): string => {
  const end = text.indexOf('\n', at);

  return text.slice(at, end < 0 ? text.length : end).replace(/\r$/, '');
};

const inRepository = (from: string, path: string): string => {
  const directory = posix.dirname(from);
  const joined = posix.normalize(
    posix.join(directory === '.' ? '' : directory, path),
  );

  return posix.isAbsolute(path) || joined === '..' || joined.startsWith('../')
    ? refused(
        'file-missing',
        `The file ${quotedKey(path)} is outside the repository.`,
      )
    : joined;
};

const withSuffix = (path: string, suffix: number): string => {
  const dot = path.lastIndexOf('.');

  return dot > path.lastIndexOf('/')
    ? `${path.slice(0, dot)}-${suffix}${path.slice(dot)}`
    : `${path}-${suffix}`;
};

const everyAttribute = (body: ParsedBody): ParsedAttribute[] => [
  ...body.attributes,
  ...body.blocks.flatMap((each) => everyAttribute(each.body)),
];

class Editing {
  private readonly eol: string;
  private readonly reads = new Map<string, Promise<string | null>>();
  private readonly written = new Map<string, string>();

  constructor(
    private readonly edit: HclBlockEdit,
    private readonly parsed: ParsedBody,
  ) {
    this.eol = edit.file.content.includes('\r\n') ? '\r\n' : '\n';
  }

  private get text(): string {
    return this.edit.file.content;
  }

  private read(path: string): Promise<string | null> {
    const kept = this.written.get(path);

    if (kept !== undefined) {
      return Promise.resolve(kept);
    }

    const content = this.reads.get(path) ?? this.edit.read(path);

    this.reads.set(path, content);

    return content;
  }

  private get resources(): readonly ParsedBlock[] {
    return this.parsed.blocks.filter(
      (each) =>
        each.type === 'resource' &&
        each.labels.length === 2 &&
        each.labels.every((label) => label !== null),
    );
  }

  private ownedBy(block: ParsedBlock, key: string): boolean | null {
    const { owner } = this.edit;
    const existing = block.body.attributes.find(
      (each) => each.name === owner.attribute,
    );

    if (
      existing?.read.kind === 'reference' &&
      existing.read.type === owner.type &&
      existing.read.suffix === null
    ) {
      return existing.read.name === nameOf(owner.key);
    }

    return block.labels[1] === nameOf(owner.key, key) ? true : null;
  }

  private ours(
    candidates: readonly ParsedBlock[],
    keyOf: (block: ParsedBlock) => string | null,
  ): { readonly found: ParsedBlock | null; readonly unknown: number } {
    const mine = candidates.filter(
      (each) => this.ownedBy(each, keyOf(each) ?? '') === true,
    );
    const unknown = candidates.filter(
      (each) => this.ownedBy(each, keyOf(each) ?? '') === null,
    );

    if (mine.length === 1) {
      return { found: mine[0] as ParsedBlock, unknown: unknown.length };
    }
    if (mine.length === 0 && candidates.length === 1 && unknown.length === 1) {
      return { found: unknown[0] as ParsedBlock, unknown: 1 };
    }

    return { found: null, unknown: mine.length > 1 ? 2 : unknown.length };
  }

  located(parsed = this.parsed): ParsedBlock {
    const { resource, block, owner } = this.edit;
    const lines = parsed.blocks.filter(
      (each) => each.type === 'resource' && each.labels[0] === resource.type,
    );
    const keyed = lines.filter(
      (each) => literalAt(each.body, 'key') === resource.key,
    );
    const { found: line, unknown } = this.ours(keyed, () => resource.key);

    if (!line) {
      const counted = `${countOf(lines.length, `resource "${resource.type}"`, `resources "${resource.type}"`)} in the file, ${keyed.length} with key ${quotedKey(resource.key)}`;

      return keyed.length === 0
        ? refused(
            'block-not-found',
            `The file has no resource "${resource.type}" with key ${quotedKey(resource.key)}. Found: ${counted}`,
          )
        : unknown > 0
          ? refused(
              'blocks-ambiguous',
              `More than one resource "${resource.type}" with key ${quotedKey(resource.key)} can belong to team ${owner.key}. Found: ${counted}`,
            )
          : refused(
              'block-not-found',
              `The file has no resource "${resource.type}" with key ${quotedKey(resource.key)} for team ${owner.key}. Found: ${counted}`,
            );
    }

    const stations = line.body.blocks.filter(
      (each) => each.type === block.type && each.labels.length === 0,
    );
    const matching = stations.filter(
      (each) => literalAt(each.body, 'key') === block.key,
    );
    const dynamic = line.body.blocks.filter(
      (each) => each.type === 'dynamic' && each.labels[0] === block.type,
    ).length;

    if (matching.length === 1) {
      return matching[0] as ParsedBlock;
    }

    const counted = [
      `${countOf(stations.length, `${block.type} block`)} in the resource with key ${quotedKey(resource.key)}`,
      `${matching.length} with key ${quotedKey(block.key)}`,
      ...(dynamic > 0 ? [countOf(dynamic, 'dynamic block')] : []),
    ].join(', ');

    return refused(
      matching.length === 0 ? 'block-not-found' : 'blocks-ambiguous',
      matching.length === 0
        ? `The resource has no ${block.type} block with key ${quotedKey(block.key)}. Found: ${counted}`
        : `The resource has more than one ${block.type} block with key ${quotedKey(block.key)}. Found: ${counted}`,
    );
  }

  private referenced(reference: HclReference): HclLiteral | undefined {
    const target = this.resources.find(
      (each) =>
        each.labels[0] === reference.type && each.labels[1] === reference.name,
    );
    const storedAt =
      this.edit.fields.find(
        (each) =>
          each.references?.type === reference.type &&
          each.references.attribute === reference.attribute,
      )?.references?.storedAt ?? reference.attribute;
    const value = target ? literalAt(target.body, storedAt) : null;

    return value === null ? undefined : `${value}${reference.suffix ?? ''}`;
  }

  private async resolved(
    existing: ParsedAttribute | undefined,
    unset: HclLiteral,
    name: string,
  ): Promise<Resolved> {
    if (!existing) {
      return { ok: true, value: unset };
    }

    const computed = {
      ok: false as const,
      why: `Terraform computes \`${name}\` from \`${existing.written}\`. Please change it by hand.`,
    };
    const literalOf = (read: HclRead): HclLiteral | undefined =>
      read.kind === 'literal'
        ? read.value
        : read.kind === 'reference'
          ? this.referenced(read)
          : undefined;
    const { read } = existing;

    switch (read.kind) {
      case 'literal':
        return { ok: true, value: read.value };
      case 'reference': {
        const value = literalOf(read);

        return value === undefined ? computed : { ok: true, value };
      }
      case 'list': {
        const values = read.items.map((each) => literalOf(each.read));

        return values.every((each) => each !== undefined)
          ? { ok: true, value: values as HclLiteral[] }
          : computed;
      }
      case 'file': {
        if (!read.fromModule) {
          return {
            ok: false,
            why: `\`${name}\` reads \`${existing.written}\`. Terraform resolves this path from its working directory. Please write it as file("\${path.module}/${read.path}") or change it by hand.`,
          };
        }

        const path = inRepository(this.edit.file.path, read.path);
        const content = await this.read(path);

        return content === null
          ? refused(
              'file-missing',
              `\`${name}\` reads ${quotedKey(path)}. The repository doesn't have this file.`,
              { attribute: name, expression: existing.written },
            )
          : { ok: true, value: content, path };
      }
      case 'computed':
        return computed;
    }
  }

  private referenceFor(
    value: HclLiteral,
    rule: HclReferenceRule,
  ): HclExpression | null {
    if (typeof value !== 'string') {
      return null;
    }

    const dot = value.indexOf('.');
    const key = rule.tool ? value.slice(0, Math.max(dot, 0)) : value;

    if (rule.tool && dot <= 0) {
      return null;
    }

    const { found } = this.ours(
      this.resources.filter(
        (each) =>
          each.labels[0] === rule.type &&
          literalAt(each.body, rule.storedAt) === key,
      ),
      (each) => literalAt(each.body, rule.storedAt),
    );

    if (!found) {
      return null;
    }

    const traversal = HclExpression.traversal(
      rule.type,
      found.labels[1] as string,
      rule.attribute,
    );

    return rule.tool
      ? HclExpression.template(traversal, value.slice(dot))
      : traversal;
  }

  private valueFor(field: HclField, existing: ParsedAttribute | undefined) {
    const { references: rule } = field;

    if (!rule) {
      return field.now as HclValue;
    }

    const kept = (existing?.items ?? []).map((each) => ({
      written: each.written,
      value:
        each.read.kind === 'literal'
          ? each.read.value
          : each.read.kind === 'reference'
            ? this.referenced(each.read)
            : undefined,
      used: false,
    }));
    const element = (value: HclLiteral): HclValue => {
      const original = kept.find(
        (each) =>
          !each.used && each.value !== undefined && same(each.value, value),
      );

      if (original) {
        original.used = true;
        return HclExpression.verbatim(original.written);
      }

      return this.referenceFor(value, rule) ?? (value as HclValue);
    };

    return Array.isArray(field.now)
      ? field.now.map(element)
      : field.now === null
        ? null
        : element(field.now);
  }

  private lined(text: string): string {
    return this.eol === '\n' ? text : text.replace(/\r?\n/g, this.eol);
  }

  private async freshPath(
    field: HclField,
    current: string,
    attribute: ParsedAttribute,
  ): Promise<string> {
    const fresh = field.freshFile as string;
    const referenced = (path: string) =>
      everyAttribute(this.parsed).filter(
        (each) =>
          each !== attribute &&
          each.read.kind === 'file' &&
          each.read.fromModule &&
          inRepository(this.edit.file.path, each.read.path) === path,
      ).length > 0;

    if (
      inRepository(this.edit.file.path, fresh) === current &&
      !referenced(current) &&
      !this.written.has(current)
    ) {
      return fresh;
    }

    for (let suffix = 1; ; suffix += 1) {
      const chosen = suffix === 1 ? fresh : withSuffix(fresh, suffix);
      const path = inRepository(this.edit.file.path, chosen);

      if (
        path !== current &&
        !referenced(path) &&
        !this.written.has(path) &&
        (await this.edit.read(path)) === null
      ) {
        return chosen;
      }
    }
  }

  private insertion(
    body: ParsedBody,
    indent: string,
    lines: readonly string[],
  ) {
    const last = body.attributes.reduce<ParsedAttribute | null>(
      (latest, each) =>
        latest === null || each.span.end > latest.span.end ? each : latest,
      null,
    );
    const newline = last ? this.text.indexOf('\n', last.span.end) : -1;

    if (newline < 0 || newline > body.closesAt) {
      throw new OneLineBlock();
    }

    const at = this.text[newline - 1] === '\r' ? newline - 1 : newline;

    return {
      start: at,
      end: at,
      text: `${this.eol}${this.eol}${lines.map((each) => `${indent}${each}`).join(this.eol)}`,
    };
  }

  async edited(): Promise<{
    readonly files: readonly HclFile[];
    readonly unchecked: readonly string[];
  }> {
    const block = this.located();
    const keyLine = block.body.attributes.find((each) => each.name === 'key');
    const indent = keyLine ? indentAt(this.text, keyLine.span.start) : '';
    const splices: Splice[] = [];
    const inserted: HclAttribute[] = [];
    const unchecked: string[] = [];
    const changed: HclField[] = [];
    const writes: (() => Promise<void>)[] = [];

    for (const field of this.edit.fields) {
      const found = block.body.attributes.filter(
        (each) => each.name === field.name,
      );

      if (found.length > 1) {
        refused(
          'unparsable',
          `The ${this.edit.block.type} block sets \`${field.name}\` more than once.`,
          { attribute: field.name },
        );
      }

      const [existing] = found;
      const current = await this.resolved(existing, field.unset, field.name);
      const changes = !same(field.was, field.now);

      if (!current.ok) {
        if (changes) {
          refused('computed-attribute', current.why, {
            attribute: field.name,
            expression: existing?.written ?? null,
            wanted: field.now,
          });
        }
        unchecked.push(field.name);
        continue;
      }
      if (!same(current.value, field.was)) {
        refused(
          'drifted',
          `\`${field.name}\` changed in the repository after the search began. The file no longer has the value that the search started from.`,
          { attribute: field.name },
        );
      }
      if (!changes) {
        continue;
      }

      changed.push(field);

      if (!existing) {
        inserted.push(attribute(field.name, this.valueFor(field, existing)));
        continue;
      }

      if (
        existing.read.kind === 'file' &&
        typeof field.now === 'string' &&
        field.freshFile &&
        current.path
      ) {
        const was = current.value as string;
        const path = current.path;
        const now = field.now;

        writes.push(async () => {
          const chosen = await this.freshPath(field, path, existing);
          const target = inRepository(this.edit.file.path, chosen);

          this.written.set(
            target,
            was.includes('\r\n') ? now.replace(/\r?\n/g, '\r\n') : now,
          );

          if (target !== path) {
            splices.push({
              start: existing.value.start,
              end: existing.value.end,
              text: HclExpression.moduleFile(chosen).written,
            });
          }
        });
        continue;
      }

      if (existing.read.kind === 'file' && typeof field.now === 'string') {
        refused(
          'edit-failed',
          `\`${field.name}\` reads \`${existing.written}\`. Spotlight writes only the station's own files. Please change it by hand.`,
          {
            attribute: field.name,
            expression: existing.written,
            wanted: field.now,
          },
        );
      }

      const oneLine =
        restOfLine(this.text, existing.value.end).trim().length > 0;

      splices.push({
        start: existing.value.start,
        end: existing.value.end,
        text: this.lined(
          formatHclValue(
            this.valueFor(field, existing),
            levelOf(indent),
            !oneLine,
          ),
        ),
      });
    }

    for (const guarded of this.edit.blocks) {
      await this.guard(block, guarded, unchecked);
    }

    for (const write of writes) {
      await write();
    }

    if (inserted.length > 0) {
      splices.push(
        this.insertion(block.body, indent, formatHclAttributes(inserted)),
      );
    }

    const files = [...this.written].map(([path, content]) => ({
      path,
      content,
    }));

    if (splices.length === 0) {
      return { files, unchecked };
    }

    const content = [...splices]
      .sort((one, other) => other.start - one.start)
      .reduce(
        (text, each) =>
          `${text.slice(0, each.start)}${each.text}${text.slice(each.end)}`,
        this.text,
      );

    await this.readBack(content, changed);

    return {
      files: [{ path: this.edit.file.path, content }, ...files],
      unchecked,
    };
  }

  private async guard(
    block: ParsedBlock,
    guarded: HclGuardedBlock,
    unchecked: string[],
  ): Promise<void> {
    const found = block.body.blocks.filter(
      (each) => each.type === guarded.type && each.labels.length === 0,
    );
    const drifted = () =>
      refused(
        'drifted',
        `\`${guarded.type}\` changed in the repository after the search began. The file no longer has the value that the search started from.`,
        { attribute: guarded.type },
      );

    if (!guarded.was) {
      if (found.length > 0) {
        drifted();
      }
      return;
    }

    const [nested] = found;

    if (!nested || found.length > 1) {
      return drifted();
    }

    for (const [name, was] of Object.entries(guarded.was)) {
      const current = await this.resolved(
        nested.body.attributes.find((each) => each.name === name),
        guarded.unset?.[name] ?? null,
        `${guarded.type}.${name}`,
      );

      if (!current.ok) {
        unchecked.push(`${guarded.type}.${name}`);
      } else if (!same(current.value, was)) {
        drifted();
      }
    }
  }

  private async readBack(
    content: string,
    changed: readonly HclField[],
  ): Promise<void> {
    let parsed: ParsedBody;

    try {
      parsed = await parsedHcl(content);
    } catch (error) {
      if (error instanceof HclSyntaxError) {
        refused(
          'edit-failed',
          `Spotlight's edit of the file ${error.message}. Please change the file by hand.`,
        );
      }
      throw error;
    }

    const again = new Editing(
      { ...this.edit, file: { ...this.edit.file, content } },
      parsed,
    );

    for (const [path, written] of this.written) {
      again.written.set(path, written);
    }

    const block = again.located();

    for (const field of changed) {
      const read = await again.resolved(
        block.body.attributes.find((each) => each.name === field.name),
        field.unset,
        field.name,
      );

      if (!read.ok || !same(read.value, field.now)) {
        refused(
          'edit-failed',
          `Spotlight's edit of \`${field.name}\` reads back with a different value. Please change it by hand.`,
          { attribute: field.name, wanted: field.now },
        );
      }
    }
  }

  expanded(): string {
    const block = this.located();
    const { body } = block;

    if (body.commented || body.blocks.length > 0) {
      return refused(
        'edit-failed',
        `The ${this.edit.block.type} block is written on one line. Spotlight can add to a block only if it spans several lines.`,
      );
    }

    const indent = indentAt(this.text, block.span.start);
    const header = this.text.slice(block.span.start, body.opensAt).trimEnd();
    const lines = formatHclAttributes(
      body.attributes.map((each) =>
        attribute(each.name, HclExpression.verbatim(each.written)),
      ),
    ).map((each) => `${indent}  ${each}`);

    return `${this.text.slice(0, block.span.start)}${[header, ...lines, `${indent}}`].join(this.eol)}${this.text.slice(block.span.end)}`;
  }
}

const parsedOrRefused = async (text: string): Promise<ParsedBody> => {
  try {
    return await parsedHcl(text);
  } catch (error) {
    if (error instanceof HclSyntaxError) {
      return refused('unparsable', `The file ${error.message}.`);
    }
    throw error;
  }
};

const edited = async (edit: HclBlockEdit) => {
  const editing = new Editing(edit, await parsedOrRefused(edit.file.content));

  try {
    return await editing.edited();
  } catch (error) {
    if (!(error instanceof OneLineBlock)) {
      throw error;
    }

    const content = editing.expanded();

    return new Editing(
      { ...edit, file: { ...edit.file, content } },
      await parsedOrRefused(content),
    ).edited();
  }
};

export const editedHclBlock = async (
  edit: HclBlockEdit,
): Promise<HclBlockEdited> => {
  try {
    return { ok: true, ...(await edited(edit)) };
  } catch (error) {
    if (error instanceof Refused) {
      return { ok: false, refusal: error.refusal };
    }
    throw error;
  }
};
