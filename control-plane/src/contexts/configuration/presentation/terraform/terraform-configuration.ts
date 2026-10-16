import type {
  HeldConfigurationDto,
  HeldResourceDto,
} from '@configuration/application/dto/held-configuration.dto';
import type {
  HeldHookMatch,
  HeldHookStep,
} from '@configuration/application/ports/held-hooks.port';
import type { WornSecret } from '@configuration/application/ports/held-integrations.port';
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
  HeldLineAlert,
  HeldLineJudge,
  HeldLineReaction,
  HeldLineReplayCheck,
  HeldLineRepository,
  HeldLineReviews,
  HeldLineSource,
  HeldLineStation,
} from '@work/application/contracts/held-line.contract';

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
  readonly egresses: ReadonlyMap<string, string>;
  readonly secrets: ReadonlySet<string>;
}

const PROVIDER = 'spotlight';

const PROVIDER_SOURCE = 'usespotlightai/spotlight';

const MAIN = 'main.tf';

const VARIABLES = 'variables.tf';

const HOOK_MATCHES: readonly (keyof HeldHookMatch)[] = [
  'tools',
  'lines',
  'stations',
  'repositories',
  'paths',
];

const byPath = inCodePointOrderOf((file: TerraformFile) => file.path);

const PLACE: Readonly<Record<HeldResourceDto['kind'], number>> = {
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
    egresses: new Map(
      configuration.resources
        .filter((each): each is HeldBy<'egress'> => each.kind === 'egress')
        .map((each) => [each.id, each.key]),
    ),
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

const present = (
  name: string,
  value: HclValue | undefined,
): readonly HclItem[] => (value === undefined ? [] : [attribute(name, value)]);

const line = (
  held: HeldBy<'line'>,
  importedAs: string,
  refer: Referring,
): Rendered => {
  const files: TerraformFile[] = [];
  const { definition } = held;

  const judge = (stationKey: string, set: HeldLineJudge): HclBlock => {
    const path = `judges/${held.teamKey}/${held.key}/${stationKey}.md`;

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

  const alert = (set: HeldLineAlert): HclBlock =>
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

  const station = (each: HeldLineStation): HclBlock => {
    const path = `prompts/${held.teamKey}/${held.key}/${each.key}.md`;

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
            : refer.profile(held.teamKey, each.profile),
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
          each.tools.map((tool) => refer.tool(held.teamKey, tool)),
        ),
        attribute(
          'skills',
          each.skills.map((skill) => refer.skill(held.teamKey, skill)),
        ),
        attribute('passes_to', each.passesTo),
        attribute('ends', each.ends),
        ...(each.judge ? [judge(each.key, each.judge)] : []),
        ...each.alerts.map(alert),
      ],
    );
  };

  const repository = (each: HeldLineRepository): HclBlock =>
    block(
      'repository',
      [],
      [
        attribute('name', each.name),
        ...present('image', each.image),
        ...present('setup', each.setup),
      ],
    );

  const reaction = (each: HeldLineReaction): HclBlock =>
    block(
      'reaction',
      [],
      [
        attribute('happening', each.happening),
        ...present('from', each.from),
        attribute('to', each.to),
      ],
    );

  const reviews = (policy: HeldLineReviews): HclBlock =>
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

  const replayCheck = (policy: HeldLineReplayCheck): HclBlock =>
    block(
      'replay_check',
      [],
      [
        attribute('most_regressions', policy.mostRegressions),
        attribute('ceiling', policy.ceiling),
        attribute('currency', policy.currency),
        attribute('min_gain', policy.minGain),
      ],
    );

  const source = (from: HeldLineSource): HclBlock =>
    block(
      'source',
      [],
      [attribute('repository', from.repository), attribute('path', from.path)],
    );

  return adopted(
    held,
    nameOf(held.teamKey, held.key),
    importedAs,
    [
      ...refer.owner(held),
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
  held: HeldBy<'skill'>,
  importedAs: string,
  refer: Referring,
): Rendered => {
  const files = Object.entries(held.files)
    .sort(inCodePointOrderOf(([within]: [string, string]) => within))
    .map(([within, content]) => ({
      within,
      path: `skills/${held.teamKey}/${held.key}/${within}`,
      content,
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

const hookMatch = (held: HeldBy<'hook'>, refer: Referring): HclItem[] => {
  const matched = HOOK_MATCHES.filter((each) => held.match[each].length > 0);

  return matched.length === 0
    ? []
    : [
        attribute(
          'match',
          Object.fromEntries(
            matched.map((each) => [
              each,
              each === 'tools'
                ? held.match.tools.map((tool) =>
                    refer.offered(held.teamKey, tool),
                  )
                : [...held.match[each]],
            ]),
          ),
        ),
      ];
};

const hookStep = (
  teamKey: string,
  step: HeldHookStep,
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
  held: HeldBy<'hook'>,
  importedAs: string,
  refer: Referring,
): Rendered => {
  const secret = `hook_${held.teamKey}_${held.key}_signing_secret`;
  const { signing } = held;
  const signed = signing !== null && 'secretVersion' in signing;

  return adopted(
    held,
    nameOf(held.teamKey, held.key),
    importedAs,
    [
      ...refer.owner(held),
      attribute('key', held.key),
      attribute('on', held.on),
      ...hookMatch(held, refer),
      ...(held.when === null ? [] : [attribute('when', held.when)]),
      ...(Object.keys(held.vars).length === 0
        ? []
        : [attribute('vars', hclOf(held.vars))]),
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
      ...(held.failure === null ? [] : [attribute('failure', held.failure)]),
      ...(held.timeoutSeconds === null
        ? []
        : [attribute('timeout_seconds', held.timeoutSeconds)]),
      attribute(
        'steps',
        held.steps.map((each) => hookStep(held.teamKey, each, refer)),
      ),
    ],
    {
      variables: signed
        ? [
            variable(
              secret,
              `The secret the hook ${held.address} signs its requests with, as whsec_ and base64 bytes`,
              false,
            ),
          ]
        : [],
    },
  );
};

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

const egress = (
  held: HeldBy<'egress'>,
  importedAs: string,
  refer: Referring,
): Rendered => {
  const token = `egress_${held.key}_token`;

  return adopted(
    held,
    nameOf(held.key),
    importedAs,
    [
      ...refer.owner(held),
      attribute('key', held.key),
      attribute('url', held.url),
      attribute('token', HclExpression.traversal('var', token)),
      ...(held.tokenVersion === null
        ? []
        : [attribute('token_version', held.tokenVersion)]),
    ],
    {
      variables: [
        variable(
          token,
          `The token the egress ${held.key} calls Spotlight with; left null, Spotlight issues one when it creates the egress`,
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
    case 'egress':
      return egress(held, importedAs, refer);
    case 'line':
      return line(held, importedAs, refer);
    case 'skill':
      return skill(held, importedAs, refer);
    case 'integration':
      return integration(held, importedAs, refer);
    case 'hook':
      return hook(held, importedAs, refer);
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
