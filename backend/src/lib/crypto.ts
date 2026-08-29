import argon2 from 'argon2';
import crypto from 'node:crypto';

const ARGON_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export const hashPassword = (plain: string) => argon2.hash(plain, ARGON_OPTS);

export const verifyPassword = async (hash: string, plain: string) => {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
};

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

export const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

/** Comparação em tempo constante (proteção contra timing attacks). */
export const safeEqual = (a: string, b: string) => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Código legível de agendamento, ex.: AG-7K3F9Q */
export const appointmentCode = () => {
  let out = '';
  const buf = crypto.randomBytes(6);
  for (let i = 0; i < 6; i += 1) out += ALPHABET[buf[i] % ALPHABET.length];
  return `AG-${out}`;
};
