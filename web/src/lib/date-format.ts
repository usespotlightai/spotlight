const formats = new Map<string, Intl.DateTimeFormat>();

// The text Date#toLocale(Date|Time)String gives for options that name their
// own fields, from one formatter per options instead of a new one per call.
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
