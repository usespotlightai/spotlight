import {
  HookDefinition,
  type SecretGiven,
} from '@integrations/domain/aggregates/hook-definition.aggregate';
import { Hook } from '@integrations/domain/entities/hook.entity';
import { HookDefined } from '@integrations/domain/events/hook-defined.event';
import { HookRedefined } from '@integrations/domain/events/hook-redefined.event';
import { HookRetired } from '@integrations/domain/events/hook-retired.event';
import { HookDefinitionMovedOnError } from '@integrations/domain/exceptions/hook-definition-moved-on.error';
import { HookKeyFixedError } from '@integrations/domain/exceptions/hook-key-fixed.error';
import { InvalidHookError } from '@integrations/domain/exceptions/invalid-hook.error';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import { HookEvent } from '@integrations/domain/value-objects/hook-event.vo';
import { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import { HookSigningSecret } from '@integrations/domain/value-objects/hook-signing-secret.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { DefinitionDocument } from '@shared-kernel/domain/value-objects/definition-document.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');

const WORKSPACE = WorkspaceId.of('workspace_1');

const ID = HookDefinitionId.of('hook_1');

const BY = attributedIn();

const secret = (fill: string) =>
  HookSigningSecret.of(
    `whsec_${Buffer.from(fill.repeat(32)).toString('base64')}`,
  );

const hook = ({
  key = 'grafana-reads',
  tools = ['grafana.search'],
  signing = 'hmac' as 'hmac' | 'oidc' | null,
} = {}) =>
  Hook.of({
    key: HookKey.of(key),
    event: HookEvent.of('tool.used'),
    match: { tools, paths: [] },
    steps: [
      { name: 'notify', kind: 'call', tool: 'slack.post-message' },
      {
        name: 'audit',
        kind: 'request',
        url: new URL('https://audit.example.com'),
        fromNetwork: false,
      },
    ],
    signing,
    failure: 'continue',
    timeoutSeconds: 10,
  });

const compiled = (options: Parameters<typeof hook>[0] = {}) => ({
  hook: hook(options),
  document: DefinitionDocument.of({ key: options.key ?? 'grafana-reads' }),
});

const given = (fill: string, version: number): SecretGiven => ({
  kind: 'given',
  held: { secret: secret(fill), version },
});

const OFFERED = {
  offered: ['grafana.search', 'slack.post-message'],
  signsTokens: false,
  allowsHost: (host: string) => host.endsWith('example.com'),
};

const defined = () =>
  HookDefinition.define({
    ...compiled(),
    id: ID,
    workspaceId: WORKSPACE,
    teamId: TEAM,
    secret: given('a', 1),
    allowances: OFFERED,
    by: BY,
  });

const standing = (version = 3) =>
  HookDefinition.rehydrate({
    id: ID,
    workspaceId: WORKSPACE,
    teamId: TEAM,
    key: HookKey.of('grafana-reads'),
    event: HookEvent.of('tool.used'),
    document: DefinitionDocument.of({ key: 'grafana-reads' }),
    tools: ['grafana.search', 'slack.post-message'],
    signing: { version: 1 },
    version,
  });

const CHANGED = {
  resource: 'hook' as const,
  id: ID.value,
  key: 'grafana-reads',
};

describe('HookDefinition', () => {
  it('is defined with the tools it uses and its secret to seal', () => {
    const hook = defined();

    expect(hook.tools).toEqual(['grafana.search', 'slack.post-message']);
    expect(hook.signing).toEqual({ version: 1 });
    expect(hook.givenSecret?.equals(secret('a'))).toBe(true);
    expect(hook.pullEvents()).toEqual([
      new HookDefined(
        ID,
        TEAM,
        HookKey.of('grafana-reads'),
        ConfigurationChange.created(CHANGED, BY),
      ),
    ]);
  });

  it('refuses a tool it calls that no integration offers, at that step', () => {
    try {
      HookDefinition.define({
        ...compiled(),
        id: ID,
        workspaceId: WORKSPACE,
        teamId: TEAM,
        secret: given('a', 1),
        allowances: { ...OFFERED, offered: ['grafana.search'] },
        by: BY,
      });
      expect.unreachable();
    } catch (error) {
      expect((error as InvalidHookError).at.rendered).toBe('steps[0].call');
    }
  });

  it('refuses a request to a host this Spotlight does not call', () => {
    expect(() =>
      HookDefinition.define({
        ...compiled(),
        id: ID,
        workspaceId: WORKSPACE,
        teamId: TEAM,
        secret: given('a', 1),
        allowances: { ...OFFERED, allowsHost: () => false },
        by: BY,
      }),
    ).toThrow(/audit.example.com, which is not among the hosts/);
  });

  it('refuses OIDC signing where no key signs tokens', () => {
    expect(() =>
      HookDefinition.define({
        ...compiled({ signing: 'oidc' }),
        id: ID,
        workspaceId: WORKSPACE,
        teamId: TEAM,
        secret: { kind: 'none' },
        allowances: OFFERED,
        by: BY,
      }),
    ).toThrow(/no key to sign them/);
  });

  it('refuses a tool no integration of the team offers', () => {
    expect(() =>
      HookDefinition.define({
        ...compiled({ tools: ['grafana.search', 'grafana.gone'] }),
        id: ID,
        workspaceId: WORKSPACE,
        teamId: TEAM,
        secret: given('a', 1),
        allowances: OFFERED,
        by: BY,
      }),
    ).toThrow(InvalidHookError);
  });

  it('needs its secret when it signs with HMAC', () => {
    expect(() =>
      HookDefinition.define({
        ...compiled(),
        id: ID,
        workspaceId: WORKSPACE,
        teamId: TEAM,
        secret: { kind: 'none' },
        allowances: OFFERED,
        by: BY,
      }),
    ).toThrow(/is given its secret/);
  });

  it('keeps its secret when redefined at the same version', () => {
    const redefined = standing().redefinedAs(
      compiled(),
      { kind: 'kept', version: 1 },
      OFFERED,
      BY,
    );

    expect(redefined.signing).toEqual({ version: 1 });
    expect(redefined.givenSecret).toBeNull();
    expect(redefined.pullEvents()).toEqual([
      new HookRedefined(
        ID,
        TEAM,
        HookKey.of('grafana-reads'),
        ConfigurationChange.updated(CHANGED, BY),
      ),
    ]);
  });

  it('takes a new secret when its version moves', () => {
    const redefined = standing().redefinedAs(
      compiled(),
      given('b', 2),
      OFFERED,
      BY,
    );

    expect(redefined.signing).toEqual({ version: 2 });
    expect(redefined.givenSecret?.equals(secret('b'))).toBe(true);
  });

  it('refuses a moved version without its new secret', () => {
    expect(() =>
      standing().redefinedAs(
        compiled(),
        { kind: 'kept', version: 2 },
        OFFERED,
        BY,
      ),
    ).toThrow(/new version needs its secret/);
  });

  it('forgets its secret when it stops signing with HMAC', () => {
    const redefined = standing().redefinedAs(
      compiled({ signing: 'oidc' }),
      { kind: 'none' },
      { ...OFFERED, signsTokens: true },
      BY,
    );

    expect(redefined.signing).toBeNull();
  });

  it('keeps its key for life', () => {
    expect(() =>
      standing().redefinedAs(
        compiled({ key: 'other' }),
        { kind: 'none' },
        OFFERED,
        BY,
      ),
    ).toThrow(HookKeyFixedError);
  });

  it('refuses a stale version', () => {
    expect(() => standing(3).expecting(2)).toThrow(HookDefinitionMovedOnError);
  });

  it('is retired once', () => {
    const retired = standing().retired(BY);

    expect(retired.isRetired).toBe(true);
    expect(retired.pullEvents()).toEqual([
      new HookRetired(
        ID,
        TEAM,
        HookKey.of('grafana-reads'),
        ConfigurationChange.deleted(CHANGED, BY),
      ),
    ]);
    expect(() => retired.retired(BY)).toThrow(InconsistentStateError);
  });
});
