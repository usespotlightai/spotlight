import { attribute, block, HclExpression, HclLines } from '@platform/hcl/hcl';
import { formatHcl } from '@platform/hcl/hcl.format';
import {
  evaluatedByTerraform,
  formattedByTerraform,
  TERRAFORM_INSTALLED,
} from '@platform/hcl/terraform-cli.fake-spec';
import { describe, expect, it } from 'vitest';

const DOCUMENT = {
  name: 'Example',
  'Content-Type': 'application/json',
  'api.example.io': true,
  for: 1,
  nothing: null,
  empty: {},
  none: [],
  // biome-ignore lint/suspicious/noTemplateCurlyInString: HCL interpolation, written literally
  expression: 'a ${{ event.issue }} %{ if } \\ " \u0001 \t \r\n end',
  // biome-ignore lint/suspicious/noTemplateCurlyInString: HCL interpolation, written literally
  description: 'Comment on an issue ${x}\n  when %{y} asks\n\tso\nEOT\n',
  trailing: 'one line\n',
  list: ['a', 'b\nc', 1, false, {}, []],
  nested: [
    { z: 1, zz: { deep: 'x', deeper: 'more\nlines\n' } },
    'plain',
    [1, 2],
  ],
};

const WRITTEN = {
  document: formatHcl([block('locals', [], [attribute('document', DOCUMENT)])]),
  aligned: formatHcl([
    block(
      'resource',
      ['example_group', 'core'],
      [
        attribute(
          'account_id',
          HclExpression.traversal('example_account', 'main', 'id'),
        ),
        attribute('key', 'core'),
        attribute('name', 'Core'),
      ],
    ),
  ]),
  spaced: formatHcl([
    block(
      'resource',
      ['example_pipeline', 'main_flow'],
      [
        attribute('key', 'delivery'),
        attribute('repositories', ['org/api', 'org/web']),
        attribute('reviews', { start: 'opened', mention: '@bot' }),
        attribute('name', 'Delivery'),
        block('step', [], [attribute('key', 'backlog')]),
        block('step', [], []),
      ],
    ),
    block('import', [], [attribute('id', 'x')]),
  ]),
  heredoc: formatHcl([
    block(
      'locals',
      [],
      [
        attribute('a', 1),
        // biome-ignore lint/suspicious/noTemplateCurlyInString: HCL interpolation, written literally
        attribute('description', 'Two\nlines ${not} %{this}\n'),
        attribute('bb', 2),
      ],
    ),
  ]),
  marker: formatHcl([
    block('locals', [], [attribute('text', 'a\n  EOT\nb\n')]),
  ]),
  escaped: formatHcl([
    // biome-ignore lint/suspicious/noTemplateCurlyInString: HCL interpolation, written literally
    block('locals', [], [attribute('text', '${a} %{b} "c" \\ \t\u0001')]),
  ]),
  file: formatHcl([
    block(
      'locals',
      [],
      [attribute('prompt', HclExpression.moduleFile('files/core/"x".md'))],
    ),
  ]),
  template: formatHcl([
    block(
      'locals',
      [],
      [
        attribute('tools', [
          HclExpression.template(
            HclExpression.traversal(
              'example_integration',
              'main_feed',
              'integration',
            ),
            // biome-ignore lint/suspicious/noTemplateCurlyInString: HCL interpolation, written literally
            '.comment "${x}"',
          ),
        ]),
      ],
    ),
  ]),
};

describe('formatHcl', () => {
  it('aligns the equals signs of consecutive one-line attributes', () => {
    expect(WRITTEN.aligned).toBe(
      [
        'resource "example_group" "core" {',
        '  account_id = example_account.main.id',
        '  key        = "core"',
        '  name       = "Core"',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('breaks the alignment at a value that spans lines, and sets blocks apart', () => {
    expect(WRITTEN.spaced).toBe(
      [
        'resource "example_pipeline" "main_flow" {',
        '  key          = "delivery"',
        '  repositories = ["org/api", "org/web"]',
        '  reviews = {',
        '    start   = "opened"',
        '    mention = "@bot"',
        '  }',
        '  name = "Delivery"',
        '',
        '  step {',
        '    key = "backlog"',
        '  }',
        '',
        '  step {}',
        '}',
        '',
        'import {',
        '  id = "x"',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('writes text that ends a line as a heredoc, keeping it in the alignment', () => {
    expect(WRITTEN.heredoc).toBe(
      [
        'locals {',
        '  a           = 1',
        '  description = <<EOT',
        'Two',
        'lines $${not} %%{this}',
        'EOT',
        '  bb          = 2',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('writes a list set to span lines one item to a line, even where each fits on one', () => {
    expect(
      formatHcl([
        block(
          'judge',
          [],
          [
            attribute('claims', HclLines.of(['It adds a test.', 'Two.'])),
            attribute('pass_threshold', 0.5),
            attribute('sample', 0.2),
          ],
        ),
      ]),
    ).toBe(
      'judge {\n  claims = [\n    "It adds a test.",\n    "Two.",\n  ]\n  pass_threshold = 0.5\n  sample         = 0.2\n}\n',
    );
  });

  it('picks a heredoc marker the text does not contain', () => {
    expect(WRITTEN.marker).toContain('text = <<EOT1\na\n  EOT\nb\nEOT1\n');
  });

  it('escapes what a quoted string cannot contain, and interpolation', () => {
    expect(WRITTEN.escaped).toContain(
      'text = "$${a} %%{b} \\"c\\" \\\\ \\t\\u0001"',
    );
  });

  it('quotes keys that are not plain names', () => {
    expect(WRITTEN.document).toContain('    "api.example.io" = true');
    expect(WRITTEN.document).toContain('    "for"            = 1');
    expect(WRITTEN.document).toContain(
      '    Content-Type     = "application/json"',
    );
  });

  it('reads a file beside the module', () => {
    expect(WRITTEN.file).toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: HCL interpolation, written literally
      'prompt = file("${path.module}/files/core/\\"x\\".md")',
    );
  });

  it('interpolates an expression into text, escaping the text around it', () => {
    expect(WRITTEN.template).toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: HCL interpolation, written literally
      'tools = ["${example_integration.main_feed.integration}.comment \\"$${x}\\""]',
    );
  });

  describe.skipIf(!TERRAFORM_INSTALLED)('checked by terraform', () => {
    it.each(Object.entries(WRITTEN))(
      'writes the %s already formatted as terraform fmt would',
      (_, written) => {
        expect(formattedByTerraform(written)).toBe(written);
      },
    );

    it('evaluates to exactly the value it was given', () => {
      expect(evaluatedByTerraform(WRITTEN.document, 'local.document')).toEqual(
        DOCUMENT,
      );
    });
  });
});
