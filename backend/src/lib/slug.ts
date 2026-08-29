// Faixa de marcas diacríticas combinantes (acentos) na forma NFD.
const COMBINING_START = 0x300;
const COMBINING_END = 0x36f;

/** Converte um texto livre em um slug de URL: "Barbearia do João" -> "barbearia-do-joao". */
export const slugify = (value: string) =>
  Array.from(value.normalize('NFD'))
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code < COMBINING_START || code > COMBINING_END;
    })
    .join('')
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
