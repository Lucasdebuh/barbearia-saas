import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import 'dayjs/locale/pt-br';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.extend(isSameOrBefore);
dayjs.locale('pt-br');

/** Fuso horário de operação da plataforma. Datas são persistidas em UTC. */
export const BUSINESS_TZ = 'America/Sao_Paulo';

export { dayjs };

/** Converte 'YYYY-MM-DD' + minutos do dia para um Date UTC. */
export const localDateTime = (date: string, minutesOfDay: number) =>
  dayjs.tz(date, BUSINESS_TZ).startOf('day').add(minutesOfDay, 'minute').toDate();

/** Dia da semana (0=domingo) da data no fuso de operação. */
export const weekdayOf = (date: string) => dayjs.tz(date, BUSINESS_TZ).day();

export const startOfLocalDay = (date: string) => dayjs.tz(date, BUSINESS_TZ).startOf('day').toDate();
export const endOfLocalDay = (date: string) => dayjs.tz(date, BUSINESS_TZ).endOf('day').toDate();

export const toLocal = (date: Date) => dayjs(date).tz(BUSINESS_TZ);

export const minutesToHHMM = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export const hhmmToMinutes = (value: string) => {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
};

/** Verifica sobreposição de dois intervalos [aStart, aEnd) e [bStart, bEnd). */
export const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart < bEnd && bStart < aEnd;

export const WEEKDAY_LABELS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];
