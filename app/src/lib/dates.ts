import { pad } from './format';
import { isId, tr } from './i18n';

const DAY = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const weekday = (d: Date) => (isId() ? WEEKDAYS_ID : WEEKDAYS)[d.getDay()];
const month = (d: Date) => (isId() ? MONTHS_ID : MONTHS)[d.getMonth()];

export const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Weeks run Monday to Sunday. */
export const startOfWeek = (t: number) => {
  const d = new Date(startOfDay(t));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
};

export const endOfWeek = (t: number) => {
  const d = new Date(startOfWeek(t));
  d.setDate(d.getDate() + 7);
  return d.getTime();
};

export const weekKey = (t: number) => dayKey(startOfWeek(t));

/** 1 on Monday … 7 on Sunday. */
export const dayOfWeek = (t: number) => ((new Date(t).getDay() + 6) % 7) + 1;

export const startOfMonth = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
};

export const addDays = (t: number, n: number) => {
  const d = new Date(t);
  d.setDate(d.getDate() + n);
  return d.getTime();
};

/** Whole calendar days between two instants (b - a). */
export const daysBetween = (a: number, b: number) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);

/** "Sat 26 Sep" / "Sab 26 Sep" */
export const shortDate = (t: number) => {
  const d = new Date(t);
  return `${weekday(d)} ${d.getDate()} ${month(d)}`;
};

/** "Thu, 2 Oct" / "Kam, 2 Okt", the date under the app name on Home. */
export const headDate = (t: number) => {
  const d = new Date(t);
  return `${weekday(d)}, ${d.getDate()} ${month(d)}`;
};

/** "26 Sep" */
export const dayMonth = (t: number) => {
  const d = new Date(t);
  return `${d.getDate()} ${month(d)}`;
};

/** "21–27 Sep" or "28 Sep–4 Oct" */
export const weekRange = (t: number) => {
  const a = new Date(startOfWeek(t));
  const b = new Date(addDays(startOfWeek(t), 6));
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${month(b)}`
    : `${a.getDate()} ${month(a)}–${b.getDate()} ${month(b)}`;
};

/** "Today · Sat 26 Sep", "Yesterday · Fri 25 Sep", "Thu 24 Sep" */
export const dayLabel = (t: number, now: number) => {
  const diff = daysBetween(t, now);
  if (diff === 0) return `${tr('Today', 'Hari ini')} · ${shortDate(t)}`;
  if (diff === 1) return `${tr('Yesterday', 'Kemarin')} · ${shortDate(t)}`;
  return shortDate(t);
};

/** "Today", "Yesterday" or "Sun 14 Sep" */
export const relDate = (t: number, now: number) => {
  const diff = daysBetween(t, now);
  return diff === 0 ? tr('Today', 'Hari ini') : diff === 1 ? tr('Yesterday', 'Kemarin') : shortDate(t);
};

export const clock = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** "3h 12m left" / "40m left" · "3 jam 12 mnt lagi" / "40 mnt lagi" */
export const timeLeft = (ms: number) => {
  const m = Math.max(1, Math.ceil(ms / 60000));
  const d = Math.floor(m / 1440), h = Math.floor(m / 60), hRest = Math.floor((m % 1440) / 60);
  if (isId()) {
    if (m >= 48 * 60) return hRest ? `${d} hr ${hRest} jam lagi` : `${d} hr lagi`;
    return m >= 60 ? (m % 60 ? `${h} jam ${m % 60} mnt lagi` : `${h} jam lagi`) : `${m} mnt lagi`;
  }
  if (m >= 48 * 60) return `${d}d ${hRest}h left`;
  return m >= 60 ? `${h}h ${m % 60}m left` : `${m}m left`;
};

/** Midnight at the start of next Monday. */
export const nextMonday = (t: number) => endOfWeek(t);
