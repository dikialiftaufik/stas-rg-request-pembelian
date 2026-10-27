import { useId, useState, useSyncExternalStore } from 'react';
import { CalendarDaysIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { datePresets, validRange } from './date-range';
import type { DateRangeValue } from './date-range';
import { formatDate } from '../demo/model';
import styles from './dashboard.module.css';

const compactQuery = '(max-width: 639px)';
function subscribeViewport(callback: () => void) {
  const media = window.matchMedia(compactQuery);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

export function DateRangePicker({
  value,
  onValueChange,
  controlLabel = 'Rentang tanggal pengajuan',
  presets = datePresets(),
}: {
  value: DateRangeValue | null;
  controlLabel?: string;
  presets?: { label: string; range: DateRangeValue | null }[];
  onValueChange: (value: DateRangeValue | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value?.from ?? '');
  const [to, setTo] = useState(value?.to ?? '');
  const [error, setError] = useState('');
  const [month, setMonth] = useState(() =>
    value?.from ? new Date(`${value.from}T12:00:00`) : new Date(),
  );
  const descriptionId = useId();
  const compact = useSyncExternalStore(
    subscribeViewport,
    () => window.matchMedia(compactQuery).matches,
    () => false,
  );
  const Root = compact ? Sheet : Popover;
  const Trigger = compact ? SheetTrigger : PopoverTrigger;
  const Content = compact ? SheetContent : PopoverContent;
  const label = value ? `${formatDate(value.from)} – ${formatDate(value.to)}` : 'Semua tanggal';
  return (
    <div className={styles.dateRangeControl}>
      <Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setMonth(value?.from ? new Date(`${value.from}T12:00:00`) : new Date());
            setFrom(value?.from ?? '');
            setTo(value?.to ?? '');
            setError('');
          }
        }}
      >
        <Trigger asChild>
          <button
            type="button"
            className={styles.secondaryButton}
            aria-label={`${controlLabel}: ${label}`}
          >
            <CalendarDaysIcon aria-hidden="true" />
            {label}
          </button>
        </Trigger>
        <Content
          {...(compact
            ? { side: 'bottom' as const, showCloseButton: false }
            : { align: 'end' as const })}
          aria-label={controlLabel}
          aria-describedby={descriptionId}
          className={compact ? 'date-range-sheet' : 'date-range-popover w-auto p-0'}
        >
          {compact && <SheetTitle className="sr-only">{controlLabel}</SheetTitle>}
          <p id={descriptionId} className="sr-only">
            Pilih tanggal pengajuan awal dan akhir. Perubahan berlaku setelah menekan Terapkan.
          </p>
          <div className={styles.dateRangePanel}>
            <div className={styles.presets} aria-label="Pilihan periode">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setMonth(
                      preset.range?.from ? new Date(`${preset.range.from}T12:00:00`) : new Date(),
                    );
                    setFrom(preset.range?.from ?? '');
                    setTo(preset.range?.to ?? '');
                    setError('');
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className={styles.calendarPanel}>
              <Calendar
                mode="range"
                month={month}
                onMonthChange={setMonth}
                locale={id}
                weekStartsOn={1}
                selected={{
                  from: from ? new Date(`${from}T12:00:00`) : undefined,
                  to: to ? new Date(`${to}T12:00:00`) : undefined,
                }}
                onSelect={(range) => {
                  setFrom(range?.from ? format(range.from, 'yyyy-MM-dd') : '');
                  setTo(range?.to ? format(range.to, 'yyyy-MM-dd') : '');
                  setError('');
                }}
                labels={{
                  labelNext: () => 'Bulan berikutnya',
                  labelPrevious: () => 'Bulan sebelumnya',
                  labelDayButton: (date, modifiers) =>
                    `${modifiers.today ? 'Hari ini, ' : ''}${format(date, 'EEEE, d MMMM yyyy', { locale: id })}${modifiers.selected ? ', dipilih' : ''}`,
                }}
              />
              <div className={styles.dateFields}>
                <label htmlFor={`${descriptionId}-from`}>
                  Dari tanggal
                  <input
                    id={`${descriptionId}-from`}
                    type="date"
                    value={from}
                    onInput={(event) => setFrom(event.currentTarget.value)}
                  />
                </label>
                <label htmlFor={`${descriptionId}-to`}>
                  Sampai tanggal
                  <input
                    id={`${descriptionId}-to`}
                    type="date"
                    value={to}
                    onInput={(event) => setTo(event.currentTarget.value)}
                  />
                </label>
              </div>
              {error && (
                <p role="alert" className={styles.formError}>
                  {error}
                </p>
              )}
              <div className={`${styles.dialogActions} ${styles.rangeActions}`}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => setOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => {
                    if ((from || to) && !validRange({ from, to })) {
                      setError('Pilih tanggal awal dan akhir yang berurutan.');
                      return;
                    }
                    onValueChange(from && to ? { from, to } : null);
                    setOpen(false);
                  }}
                >
                  Terapkan
                </button>
              </div>
            </div>
          </div>
        </Content>
      </Root>
      {value && (
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Hapus rentang tanggal"
          onClick={() => onValueChange(null)}
        >
          <XMarkIcon aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
