import { pad } from './format';

const DAY = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

/** "Sat 26 Sep" */
export const shortDate = (t: number) => {
  const d = new Date(t);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/** "26 Sep" */
export const dayMonth = (t: number) => {
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/** "21–27 Sep" or "28 Sep–4 Oct" */
export const weekRange = (t: number) => {
  const a = new Date(startOfWeek(t));
  const b = new Date(addDays(startOfWeek(t), 6));
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]}`
    : `${a.getDate()} ${MONTHS[a.getMonth()]}–${b.getDate()} ${MONTHS[b.getMonth()]}`;
};

/** "Today · Sat 26 Sep", "Yesterday · Fri 25 Sep", "Thu 24 Sep" */
export const dayLabel = (t: number, now: number) => {
  const diff = daysBetween(t, now);
  if (diff === 0) return `Today · ${shortDate(t)}`;
  if (diff === 1) return `Yesterday · ${shortDate(t)}`;
  return shortDate(t);
};

/** "Today", "Yesterday" or "Sun 14 Sep" */
export const relDate = (t: number, now: number) => {
  const diff = daysBetween(t, now);
  return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : shortDate(t);
};

export const clock = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** "3h 12m left" / "40m left" */
export const timeLeft = (ms: number) => {
  const m = Math.max(1, Math.ceil(ms / 60000));
  if (m >= 48 * 60) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h left`;
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m left` : `${m}m left`;
};
