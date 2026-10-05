import {
  Hook,
  type HookOnFailure,
} from '@integrations/domain/entities/hook.entity';
import { InvalidHookError } from '@integrations/domain/exceptions/invalid-hook.error';
import { ApprovalNeeded } from '@integrations/domain/value-objects/approval-needed.vo';
import { HookEvent } from '@integrations/domain/value-objects/hook-event.vo';
import { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import { HookVerdict } from '@integrations/domain/value-objects/hook-verdict.vo';
import { OfferedTool } from '@integrations/domain/value-objects/offered-tool.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { ToolBacking } from '@integrations/domain/value-objects/tool-backing.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { describe, expect, it } from 'vitest';

const COMMENT = ToolName.of('linear.comment');

const hook = (failure: HookOnFailure = 'continue') =>
  Hook.of({
    key: HookKey.of('dba'),
    event: HookEvent.of('tool.using'),
    match: { tools: [COMMENT, ToolName.of('linear.comment')], paths: [] },
    steps: [
      { name: 'tell', kind: 'call', tool: COMMENT },
      {
        name: 'ask',
        kind: 'request',
        url: new URL('https://dba.acme.dev/review'),
        fromNetwork: false,
      },
      {
        name: 'audit',
        kind: 'request',
        url: null,
        fromNetwork: true,
      },
    ],
    signing: 'hmac',
    failure,
    timeoutSeconds: Hook.DEFAULTS.timeoutSeconds,
  });

const offered = (approval: ApprovalNeeded | null = null) =>
  OfferedTool.of({
    source: SourceKey.of('linear'),
    name: 'comment',
    description: 'Comment on the issue.',
    backing: ToolBacking.action('comment'),
    approval,
  });

describe('Hook', () => {
  it('names each tool it uses once, in order', () => {
    expect(hook().tools.map((tool) => tool.value)).toEqual(['linear.comment']);
    expect(hook().matchedTools).toHaveLength(1);
  });

  it('continues on failure and waits ten seconds unless written otherwise', () => {
    expect(Hook.DEFAULTS).toEqual({ failure: 'continue', timeoutSeconds: 10 });
  });

  it('refuses a plain http request unless it is sent from the team’s network', () => {
    expect(() =>
      Hook.of({
        key: HookKey.of('dba'),
        event: HookEvent.of('tool.using'),
        match: { tools: [], paths: [] },
        steps: [
          {
            name: 'ask',
            kind: 'request',
            url: new URL('http://dba.acme.dev'),
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
    it('may call a tool the team offers without asking anyone', () => {
      expect(hook().refusalToCall(COMMENT, offered())).toBeNull();
    });

    it('may not call a tool no integration offers now', () => {
      expect(hook().refusalToCall(COMMENT, null)).toMatchObject({
        code: 'not-allowed',
        reason:
          'names linear.comment, which no integration of the team offers now',
      });
    });

    it('may not call a tool that asks a person before each call', () => {
      const asking = offered(
        ApprovalNeeded.of({ because: 'it writes to customers' }, 'comment'),
      );

      expect(hook().refusalToCall(COMMENT, asking)).toMatchObject({
        code: 'not-allowed',
        reason:
          "calls linear.comment, which asks a person's approval before each call, and a hook cannot give it",
      });
    });
  });

  describe('making a request', () => {
    it('may send over https', () => {
      expect(
        hook().refusalToRequest('ask', new URL('https://dba.acme.dev')),
      ).toBeNull();
    });

    it('may not send in the clear from Spotlight, once its url is written out', () => {
      expect(
        hook().refusalToRequest('ask', new URL('http://dba.acme.dev')),
      ).toMatchObject({
        code: 'not-allowed',
        reason: 'sends to http://dba.acme.dev, which is not https',
      });
    });

    it('may send in the clear from the team’s own network', () => {
      expect(
        hook().refusalToRequest('audit', new URL('http://audit.internal')),
      ).toBeNull();
    });
  });

  describe('judging an event before it happens', () => {
    it('lets the next step go on after a step that did its work', () => {
      expect(
        hook('block').verdictOn('ask', { refusal: null, failedBecause: null }),
      ).toBeNull();
    });

    it('refuses what an endpoint refused', () => {
      expect(
        hook().verdictOn('ask', {
          refusal: 'the migration drops a column',
          failedBecause: null,
        }),
      ).toEqual(
        HookVerdict.refused(
          'The hook dba refused: the migration drops a column',
        ),
      );
    });

    it('refuses the event when a step fails and the hook blocks on failure', () => {
      expect(
        hook('block').verdictOn('ask', {
          refusal: null,
          failedBecause: 'was answered 503',
        }),
      ).toEqual(
        HookVerdict.refused(
          'The hook dba failed at ask (was answered 503), and it blocks on failure',
        ),
      );
    });

    it('lets the event go on when a step fails and the hook continues', () => {
      expect(
        hook('continue').verdictOn('ask', {
          refusal: null,
          failedBecause: 'was answered 503',
        }),
      ).toEqual(HookVerdict.allowed());
    });
  });
});
