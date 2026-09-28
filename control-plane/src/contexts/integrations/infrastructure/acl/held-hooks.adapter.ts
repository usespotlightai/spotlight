import type {
  HeldHook,
  HeldHookSigning,
  HeldHookStep,
  HeldHooksPort,
} from '@configuration/application/ports/held-hooks.port';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type {
  HookResourcesPort,
  KeptHook,
} from '@integrations/application/ports/hook-resources.port';
import { HookAddress } from '@integrations/domain/value-objects/hook-address.vo';
import { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

type Held = Readonly<Record<string, unknown>>;

const isHeld = (value: unknown): value is Held =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const heldIn = (value: unknown): Held => (isHeld(value) ? value : {});

const textsIn = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.map(String) : [];

const textsBy = (value: unknown): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(heldIn(value)).map(([name, each]) => [name, String(each)]),
  );

const stepOf = (step: Held): HeldHookStep => {
  const name = String(step.name ?? '');

  if (typeof step.call === 'string') {
    return { name, call: step.call, with: { ...heldIn(step.with) } };
  }

  const request = heldIn(step.request);

  return {
    name,
    request: {
      url: String(request.url ?? ''),
      headers: textsBy(request.headers),
      body: request.body,
      from: request.from === 'network' ? 'network' : 'spotlight',
    },
  };
};

const signingOf = (value: unknown): HeldHookSigning | null => {
  const signing = heldIn(value);

  if (isHeld(signing.oidc)) {
    return { oidc: { audience: String(signing.oidc.audience ?? '') } };
  }

  return typeof signing.secretVersion === 'number'
    ? { secretVersion: signing.secretVersion }
    : null;
};

const heldOn = (teamKey: string, kept: KeptHook): HeldHook => {
  const held = kept.definition;
  const match = heldIn(held.match);

  return {
    id: kept.id,
    address: HookAddress.of(teamKey, HookKey.of(kept.key)).toString(),
    teamId: kept.teamId,
    key: kept.key,
    on: String(held.on ?? ''),
    match: {
      tools: textsIn(match.tools),
      lines: textsIn(match.lines),
      stations: textsIn(match.stations),
      repositories: textsIn(match.repositories),
      paths: textsIn(match.paths),
    },
    when: typeof held.when === 'string' ? held.when : null,
    vars: textsBy(held.vars),
    steps: (Array.isArray(held.steps) ? held.steps : [])
      .filter(isHeld)
      .map(stepOf),
    signing: signingOf(held.signing),
    failure: typeof held.failure === 'string' ? held.failure : null,
    timeoutSeconds:
      typeof held.timeoutSeconds === 'number' ? held.timeoutSeconds : null,
  };
};

export class HeldHooks implements HeldHooksPort {
  constructor(
    private readonly resources: HookResourcesPort,
    private readonly teams: TeamDirectoryPort,
  ) {}

  async withId(id: string): Promise<HeldHook | null> {
    const kept = await this.resources.withId(id);
    const team = kept && (await this.teams.find(kept.teamId));

    return kept && team ? heldOn(team.key, kept) : null;
  }

  async ofTeam(teamId: TeamId): Promise<readonly HeldHook[]> {
    const team = await this.teams.find(teamId);

    return team
      ? (await this.resources.ofTeam(teamId)).map((each) =>
          heldOn(team.key, each),
        )
      : [];
  }
}
