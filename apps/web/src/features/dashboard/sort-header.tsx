import { ArrowDownIcon, ArrowUpIcon, ArrowsUpDownIcon } from '@heroicons/react/24/outline';
import type { SortDirection } from './table-sorting';
import styles from './dashboard.module.css';

export function SortHeader({
  label,
  active,
  direction,
  onSort,
  numeric = false,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onSort: () => void;
  numeric?: boolean;
}) {
  const Icon = active ? (direction === 'asc' ? ArrowUpIcon : ArrowDownIcon) : ArrowsUpDownIcon;
  return (
    <th
      scope="col"
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}
      className={numeric ? styles.money : undefined}
    >
      <button
        type="button"
        className={styles.sortHeader}
        onClick={onSort}
        aria-label={`Urutkan ${label}${active && direction === 'asc' ? ' menurun' : ' menaik'}`}
      >
        {label}
        <Icon aria-hidden="true" />
      </button>
    </th>
  );
}
