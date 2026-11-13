import { actionNamed } from '@integrations/domain/value-objects/action.fake-spec';
import { ActsAs } from '@integrations/domain/value-objects/acts-as.vo';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import { DefinedActions } from '@integrations/domain/value-objects/defined-actions.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { Integration } from '@integrations/domain/value-objects/integration.vo';
import { MarkKind } from '@integrations/domain/value-objects/mark-kind.vo';
import { OfferedTools } from '@integrations/domain/value-objects/offered-tools.vo';
import { ProvidedTool } from '@integrations/domain/value-objects/provided-tool.vo';
import { ToolBacking } from '@integrations/domain/value-objects/tool-backing.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { describe, expect, it } from 'vitest';

const LINEAR = IntegrationKey.of('linear');
const COMMENT = ToolName.of('linear.comment');
const SEARCH = ToolName.of('linear.search');
const HASH = ContentHash.of('a'.repeat(64));
const OTHER_HASH = ContentHash.of('b'.repeat(64));

const tool = (name: string, backing: ToolBacking) =>
  ProvidedTool.of({ integration: LINEAR, name, description: name, backing });

const integration = (actsAs = ActsAs.team()) =>
  Integration.of({
    key: LINEAR,
    actions: DefinedActions.of([actionNamed('post')]),
    apiSpecs: ['openapi'],
    connectsOver: 'oauth2',
    actsAs,
    writtenTools: [tool('comment', ToolBacking.action('post'))],
  });

describe('OfferedTools', () => {
  it('offers the written and the generated tools of one compile', () => {
    const offered = OfferedTools.generatedFor(integration(), [
      tool('search', ToolBacking.operation(HASH, 'search')),
    ]);

    expect(offered.all.map((each) => each.value)).toEqual([
      'linear.comment',
      'linear.search',
    ]);
    expect(offered.generatedFrom).toEqual(HASH);
    expect(offered.generatedCount).toBe(1);
  });

  it('refuses generated tools from two fetches, or named like a written one', () => {
    expect(() =>
      OfferedTools.generatedFor(integration(), [
        tool('search', ToolBacking.operation(HASH, 'search')),
        tool('find', ToolBacking.operation(OTHER_HASH, 'find')),
      ]),
    ).toThrow(/two fetches/);
    expect(() =>
      OfferedTools.generatedFor(integration(), [
        tool('comment', ToolBacking.operation(HASH, 'comment')),
      ]),
    ).toThrow(/more than once/);
  });

  it('gives the same tools when rebuilt from what the definition lists', () => {
    const compiled = OfferedTools.generatedFor(integration(), [
      tool('search', ToolBacking.operation(HASH, 'search')),
    ]);
    const listed = OfferedTools.listed(integration(), compiled.all, HASH);

    expect(listed.all).toEqual(compiled.all);
    expect(listed.generatedCount).toBe(compiled.generatedCount);
  });

  it('finds where a listed tool comes from', () => {
    const listed = OfferedTools.listed(integration(), [COMMENT, SEARCH], HASH);

    expect(listed.sourceOf(COMMENT)).toEqual({
      kind: 'written',
      tool: integration().writtenTools[0],
    });
    expect(listed.sourceOf(SEARCH)).toEqual({ kind: 'generated', from: HASH });
    expect(
      OfferedTools.listed(integration(), [], HASH).sourceOf(COMMENT).kind,
    ).toBe('none');
    expect(
      OfferedTools.listed(integration(), [SEARCH], null).sourceOf(SEARCH).kind,
    ).toBe('none');
  });

  it('takes a person rule for every offered tool of an integration that acts as the requester, generated ones too', () => {
    const acting = OfferedTools.listed(
      integration(ActsAs.requester()),
      [COMMENT, SEARCH],
      HASH,
    );
    const team = OfferedTools.listed(integration(), [COMMENT, SEARCH], HASH);

    expect(acting.takesPersonRuleFor(COMMENT)).toBe(true);
    expect(acting.takesPersonRuleFor(SEARCH)).toBe(true);
    expect(acting.takesPersonRuleFor(ToolName.of('linear.other'))).toBe(false);
    expect(team.takesPersonRuleFor(COMMENT)).toBe(false);
  });

  it('names the written tools enabled on any of the mark kinds', () => {
    const offered = OfferedTools.generatedFor(
      Integration.of({
        key: LINEAR,
        actions: DefinedActions.of([actionNamed('post')]),
        writtenTools: [
          ProvidedTool.of({
            integration: LINEAR,
            name: 'comment',
            description: 'comment',
            backing: ToolBacking.action('post'),
            enabledOnMark: MarkKind.of('linear.issue'),
          }),
          tool('close', ToolBacking.action('post')),
        ],
      }),
      [],
    );

    expect(
      offered
        .enabledOnMarks([
          MarkKind.of('git.pull-request'),
          MarkKind.of('linear.issue'),
        ])
        .map((each) => each.value),
    ).toEqual(['linear.comment']);
    expect(offered.enabledOnMarks([MarkKind.of('linear.team')])).toEqual([]);
  });
});
