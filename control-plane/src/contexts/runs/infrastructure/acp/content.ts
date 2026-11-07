export type Content =
  | { text?: string }
  | {
      type?: string;
      path?: string;
      oldText?: string;
      newText?: string;
      content?: { text?: string };
    }[];

export const diffIn = (content: Content | undefined) =>
  Array.isArray(content)
    ? content.find((each) => each?.type === 'diff')
    : undefined;
