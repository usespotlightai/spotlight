import type {
  HeldConfigurationDto,
  HeldResourceDto,
} from '@configuration/application/dto/held-configuration.dto';
import type { WornSecret } from '@configuration/application/ports/held-integrations.port';
import { ToolName } from '@configuration/domain/value-objects/tool-name.vo';
import {
  attribute,
  block,
  type HclBlock,
  HclExpression,
  type HclItem,
  type HclValue,
} from '@platform/hcl/hcl';
import { formatHcl } from '@platform/hcl/hcl.format';
import {
  inCodePointOrder,
  inCodePointOrderOf,
} from '@platform/ordering/code-point-order';
import type { FieldSegment } from '@shared-kernel/domain/value-objects/field-path.vo';
import { isToolName } from '@shared-kernel/domain/value-objects/identifier-shapes';

export interface TerraformFile {
  readonly path: string;
  readonly content: string;
}

export interface ResourceHcl {
  readonly hcl: string;
  readonly files: readonly TerraformFile[];
}

interface Rendered {
  readonly variables: readonly HclBlock[];
  readonly blocks: readonly HclBlock[];
  readonly files: readonly TerraformFile[];
}

type HeldBy<K extends HeldResourceDto['kind']> = Extract<
  HeldResourceDto,
  { kind: K }
>;

interface Neighbours {
  readonly workspaceSlug: string;
  readonly skills: ReadonlySet<string>;
  readonly profiles: ReadonlySet<string>;
  readonly sources: ReadonlySet<string>;
  readonly trusts: ReadonlySet<string>;
  readonly pools: ReadonlySet<string>;
  readonly secrets: ReadonlySet<string>;
}

const PROVIDER = 'spotlight';

const PROVIDER_SOURCE = 'usespotlightai/spotlight';

const MAIN = 'main.tf';

const VARIABLES = 'variables.tf';

const LINE_BLOCKS: Readonly<Record<string, string>> = {
  repositories: 'repository',
  stations: 'station',
  reactions: 'reaction',
  reviews: 'reviews',
  skip: 'skip',
};

const byPath = inCodePointOrderOf((file: TerraformFile) => file.path);

const PLACE: Readonly<Record<HeldResourceDto['kind'], number>> = {
  workspace: 0,
  secret: 1,
  'workspace-token-trust': 2,
  'runner-trust': 3,
  'runner-pool': 4,
  'workspace-runners': 5,
  team: 6,
  line: 7,
  skill: 8,
  integration: 9,
  'harness-profile': 10,
};

const teamOf = (held: HeldResourceDto): string => {
  if (held.kind === 'team') {
    return held.key;
  }

  return held.kind !== 'workspace' && held.heldBy === 'team'
    ? held.teamKey
    : '';
};

const inModuleOrder = (one: HeldResourceDto, other: HeldResourceDto): number =>
  inCodePointOrder(teamOf(one), teamOf(other)) ||
  PLACE[one.kind] - PLACE[other.kind] ||
  inCodePointOrder(one.address, other.address);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hclOf = (value: unknown): HclValue => {
  if (value instanceof HclExpression) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(hclOf);
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => value[key] !== undefined)
        .sort(inCodePointOrder)
        .map((key) => [key, hclOf(value[key])]),
    );
  }

  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
    ? value
    : null;
};

const snakeCase = (name: string): string =>
  name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

const nameOf = (...keys: readonly string[]): string => {
  const joined = keys.join('_');

  return /^[A-Za-z_]/.test(joined) ? joined : `_${joined}`;
};

const typeOf = (kind: HeldResourceDto['kind']): string =>
  `${PROVIDER}_${kind.replaceAll('-', '_')}`;

const referenceTo = (
  kind: HeldResourceDto['kind'],
  name: string,
  field: string,
): HclExpression => HclExpression.traversal(typeOf(kind), name, field);

const texts = (value: unknown): readonly string[] =>
  Array.isArray(value)
    ? value.filter((each): each is string => typeof each === 'string')
    : [];

const inTeam = (teamKey: string, key: string): string =>
  JSON.stringify([teamKey, key]);

const secretNameOf = (name: string): string => nameOf(name.toLowerCase());

const neighboursIn = (configuration: HeldConfigurationDto): Neighbours => {
  const of = <K extends HeldResourceDto['kind']>(
    kind: K,
    key: (held: HeldBy<K>) => string,
  ): ReadonlySet<string> =>
    new Set(
      configuration.resources
        .filter((each): each is HeldBy<K> => each.kind === kind)
        .map(key),
    );

  return {
    workspaceSlug: configuration.workspaceSlug,
    skills: of('skill', (each) => inTeam(each.teamKey, each.key)),
    profiles: of('harness-profile', (each) => inTeam(each.teamKey, each.key)),
    sources: of('integration', (each) => inTeam(each.teamKey, each.source)),
    trusts: of('runner-trust', (each) => each.key),
    pools: of('runner-pool', (each) => each.key),
    secrets: of('secret', (each) => each.name),
  };
};

const References = (neighbours: Neighbours) => ({
  owner(held: HeldResourceDto): HclItem[] {
    if (held.kind === 'workspace') {
      return [];
    }

    return held.heldBy === 'team'
      ? [attribute('team_id', referenceTo('team', nameOf(held.teamKey), 'id'))]
      : [
          attribute(
            'workspace_id',
            referenceTo('workspace', nameOf(neighbours.workspaceSlug), 'id'),
          ),
        ];
  },

  skill(teamKey: string, key: string): HclValue {
    return neighbours.skills.has(inTeam(teamKey, key))
      ? referenceTo('skill', nameOf(teamKey, key), 'key')
      : key;
  },

  profile(teamKey: string, key: string): HclValue {
    return neighbours.profiles.has(inTeam(teamKey, key))
      ? referenceTo('harness-profile', nameOf(teamKey, key), 'key')
      : key;
  },

  tool(teamKey: string, tool: string): HclValue {
    const named = isToolName(tool) ? ToolName.of(tool) : null;
    const source = named?.integration;

    return named && source && neighbours.sources.has(inTeam(teamKey, source))
      ? HclExpression.template(
          referenceTo('integration', nameOf(teamKey, source), 'source'),
          `.${named.name}`,
        )
      : tool;
  },

  trust(key: string): HclValue {
    return neighbours.trusts.has(key)
      ? referenceTo('runner-trust', nameOf(key), 'key')
      : key;
  },

  pool(key: string): HclValue {
    return neighbours.pools.has(key)
      ? referenceTo('runner-pool', nameOf(key), 'key')
      : key;
  },

  secret(name: string): HclExpression | null {
    return neighbours.secrets.has(name)
      ? HclExpression.template(
          'secret.',
          referenceTo('secret', secretNameOf(name), 'name'),
        )
      : null;
  },
});

type Referring = ReturnType<typeof References>;

const importIdOf = (held: HeldResourceDto, workspaceId: string): string =>
  held.kind === 'workspace' ? held.address : `${workspaceId}/${held.address}`;

const adopted = (
  held: HeldResourceDto,
  name: string,
  importedAs: string,
  body: readonly HclItem[],
  more: Partial<Omit<Rendered, 'blocks'>> = {},
): Rendered => ({
  variables: more.variables ?? [],
  blocks: [
    block(
      'import',
      [],
      [
        attribute('to', HclExpression.traversal(typeOf(held.kind), name)),
        attribute('id', importedAs),
      ],
    ),
    block('resource', [typeOf(held.kind), name], body),
  ],
  files: more.files ?? [],
});

const variable = (
  name: string,
  description: string,
  optional: boolean,
): HclBlock =>
  block(
    'variable',
    [name],
    [
      attribute('description', description),
      attribute('type', HclExpression.traversal('string')),
      attribute('sensitive', true),
      ...(optional ? [attribute('default', null)] : []),
    ],
  );

const documentBody = (
  document: Readonly<Record<string, unknown>>,
): readonly HclItem[] => {
  const attributes: HclItem[] = [];
  const blocks: HclItem[] = [];

  for (const [name, value] of Object.entries(document)) {
    const type = LINE_BLOCKS[name];

    if (value === undefined || value === null) {
      continue;
    }

    if (type && Array.isArray(value)) {
      blocks.push(
        ...value
          .filter(isRecord)
          .map((each) => block(type, [], documentBody(each))),
      );
    } else if (type && isRecord(value)) {
      blocks.push(block(type, [], documentBody(value)));
    } else {
      attributes.push(attribute(snakeCase(name), hclOf(value)));
    }
  }

  return [...attributes, ...blocks];
};

const line = (
  held: HeldBy<'line'>,
  importedAs: string,
  refer: Referring,
): Rendered => {
  const files: TerraformFile[] = [];
  const stations = Array.isArray(held.definition.stations)
    ? held.definition.stations
    : [];

  const written = stations.map((station: unknown) => {
    if (!isRecord(station)) {
      return station;
    }

    const path = `prompts/${held.teamKey}/${held.key}/${String(station.key)}.md`;

    if (typeof station.prompt === 'string') {
      files.push({ path, content: station.prompt });
    }

    return {
      ...station,
      ...(Array.isArray(station.skills)
        ? {
            skills: texts(station.skills).map((each) =>
              refer.skill(held.teamKey, each),
            ),
          }
        : {}),
      ...(Array.isArray(station.tools)
        ? {
            tools: texts(station.tools).map((each) =>
              refer.tool(held.teamKey, each),
            ),
          }
        : {}),
      ...(typeof station.profile === 'string'
        ? { profile: refer.profile(held.teamKey, station.profile) }
        : {}),
      ...(typeof station.prompt === 'string'
        ? { prompt: HclExpression.moduleFile(path) }
        : {}),
    };
  });

  return adopted(
    held,
    nameOf(held.teamKey, held.key),
    importedAs,
    [
      ...refer.owner(held),
      ...documentBody({
        ...held.definition,
        stations: written,
      }),
    ],
    { files },
  );
};

const skill = (
  held: HeldBy<'skill'>,
  importedAs: string,
  refer: Referring,
): Rendered => {
  const files = Object.keys(held.files)
    .sort(inCodePointOrder)
    .map((within) => ({
      within,
      path: `skills/${held.teamKey}/${held.key}/${within}`,
      content: held.files[within] ?? '',
    }));

  return adopted(
    held,
    nameOf(held.teamKey, held.key),
    importedAs,
    [
      ...refer.owner(held),
      attribute('key', held.key),
      attribute(
        'files',
        Object.fromEntries(
          files.map((each) => [
            each.within,
            HclExpression.moduleFile(each.path),
          ]),
        ),
      ),
    ],
    { files: files.map(({ path, content }) => ({ path, content })) },
  );
};

const replacedAt = (
  value: unknown,
  path: readonly FieldSegment[],
  by: HclExpression,
): unknown => {
  const [step, ...rest] = path;

  if (step === undefined) {
    return by;
  }

  if (Array.isArray(value) && typeof step === 'number') {
    return value.map((each, at) =>
      at === step ? replacedAt(each, rest, by) : each,
    );
  }

  return isRecord(value) && typeof step === 'string' && step in value
    ? { ...value, [step]: replacedAt(value[step], rest, by) }
    : value;
};

const withSecretReferences = (
  definition: unknown,
  worn: readonly WornSecret[],
  refer: Referring,
): unknown =>
  worn.reduce<unknown>((written, each) => {
    const reference = refer.secret(each.name);

    return reference
      ? replacedAt(written, each.path.segments, reference)
      : written;
  }, definition);

const integration = (
  held: HeldBy<'integration'>,
  importedAs: string,
  refer: Referring,
): Rendered =>
  adopted(held, nameOf(held.teamKey, held.source), importedAs, [
    ...refer.owner(held),
    attribute(
      'definition',
      hclOf(withSecretReferences(held.definition, held.secretsWorn, refer)),
    ),
  ]);

const profile = (
  held: HeldBy<'harness-profile'>,
  importedAs: string,
  refer: Referring,
): Rendered =>
  adopted(held, nameOf(held.teamKey, held.key), importedAs, [
    ...refer.owner(held),
    attribute('key', held.key),
    attribute('permissions', hclOf(held.permissions)),
    attribute(
      'mcp_servers',
      hclOf(withSecretReferences(held.mcpServers, held.secretsWorn, refer)),
    ),
    attribute('native', hclOf(held.native)),
  ]);

const secret = (
  held: HeldBy<'secret'>,
  importedAs: string,
  refer: Referring,
): Rendered => {
  const name = secretNameOf(held.name);
  const value = `secret_${held.name.toLowerCase()}`;

  return adopted(
    held,
    name,
    importedAs,
    [
      ...refer.owner(held),
      attribute('name', held.name),
      attribute(
        'source',
        hclOf({
          kind: held.source.kind,
          secret_id: held.source.secretId ?? undefined,
          field: held.source.field ?? undefined,
        }),
      ),
      attribute('bindings', hclOf(held.bindings)),
      ...(held.keepsValue
        ? [attribute('value_wo', HclExpression.traversal('var', value))]
        : []),
      ...(held.valueVersion === null
        ? []
        : [attribute('value_wo_version', held.valueVersion)]),
    ],
    {
      variables: held.keepsValue
        ? [
            variable(
              value,
              `The value of the secret ${held.name}, which Spotlight keeps and never answers`,
              false,
            ),
          ]
        : [],
    },
  );
};

const pool = (
  held: HeldBy<'runner-pool'>,
  importedAs: string,
  refer: Referring,
): Rendered => {
  const token = `runner_pool_${held.key}_token`;
  const secret = `runner_pool_${held.key}_provision_secret`;
  const { provision } = held;

  return adopted(
    held,
    nameOf(held.key),
    importedAs,
    [
      ...refer.owner(held),
      attribute('key', held.key),
      attribute('labels', [...held.labels]),
      ...(held.maxRuns === null ? [] : [attribute('max_runs', held.maxRuns)]),
      ...(provision
        ? [
            attribute('provision', {
              url: provision.url,
              secret: HclExpression.traversal('var', secret),
              ...(provision.secretVersion === null
                ? {}
                : { secret_version: provision.secretVersion }),
            }),
          ]
        : [
            attribute('token', HclExpression.traversal('var', token)),
            ...(held.tokenVersion === null
              ? []
              : [attribute('token_version', held.tokenVersion)]),
          ]),
    ],
    {
      variables: [
        provision
          ? variable(
              secret,
              `The secret the runner pool ${held.key} signs its provision calls with, as whsec_ and base64 bytes`,
              false,
            )
          : variable(
              token,
              `The token the runner pool ${held.key} claims with; left null, Spotlight issues one when it creates the pool`,
              true,
            ),
      ],
    },
  );
};

const rendered = (
  held: HeldResourceDto,
  configuration: HeldConfigurationDto,
  refer: Referring,
): Rendered => {
  const importedAs = importIdOf(held, configuration.workspaceId);

  switch (held.kind) {
    case 'workspace':
      return adopted(held, nameOf(held.slug), importedAs, [
        attribute('name', held.name),
        attribute('slug', held.slug),
      ]);
    case 'team':
      return adopted(held, nameOf(held.key), importedAs, [
        ...refer.owner(held),
        attribute('key', held.key),
        attribute('name', held.name),
      ]);
    case 'secret':
      return secret(held, importedAs, refer);
    case 'workspace-token-trust':
      return adopted(held, nameOf(held.key), importedAs, [
        ...refer.owner(held),
        attribute('key', held.key),
        attribute('issuer', held.issuer),
        attribute('audience', held.audience),
        attribute('subject', held.subject),
        ...(Object.keys(held.claims).length === 0
          ? []
          : [attribute('claims', { ...held.claims })]),
        attribute('scopes', [...held.scopes]),
        attribute('lifetime_minutes', held.lifetimeMinutes),
      ]);
    case 'runner-trust':
      return adopted(held, nameOf(held.key), importedAs, [
        ...refer.owner(held),
        attribute('key', held.key),
        attribute('issuer', held.issuer),
        attribute('subject', held.subject),
        attribute('audience', held.audience),
        attribute('labels', [...held.labels]),
      ]);
    case 'workspace-runners':
      return adopted(held, nameOf(held.address), importedAs, [
        ...refer.owner(held),
        attribute(
          'trusts',
          held.trusts.map((each) => refer.trust(each)),
        ),
        attribute(
          'pools',
          held.pools.map((each) => refer.pool(each)),
        ),
      ]);
    case 'runner-pool':
      return pool(held, importedAs, refer);
    case 'line':
      return line(held, importedAs, refer);
    case 'skill':
      return skill(held, importedAs, refer);
    case 'integration':
      return integration(held, importedAs, refer);
    case 'harness-profile':
      return profile(held, importedAs, refer);
  }
};

const renderedIn = (
  configuration: HeldConfigurationDto,
  chosen: readonly HeldResourceDto[],
): readonly Rendered[] => {
  const refer = References(neighboursIn(configuration));

  return chosen.map((each) => rendered(each, configuration, refer));
};

const PROVIDERS = block(
  'terraform',
  [],
  [
    block(
      'required_providers',
      [],
      [attribute(PROVIDER, { source: PROVIDER_SOURCE })],
    ),
  ],
);

export const workspaceTerraform = (
  configuration: HeldConfigurationDto,
): readonly TerraformFile[] => {
  const all = renderedIn(
    configuration,
    [...configuration.resources].sort(inModuleOrder),
  );
  const variables = all.flatMap((each) => each.variables);

  return [
    {
      path: MAIN,
      content: formatHcl([PROVIDERS, ...all.flatMap((each) => each.blocks)]),
    },
    ...(variables.length > 0
      ? [{ path: VARIABLES, content: formatHcl(variables) }]
      : []),
    ...all.flatMap((each) => each.files),
  ].sort(byPath);
};

export const resourceHcl = (
  configuration: HeldConfigurationDto,
  resource: HeldResourceDto,
): ResourceHcl => {
  const [one] = renderedIn(configuration, [resource]);

  return {
    hcl: formatHcl([...(one?.variables ?? []), ...(one?.blocks ?? [])]),
    files: [...(one?.files ?? [])].sort(byPath),
  };
};
