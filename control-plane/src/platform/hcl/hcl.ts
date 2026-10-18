// biome-ignore lint/suspicious/noTemplateCurlyInString: a Terraform interpolation
const MODULE_PATH = '${path.module}';

export class HclExpression {
  private constructor(readonly sourceText: string) {}

  static verbatim(sourceText: string): HclExpression {
    return new HclExpression(sourceText);
  }

  static traversal(...names: readonly string[]): HclExpression {
    return new HclExpression(names.join('.'));
  }

  static indexed(of: HclExpression, key: string): HclExpression {
    return new HclExpression(`${of.sourceText}["${escapedLiteral(key)}"]`);
  }

  static moduleFile(path: string): HclExpression {
    return new HclExpression(`file("${MODULE_PATH}/${escapedLiteral(path)}")`);
  }

  static template(
    ...parts: readonly (string | HclExpression)[]
  ): HclExpression {
    return new HclExpression(
      `"${parts
        .map((part) =>
          part instanceof HclExpression
            ? `\${${part.sourceText}}`
            : escapedLiteral(part),
        )
        .join('')}"`,
    );
  }
}

export class HclLines {
  private constructor(readonly items: readonly HclValue[]) {}

  static of(items: readonly HclValue[]): HclLines {
    return new HclLines(items);
  }
}

export type HclValue =
  | HclLines
  | string
  | number
  | boolean
  | null
  | HclExpression
  | readonly HclValue[]
  | { readonly [key: string]: HclValue };

export interface HclAttribute {
  readonly kind: 'attribute';
  readonly name: string;
  readonly value: HclValue;
}

export interface HclBlock {
  readonly kind: 'block';
  readonly type: string;
  readonly labels: readonly string[];
  readonly body: readonly HclItem[];
}

export type HclItem = HclAttribute | HclBlock;

export const attribute = (name: string, value: HclValue): HclAttribute => ({
  kind: 'attribute',
  name,
  value,
});

export const block = (
  type: string,
  labels: readonly string[],
  body: readonly HclItem[],
): HclBlock => ({ kind: 'block', type, labels, body });

const ESCAPED: Readonly<Record<string, string>> = {
  '${': '$${',
  '%{': '%%{',
  '\\': '\\\\',
  '"': '\\"',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
};

// biome-ignore lint/suspicious/noControlCharactersInRegex: HCL escapes control characters
const NEEDS_ESCAPE = /\$\{|%\{|[\\"\u0000-\u001f\u007f]/g;

const escapedLiteral = (text: string): string =>
  text.replace(
    NEEDS_ESCAPE,
    (found) =>
      ESCAPED[found] ??
      `\\u${found.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );

export const quoted = (text: string): string => `"${escapedLiteral(text)}"`;

export const withoutInterpolation = (text: string): string =>
  text.replace(/\$\{|%\{/g, (found) => ESCAPED[found] ?? found);
