const formats = new Map<string, Intl.DateTimeFormat>();

export const formatDate = (
  at: Date,
  options: Intl.DateTimeFormatOptions,
): string => {
  const key = JSON.stringify(options);
  let format = formats.get(key);

  if (!format) {
    format = new Intl.DateTimeFormat(undefined, options);
    formats.set(key, format);
  }

  return format.format(at);
};
