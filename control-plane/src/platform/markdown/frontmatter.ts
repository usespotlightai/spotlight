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
