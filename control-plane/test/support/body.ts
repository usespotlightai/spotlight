export const bodyOf = <T>(response: { readonly body: unknown }): T =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  response.body as T;

export const parsedAs = <T>(text: string): T =>
  bodyOf<T>({ body: JSON.parse(text) });
