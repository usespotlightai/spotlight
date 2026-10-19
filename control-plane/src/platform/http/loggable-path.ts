const SECRET_PARAM = /token|secret/i;

type Loggable = {
  readonly url?: string;
  readonly route?: { readonly path?: unknown };
};

export function loggablePath(request: Loggable): string | undefined {
  const path = request.url?.split(/[?#]/, 1)[0];
  const route = request.route?.path;

  if (!path || typeof route !== 'string') {
    return path;
  }

  const pattern = route.split('/');
  const segments = path.split('/');

  if (pattern.length !== segments.length) {
    return path;
  }

  return segments
    .map((segment, at) => {
      const part = pattern[at] ?? '';
      return part.startsWith(':') && SECRET_PARAM.test(part) ? part : segment;
    })
    .join('/');
}
