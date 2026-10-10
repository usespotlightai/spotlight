const portrait = (skin: string, hair: string, backdrop: string): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${backdrop}"/><path d="M14 64c0-11 8-18 18-18s18 7 18 18z" fill="#5c66d9"/><path d="M17 30c0-12 6-19 15-19s15 7 15 19c0 6-2 11-4 13H21c-2-2-4-7-4-13z" fill="${hair}"/><circle cx="32" cy="29" r="11" fill="${skin}"/><path d="M21 27c2-7 6-10 11-10s9 3 11 10c-4-3-7-4-11-4s-7 1-11 4z" fill="${hair}"/></svg>`,
  )}`;

export const MAYA_IMAGE = portrait('#e8b896', '#2b1d16', '#f3e1cf');
