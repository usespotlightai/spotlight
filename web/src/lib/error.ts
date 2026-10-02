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

  if (typeof thrown === 'object' && thrown !== null && 'detail' in thrown) {
    const detail = (thrown as { detail: unknown }).detail;

    if (typeof detail === 'string' && detail.length > 0) {
      return detail;
    }
  }

  return fallback;
}

const answered = (thrown: unknown, status: number): boolean => {
  const said = thrown as { statusCode?: unknown; status?: unknown } | null;

  return said?.statusCode === status || said?.status === status;
};

export const notFound = (thrown: unknown): boolean => answered(thrown, 404);

export const conflicted = (thrown: unknown): boolean => answered(thrown, 409);
