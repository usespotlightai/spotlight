import { InvalidHookError } from '@integrations/domain/exceptions/invalid-hook.error';
import { ActsAs } from '@integrations/domain/value-objects/acts-as.vo';
import { ApprovalNeeded } from '@integrations/domain/value-objects/approval-needed.vo';
import {
  Hook,
  type HookOnFailure,
} from '@integrations/domain/value-objects/hook.vo';
import { HookDecision } from '@integrations/domain/value-objects/hook-decision.vo';
import { HookEvent } from '@integrations/domain/value-objects/hook-event.vo';
import { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import { HookMatch } from '@integrations/domain/value-objects/hook-match.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { ProvidedTool } from '@integrations/domain/value-objects/provided-tool.vo';
import { ToolBacking } from '@integrations/domain/value-objects/tool-backing.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { describe, expect, it } from 'vitest';

const COMMENT = ToolName.of('linear.comment');

const hook = (failure: HookOnFailure = 'continue') =>
  Hook.of({
    key: HookKey.of('dba'),
    event: HookEvent.of('tool.using'),
    match: HookMatch.of(
      {
        tools: [COMMENT, ToolName.of('linear.comment')],
        lines: [],
        stations: [],
        repositories: [],
        paths: [],
      },
      HookEvent.of('tool.using'),
    ),
    steps: [
      { name: 'tell', kind: 'call', tool: COMMENT },
      {
        name: 'check',
        kind: 'request',
        url: new URL('https://dba.acme.dev/review'),
        headers: [],
        fromNetwork: false,
      },
      {
        name: 'audit',
        kind: 'request',
        url: null,
        headers: [],
        fromNetwork: true,
      },
    ],
    signing: 'hmac',
    failure,
    timeoutSeconds: Hook.DEFAULTS.timeoutSeconds,
  });

const provided = (approval: ApprovalNeeded | null = null) =>
  ProvidedTool.of({
    integration: IntegrationKey.of('linear'),
    name: 'comment',
    description: 'Comment on the issue.',
    backing: ToolBacking.action('comment'),
    approval,
  });

describe('Hook', () => {
  it('names each tool it uses once, in order', () => {
    expect(hook().tools.map((tool) => tool.value)).toEqual(['linear.comment']);
    expect(hook().match.tools).toHaveLength(1);
  });

  it('refuses a match written for another event', () => {
    expect(() =>
      Hook.of({
        key: HookKey.of('dba'),
        event: HookEvent.of('tool.using'),
        match: HookMatch.anything(HookEvent.of('run.ended')),
        steps: [{ name: 'tell', kind: 'call', tool: COMMENT }],
        signing: null,
        failure: 'continue',
        timeoutSeconds: 10,
      }),
    ).toThrow(InvalidHookError);
  });

  it('matches what its match names', () => {
    const task = {
      line: LineKey.of('delivery'),
      stationKey: StationKey.of('build'),
      repositories: [],
    };

    expect(hook().matches(task, { tool: 'linear.comment' })).toBe(true);
    expect(hook().matches(task, { tool: 'linear.search' })).toBe(false);
  });

  it('gives each step its own timeout, within the budget it is given', () => {
    const now = new Date('2026-09-26T10:00:00.000Z');

    expect(hook().deadlineFrom(now, null)).toEqual(
      new Date(now.getTime() + 10_000),
    );
    expect(hook().deadlineFrom(now, new Date(now.getTime() + 3_000))).toEqual(
      new Date(now.getTime() + 3_000),
    );
    expect(hook().deadlineFrom(now, new Date(now.getTime() + 60_000))).toEqual(
      new Date(now.getTime() + 10_000),
    );
  });

  it('continues on failure, waits ten seconds and sends from Spotlight unless written otherwise', () => {
    expect(Hook.DEFAULTS).toEqual({
      failure: 'continue',
      timeoutSeconds: 10,
      from: 'spotlight',
    });
  });

  it('refuses a request header Spotlight sets itself', () => {
    expect(() =>
      Hook.of({
        key: HookKey.of('dba'),
        event: HookEvent.of('run.ended'),
        match: HookMatch.anything(HookEvent.of('run.ended')),
        steps: [
          {
            name: 'tell',
            kind: 'request',
            url: new URL('https://dba.example.com'),
            headers: ['x-team', 'Webhook-Signature'],
            fromNetwork: false,
          },
        ],
        signing: 'hmac',
        failure: 'continue',
        timeoutSeconds: 10,
      }),
    ).toThrow(InvalidHookError);
  });

  it('denies a plain http request unless it is sent from the team’s network', () => {
    expect(() =>
      Hook.of({
        key: HookKey.of('dba'),
        event: HookEvent.of('tool.using'),
        match: HookMatch.anything(HookEvent.of('tool.using')),
        steps: [
          {
            name: 'check',
            kind: 'request',
            url: new URL('http://dba.acme.dev'),
            headers: [],
            fromNetwork: false,
          },
        ],
        signing: 'hmac',
        failure: 'continue',
        timeoutSeconds: 10,
      }),
    ).toThrow(InvalidHookError);
  });

  describe('calling a tool', () => {
    it('may call a tool the team offers without approval from anyone', () => {
      expect(hook().callDenial(COMMENT, provided(), ActsAs.team())).toBeNull();
    });

    it('may not call a tool no integration offers now', () => {
      expect(hook().callDenial(COMMENT, null, null)).toMatchObject({
        code: 'not-allowed',
        reason:
          'names linear.comment, which no integration of the team offers now',
      });
    });

    it('may not call a tool that asks a person before each call', () => {
      const needsApproval = provided(
        ApprovalNeeded.of({ because: 'it writes to customers' }, 'comment'),
      );

      expect(
        hook().callDenial(COMMENT, needsApproval, ActsAs.team()),
      ).toMatchObject({
        code: 'not-allowed',
        reason:
          "calls linear.comment, which needs a person's approval before each call. A hook cannot approve the call",
      });
    });

    it('may not call a tool that acts as the person who started a task', () => {
      expect(
        hook().callDenial(COMMENT, provided(), ActsAs.requester()),
      ).toMatchObject({
        code: 'not-allowed',
        reason:
          'names linear.comment, which acts as the person who started a task. A hook acts as nobody',
      });
    });
  });

  describe('making a request', () => {
    it('may send over https', () => {
      expect(
        hook().requestDenial('check', new URL('https://dba.acme.dev')),
      ).toBeNull();
    });

    it('may not send in the clear from Spotlight, once its url is written out', () => {
      expect(
        hook().requestDenial('check', new URL('http://dba.acme.dev')),
      ).toMatchObject({
        code: 'not-allowed',
        reason: 'sends to http://dba.acme.dev, which is not https',
      });
    });

    it('may send in the clear from the team’s own network', () => {
      expect(
        hook().requestDenial('audit', new URL('http://audit.internal')),
      ).toBeNull();
    });
  });

  describe('judging an event before it happens', () => {
    it('lets the next step go on after a step that did its work', () => {
      expect(
        hook('block').decisionOn('check', {
          denyReason: null,
          failedBecause: null,
        }),
      ).toBeNull();
    });

    it('denies what an endpoint denied', () => {
      expect(
        hook().decisionOn('check', {
          denyReason: 'the migration drops a column',
          failedBecause: null,
        }),
      ).toEqual(
        HookDecision.denied(
          'Hook dba denied the event. Reason: the migration drops a column',
        ),
      );
    });

    it('denies the event when a step fails and the hook blocks on failure', () => {
      expect(
        hook('block').decisionOn('check', {
          denyReason: null,
          failedBecause: 'was answered 503',
        }),
      ).toEqual(
        HookDecision.denied(
          'Hook dba failed at step check and blocks on failure. Reason: was answered 503',
        ),
      );
    });

    it('lets the event go on when a step fails and the hook continues', () => {
      expect(
        hook('continue').decisionOn('check', {
          denyReason: null,
          failedBecause: 'was answered 503',
        }),
      ).toEqual(HookDecision.allowed());
    });
  });
});
