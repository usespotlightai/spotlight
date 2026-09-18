const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/;

export interface Fronted {
  readonly front: string;
  readonly body: string;
}

export const splitFrontmatter = (text: string): Fronted | null => {
  const matched = FRONTMATTER.exec(text);

  return matched
    ? { front: matched[1] as string, body: matched[2] as string }
    : null;
};

const endingInNewline = (text: string): string =>
  text.endsWith('\n') ? text : `${text}\n`;

export const joinFrontmatter = ({ front, body }: Fronted): string => {
  const head = `---\n${endingInNewline(front)}---\n`;

  return body ? `${head}\n${endingInNewline(body)}` : head;
};
