import { formatInTimeZone } from 'date-fns-tz';
import { z } from 'zod';
export type DateRangeValue = { from: string; to: string };
export function wibDay(value: Date | string = new Date()) {
  return formatInTimeZone(value, 'Asia/Jakarta', 'yyyy-MM-dd');
}
export function shiftDay(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function validRange(value: DateRangeValue) {
  return (
    z.iso.date().safeParse(value.from).success &&
    z.iso.date().safeParse(value.to).success &&
    value.from <= value.to
  );
}
export function readDateRange(params: URLSearchParams): DateRangeValue | null {
  const from = params.get('from');
  const to = params.get('to');
  return from && to && validRange({ from, to }) ? { from, to } : null;
}
export function inDateRange(value: string, range: DateRangeValue | null) {
  const day = wibDay(value);
  return !range || (day >= range.from && day <= range.to);
}
export function datePresets(now = new Date()) {
  const today = wibDay(now);
  const month = today.slice(0, 7);
  const first = `${month}-01`;
  const lastMonthEnd = shiftDay(first, -1);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  return [
    { label: 'Semua tanggal', range: null },
    { label: 'Hari ini', range: { from: today, to: today } },
    { label: 'Kemarin', range: { from: shiftDay(today, -1), to: shiftDay(today, -1) } },
    {
      label: 'Minggu ini',
      range: { from: shiftDay(today, -(weekday === 0 ? 6 : weekday - 1)), to: today },
    },
    { label: '7 hari terakhir', range: { from: shiftDay(today, -6), to: today } },
    { label: '28 hari terakhir', range: { from: shiftDay(today, -27), to: today } },
    { label: 'Bulan ini', range: { from: first, to: today } },
    { label: 'Bulan lalu', range: { from: `${lastMonthEnd.slice(0, 7)}-01`, to: lastMonthEnd } },
    { label: 'Tahun ini', range: { from: `${today.slice(0, 4)}-01-01`, to: today } },
  ];
}
