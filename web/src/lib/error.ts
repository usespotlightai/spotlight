export function messageOf(
  thrown: unknown,
  fallback = 'Sorry, the request failed.',
): string {
  if (typeof thrown === 'string') {
    return thrown;
  }

  if (typeof thrown === 'object' && thrown !== null && 'message' in thrown) {
    const body = (thrown as { message: unknown }).message;

    if (typeof body === 'string' && body.length > 0) {
      return body;
    }
    if (Array.isArray(body) && typeof body[0] === 'string') {
      return body[0];
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
  const body = thrown as { statusCode?: unknown; status?: unknown } | null;

  return body?.statusCode === status || body?.status === status;
};

export const notFound = (thrown: unknown): boolean => answered(thrown, 404);
