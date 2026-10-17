import type {
  ExportableConfigurationDto,
  ExportableResourceDto,
} from '@configuration/application/dto/exportable-configuration.dto';
import type {
  HookConfigMatch,
  HookConfigStep,
} from '@configuration/application/ports/hook-configs.port';
import type { SecretReferenceAt } from '@configuration/domain/value-objects/secret-reference-at.vo';
import { ToolName } from '@configuration/domain/value-objects/tool-name.vo';
import {
  attribute,
  block,
  type HclBlock,
  HclExpression,
  type HclItem,
  HclLines,
  type HclValue,
} from '@platform/hcl/hcl';
import { formatHcl } from '@platform/hcl/hcl.format';
import {
  inCodePointOrder,
  inCodePointOrderOf,
} from '@platform/ordering/code-point-order';
import type { FieldSegment } from '@shared-kernel/domain/value-objects/field-path.vo';
import { isToolName } from '@shared-kernel/domain/value-objects/identifier-shapes';
import type {
  LineDefinitionAlert,
  LineDefinitionJudge,
  LineDefinitionReaction,
  LineDefinitionReplayCheck,
  LineDefinitionRepository,
  LineDefinitionReviews,
  LineDefinitionSource,
  LineDefinitionStation,
} from '@work/application/contracts/line-definition.contract';

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

type ResourceOf<K extends ExportableResourceDto['kind']> = Extract<
  ExportableResourceDto,
  { kind: K }
>;

interface Neighbours {
  readonly workspaceSlug: string;
  readonly skills: ReadonlySet<string>;
  readonly profiles: ReadonlySet<string>;
  readonly sources: ReadonlySet<string>;
  readonly trusts: ReadonlySet<string>;
  readonly pools: ReadonlySet<string>;
  readonly egresses: ReadonlyMap<string, string>;
  readonly secrets: ReadonlySet<string>;
}

const PROVIDER = 'spotlight';

const PROVIDER_SOURCE = 'usespotlightai/spotlight';

const MAIN = 'main.tf';

const VARIABLES = 'variables.tf';

const HOOK_MATCHES: readonly (keyof HookConfigMatch)[] = [
  'tools',
  'lines',
  'stations',
  'repositories',
  'paths',
];

const byPath = inCodePointOrderOf((file: TerraformFile) => file.path);

const PLACE: Readonly<Record<ExportableResourceDto['kind'], number>> = {
  workspace: 0,
  secret: 1,
  'workspace-token-trust': 2,
  'runner-trust': 3,
  egress: 4,
  'runner-pool': 5,
  'workspace-runners': 6,
  team: 7,
  line: 8,
  skill: 9,
  integration: 10,
  hook: 11,
  'harness-profile': 12,
};

const PLATFORM_EGRESS = 'spotlight';

const teamOf = (resource: ExportableResourceDto): string => {
  if (resource.kind === 'team') {
    return resource.key;
  }

  return resource.kind !== 'workspace' && resource.ownedBy === 'team'
    ? resource.teamKey
    : '';
};

const inModuleOrder = (
  one: ExportableResourceDto,
  other: ExportableResourceDto,
): number =>
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

const nameOf = (...keys: readonly string[]): string => {
  const joined = keys.join('_');

  return /^[A-Za-z_]/.test(joined) ? joined : `_${joined}`;
};

const typeOf = (kind: ExportableResourceDto['kind']): string =>
  `${PROVIDER}_${kind.replaceAll('-', '_')}`;

const referenceTo = (
  kind: ExportableResourceDto['kind'],
  name: string,
  field: string,
): HclExpression => HclExpression.traversal(typeOf(kind), name, field);

const inTeam = (teamKey: string, key: string): string =>
  JSON.stringify([teamKey, key]);

const secretNameOf = (name: string): string => nameOf(name.toLowerCase());

const neighboursIn = (
  configuration: ExportableConfigurationDto,
): Neighbours => {
  const of = <K extends ExportableResourceDto['kind']>(
    kind: K,
    key: (resource: ResourceOf<K>) => string,
  ): ReadonlySet<string> =>
    new Set(
      configuration.resources
        .filter((each): each is ResourceOf<K> => each.kind === kind)
        .map(key),
    );

  return {
    workspaceSlug: configuration.workspaceSlug,
    skills: of('skill', (each) => inTeam(each.teamKey, each.key)),
    profiles: of('harness-profile', (each) => inTeam(each.teamKey, each.key)),
    sources: of('integration', (each) => inTeam(each.teamKey, each.source)),
    trusts: of('runner-trust', (each) => each.key),
    pools: of('runner-pool', (each) => each.key),
    egresses: new Map(
      configuration.resources
        .filter((each): each is ResourceOf<'egress'> => each.kind === 'egress')
        .map((each) => [each.id, each.key]),
    ),
    secrets: of('secret', (each) => each.name),
  };
};

const References = (neighbours: Neighbours) => ({
  owner(resource: ExportableResourceDto): HclItem[] {
    if (resource.kind === 'workspace') {
      return [];
    }

    return resource.ownedBy === 'team'
      ? [
          attribute(
            'team_id',
            referenceTo('team', nameOf(resource.teamKey), 'id'),
          ),
        ]
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

  offered(teamKey: string, tool: string): HclValue {
    const named = isToolName(tool) ? ToolName.of(tool) : null;
    const source = named?.integration;

    return named && source && neighbours.sources.has(inTeam(teamKey, source))
      ? HclExpression.indexed(
          referenceTo('integration', nameOf(teamKey, source), 'tools'),
          named.name,
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

  egress(named: string): HclValue {
    const key = neighbours.egresses.get(named);

    return named !== PLATFORM_EGRESS && key !== undefined
      ? referenceTo('egress', nameOf(key), 'id')
      : named;
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

const importIdOf = (
  resource: ExportableResourceDto,
  workspaceId: string,
): string =>
  resource.kind === 'workspace'
    ? resource.address
    : `${workspaceId}/${resource.address}`;

const adopted = (
  resource: ExportableResourceDto,
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
        attribute('to', HclExpression.traversal(typeOf(resource.kind), name)),
        attribute('id', importedAs),
      ],
    ),
    block('resource', [typeOf(resource.kind), name], body),
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

const present = (
  name: string,
  value: HclValue | undefined,
): readonly HclItem[] => (value === undefined ? [] : [attribute(name, value)]);

const line = (
  resource: ResourceOf<'line'>,
  importedAs: string,
  refer: Referring,
): Rendered => {
  const files: TerraformFile[] = [];
  const { definition } = resource;

  const judge = (stationKey: string, set: LineDefinitionJudge): HclBlock => {
    const path = `judges/${resource.teamKey}/${resource.key}/${stationKey}.md`;

    if (set.rubric !== undefined) {
      files.push({ path, content: set.rubric });
    }

    return block(
      'judge',
      [],
      [
        ...(set.rubric === undefined
          ? []
          : [attribute('rubric', HclExpression.moduleFile(path))]),
        ...(set.claims === undefined
          ? []
          : [attribute('claims', HclLines.of(set.claims))]),
        ...present('pass_share', set.passShare),
        attribute('sample', set.sample),
        attribute('trust', set.trust),
      ],
    );
  };

  const alert = (set: LineDefinitionAlert): HclBlock =>
    block(
      'alert',
      [],
      [
        attribute('measure', set.measure),
        ...present('rises_by', set.risesBy),
        ...present('above', set.above),
        ...present('falls_by', set.fallsBy),
        ...present('below', set.below),
        attribute('over', set.over),
      ],
    );

  const station = (each: LineDefinitionStation): HclBlock => {
    const path = `prompts/${resource.teamKey}/${resource.key}/${each.key}.md`;

    if (each.prompt !== undefined) {
      files.push({ path, content: each.prompt });
    }

    return block(
      'station',
      [],
      [
        attribute('key', each.key),
        attribute('name', each.name),
        attribute('kind', each.kind),
        ...present('color', each.color),
        ...present('description', each.description),
        ...present('harness', each.harness),
        ...present('model', each.model),
        ...present('effort', each.effort),
        ...present(
          'profile',
          each.profile === undefined
            ? undefined
            : refer.profile(resource.teamKey, each.profile),
        ),
        ...present(
          'prompt',
          each.prompt === undefined
            ? undefined
            : HclExpression.moduleFile(path),
        ),
        ...present('check', each.check),
        ...present('runners', each.runners),
        ...present('diffs', each.diffs),
        ...present('decisions', each.decisions),
        ...present('memories', each.memories),
        attribute(
          'tools',
          each.tools.map((tool) => refer.tool(resource.teamKey, tool)),
        ),
        attribute(
          'skills',
          each.skills.map((skill) => refer.skill(resource.teamKey, skill)),
        ),
        attribute('passes_to', each.passesTo),
        attribute('ends', each.ends),
        ...(each.judge ? [judge(each.key, each.judge)] : []),
        ...each.alerts.map(alert),
      ],
    );
  };

  const repository = (each: LineDefinitionRepository): HclBlock =>
    block(
      'repository',
      [],
      [
        attribute('name', each.name),
        ...present('image', each.image),
        ...present('setup', each.setup),
      ],
    );

  const reaction = (each: LineDefinitionReaction): HclBlock =>
    block(
      'reaction',
      [],
      [
        attribute('happening', each.happening),
        ...present('from', each.from),
        attribute('to', each.to),
      ],
    );

  const reviews = (policy: LineDefinitionReviews): HclBlock =>
    block(
      'reviews',
      [],
      [
        ...present('start', policy.start),
        ...present('mention', policy.mention),
        ...present('label', policy.label),
        block(
          'skip',
          [],
          [
            ...present('spotlight', policy.skip.spotlight),
            ...present('drafts', policy.skip.drafts),
            ...present('authors', policy.skip.authors),
          ],
        ),
      ],
    );

  const replayCheck = (policy: LineDefinitionReplayCheck): HclBlock =>
    block(
      'replay_check',
      [],
      [
        attribute('max_regressions', policy.maxRegressions),
        attribute('ceiling', policy.ceiling),
        attribute('currency', policy.currency),
        attribute('min_gain', policy.minGain),
      ],
    );

  const source = (from: LineDefinitionSource): HclBlock =>
    block(
      'source',
      [],
      [attribute('repository', from.repository), attribute('path', from.path)],
    );

  return adopted(
    resource,
    nameOf(resource.teamKey, resource.key),
    importedAs,
    [
      ...refer.owner(resource),
      attribute('key', definition.key),
      attribute('name', definition.name),
      ...present('role', definition.role),
      ...present('runners', definition.runners),
      ...definition.repositories.map(repository),
      ...definition.stations.map(station),
      ...definition.reactions.map(reaction),
      ...(definition.reviews ? [reviews(definition.reviews)] : []),
      ...(definition.replayCheck ? [replayCheck(definition.replayCheck)] : []),
      ...(definition.source ? [source(definition.source)] : []),
    ],
    { files },
  );
};

const skill = (
  resource: ResourceOf<'skill'>,
  importedAs: string,
  refer: Referring,
): Rendered => {
  const files = Object.entries(resource.files)
    .sort(inCodePointOrderOf(([within]: [string, string]) => within))
    .map(([within, content]) => ({
      within,
      path: `skills/${resource.teamKey}/${resource.key}/${within}`,
      content,
    }));

  return adopted(
    resource,
    nameOf(resource.teamKey, resource.key),
    importedAs,
    [
      ...refer.owner(resource),
      attribute('key', resource.key),
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
  references: readonly SecretReferenceAt[],
  refer: Referring,
): unknown =>
  references.reduce<unknown>((written, each) => {
    const reference = refer.secret(each.name);

    return reference
      ? replacedAt(written, each.path.segments, reference)
      : written;
  }, definition);

const integration = (
  resource: ResourceOf<'integration'>,
  importedAs: string,
  refer: Referring,
): Rendered =>
  adopted(resource, nameOf(resource.teamKey, resource.source), importedAs, [
    ...refer.owner(resource),
    attribute(
      'definition',
      hclOf(
        withSecretReferences(
          resource.definition,
          resource.secretReferences,
          refer,
        ),
      ),
    ),
  ]);

const profile = (
  resource: ResourceOf<'harness-profile'>,
  importedAs: string,
  refer: Referring,
): Rendered =>
  adopted(resource, nameOf(resource.teamKey, resource.key), importedAs, [
    ...refer.owner(resource),
    attribute('key', resource.key),
    attribute('permissions', hclOf(resource.permissions)),
    attribute(
      'mcp_servers',
      hclOf(
        withSecretReferences(
          resource.mcpServers,
          resource.secretReferences,
          refer,
        ),
      ),
    ),
    attribute('native', hclOf(resource.native)),
  ]);

const hookMatch = (
  resource: ResourceOf<'hook'>,
  refer: Referring,
): HclItem[] => {
  const matched = HOOK_MATCHES.filter(
    (each) => resource.match[each].length > 0,
  );

  return matched.length === 0
    ? []
    : [
        attribute(
          'match',
          Object.fromEntries(
            matched.map((each) => [
              each,
              each === 'tools'
                ? resource.match.tools.map((tool) =>
                    refer.offered(resource.teamKey, tool),
                  )
                : [...resource.match[each]],
            ]),
          ),
        ),
      ];
};

const hookStep = (
  teamKey: string,
  step: HookConfigStep,
  refer: Referring,
): HclValue => {
  if ('call' in step) {
    return {
      name: step.name,
      call: refer.offered(teamKey, step.call),
      ...(Object.keys(step.with).length === 0
        ? {}
        : { with: hclOf(step.with) }),
    };
  }

  const { request } = step;

  return {
    name: step.name,
    request: {
      url: request.url,
      ...(Object.keys(request.headers).length === 0
        ? {}
        : { headers: hclOf(request.headers) }),
      ...(request.body === undefined ? {} : { body: hclOf(request.body) }),
      ...(request.from === 'spotlight' ? {} : { from: request.from }),
    },
  };
};

const hook = (
  resource: ResourceOf<'hook'>,
  importedAs: string,
  refer: Referring,
): Rendered => {
  const secret = `hook_${resource.teamKey}_${resource.key}_signing_secret`;
  const { signing } = resource;
  const signed = signing !== null && 'secretVersion' in signing;

  return adopted(
    resource,
    nameOf(resource.teamKey, resource.key),
    importedAs,
    [
      ...refer.owner(resource),
      attribute('key', resource.key),
      attribute('on', resource.on),
      ...hookMatch(resource, refer),
      ...(resource.when === null ? [] : [attribute('when', resource.when)]),
      ...(Object.keys(resource.vars).length === 0
        ? []
        : [attribute('vars', hclOf(resource.vars))]),
      ...(signing === null
        ? []
        : [
            attribute(
              'signing',
              'secretVersion' in signing
                ? {
                    secret_wo: HclExpression.traversal('var', secret),
                    secret_wo_version: signing.secretVersion,
                  }
                : { oidc: { audience: signing.oidc.audience } },
            ),
          ]),
      ...(resource.failure === null
        ? []
        : [attribute('failure', resource.failure)]),
      ...(resource.timeoutSeconds === null
        ? []
        : [attribute('timeout_seconds', resource.timeoutSeconds)]),
      attribute(
        'steps',
        resource.steps.map((each) => hookStep(resource.teamKey, each, refer)),
      ),
    ],
    {
      variables: signed
        ? [
            variable(
              secret,
              `The secret the hook ${resource.address} signs its requests with, as whsec_ and base64 bytes`,
              false,
            ),
          ]
        : [],
    },
  );
};

const secret = (
  resource: ResourceOf<'secret'>,
  importedAs: string,
  refer: Referring,
): Rendered => {
  const name = secretNameOf(resource.name);
  const value = `secret_${resource.name.toLowerCase()}`;

  return adopted(
    resource,
    name,
    importedAs,
    [
      ...refer.owner(resource),
      attribute('name', resource.name),
      attribute(
        'source',
        hclOf({
          kind: resource.source.kind,
          secret_id: resource.source.secretId ?? undefined,
          field: resource.source.field ?? undefined,
        }),
      ),
      attribute('bindings', hclOf(resource.bindings)),
      ...(resource.keepsValue
        ? [attribute('value_wo', HclExpression.traversal('var', value))]
        : []),
      ...(resource.valueVersion === null
        ? []
        : [attribute('value_wo_version', resource.valueVersion)]),
    ],
    {
      variables: resource.keepsValue
        ? [
            variable(
              value,
              `The value of the secret ${resource.name}, which Spotlight keeps and never answers`,
              false,
            ),
          ]
        : [],
    },
  );
};

const pool = (
  resource: ResourceOf<'runner-pool'>,
  importedAs: string,
  refer: Referring,
): Rendered => {
  const token = `runner_pool_${resource.key}_token`;
  const secret = `runner_pool_${resource.key}_provision_secret`;
  const { provision } = resource;

  return adopted(
    resource,
    nameOf(resource.key),
    importedAs,
    [
      ...refer.owner(resource),
      attribute('key', resource.key),
      attribute('labels', [...resource.labels]),
      ...(resource.maxRuns === null
        ? []
        : [attribute('max_runs', resource.maxRuns)]),
      ...(provision
        ? [
            attribute('provision', {
              url: provision.url,
              secret: HclExpression.traversal('var', secret),
              ...(provision.secretVersion === null
                ? {}
                : { secret_version: provision.secretVersion }),
              ...(provision.egress === null
                ? {}
                : { egress: refer.egress(provision.egress) }),
              ...(provision.egressTraffic === 'bound'
                ? { egress_traffic: 'bound' }
                : {}),
            }),
          ]
        : [
            attribute('token', HclExpression.traversal('var', token)),
            ...(resource.tokenVersion === null
              ? []
              : [attribute('token_version', resource.tokenVersion)]),
          ]),
    ],
    {
      variables: [
        provision
          ? variable(
              secret,
              `The secret the runner pool ${resource.key} signs its provision calls with, as whsec_ and base64 bytes`,
              false,
            )
          : variable(
              token,
              `The token the runner pool ${resource.key} claims with; left null, Spotlight issues one when it creates the pool`,
              true,
            ),
      ],
    },
  );
};

const egress = (
  resource: ResourceOf<'egress'>,
  importedAs: string,
  refer: Referring,
): Rendered => {
  const token = `egress_${resource.key}_token`;

  return adopted(
    resource,
    nameOf(resource.key),
    importedAs,
    [
      ...refer.owner(resource),
      attribute('key', resource.key),
      attribute('url', resource.url),
      attribute('token', HclExpression.traversal('var', token)),
      ...(resource.tokenVersion === null
        ? []
        : [attribute('token_version', resource.tokenVersion)]),
    ],
    {
      variables: [
        variable(
          token,
          `The token the egress ${resource.key} calls Spotlight with; left null, Spotlight issues one when it creates the egress`,
          true,
        ),
      ],
    },
  );
};

const rendered = (
  resource: ExportableResourceDto,
  configuration: ExportableConfigurationDto,
  refer: Referring,
): Rendered => {
  const importedAs = importIdOf(resource, configuration.workspaceId);

  switch (resource.kind) {
    case 'workspace':
      return adopted(resource, nameOf(resource.slug), importedAs, [
        attribute('name', resource.name),
        attribute('slug', resource.slug),
      ]);
    case 'team':
      return adopted(resource, nameOf(resource.key), importedAs, [
        ...refer.owner(resource),
        attribute('key', resource.key),
        attribute('name', resource.name),
      ]);
    case 'secret':
      return secret(resource, importedAs, refer);
    case 'workspace-token-trust':
      return adopted(resource, nameOf(resource.key), importedAs, [
        ...refer.owner(resource),
        attribute('key', resource.key),
        attribute('issuer', resource.issuer),
        attribute('audience', resource.audience),
        attribute('subject', resource.subject),
        ...(Object.keys(resource.claims).length === 0
          ? []
          : [attribute('claims', { ...resource.claims })]),
        attribute('scopes', [...resource.scopes]),
        attribute('lifetime_minutes', resource.lifetimeMinutes),
      ]);
    case 'runner-trust':
      return adopted(resource, nameOf(resource.key), importedAs, [
        ...refer.owner(resource),
        attribute('key', resource.key),
        attribute('issuer', resource.issuer),
        attribute('subject', resource.subject),
        attribute('audience', resource.audience),
        attribute('labels', [...resource.labels]),
      ]);
    case 'workspace-runners':
      return adopted(resource, nameOf(resource.address), importedAs, [
        ...refer.owner(resource),
        attribute(
          'trusts',
          resource.trusts.map((each) => refer.trust(each)),
        ),
        attribute(
          'pools',
          resource.pools.map((each) => refer.pool(each)),
        ),
      ]);
    case 'runner-pool':
      return pool(resource, importedAs, refer);
    case 'egress':
      return egress(resource, importedAs, refer);
    case 'line':
      return line(resource, importedAs, refer);
    case 'skill':
      return skill(resource, importedAs, refer);
    case 'integration':
      return integration(resource, importedAs, refer);
    case 'hook':
      return hook(resource, importedAs, refer);
    case 'harness-profile':
      return profile(resource, importedAs, refer);
  }
};

const renderedIn = (
  configuration: ExportableConfigurationDto,
  chosen: readonly ExportableResourceDto[],
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
  configuration: ExportableConfigurationDto,
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
  configuration: ExportableConfigurationDto,
  resource: ExportableResourceDto,
): ResourceHcl => {
  const [one] = renderedIn(configuration, [resource]);

  return {
    hcl: formatHcl([...(one?.variables ?? []), ...(one?.blocks ?? [])]),
    files: [...(one?.files ?? [])].sort(byPath),
  };
};
