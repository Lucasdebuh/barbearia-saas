export const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/** Garante unicidade consultando um verificador assíncrono. */
export const uniqueSlug = async (base: string, exists: (slug: string) => Promise<boolean>) => {
  const root = slugify(base) || 'barbeiro';
  let candidate = root;
  let i = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await exists(candidate)) {
    i += 1;
    candidate = `${root}-${i}`;
  }
  return candidate;
};
