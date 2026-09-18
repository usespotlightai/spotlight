export function messageOf(
  thrown: unknown,
  fallback = 'Something went wrong',
): string {
  if (typeof thrown === 'string') {
    return thrown;
  }

  if (typeof thrown === 'object' && thrown !== null && 'message' in thrown) {
    const said = (thrown as { message: unknown }).message;

    if (typeof said === 'string' && said.length > 0) {
      return said;
    }
    if (Array.isArray(said) && typeof said[0] === 'string') {
      return said[0];
    }
  }

  return fallback;
}
