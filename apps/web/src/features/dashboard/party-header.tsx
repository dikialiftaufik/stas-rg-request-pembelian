import { ChevronDownIcon } from '@heroicons/react/24/outline';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { SortDirection } from './table-sorting';
import styles from './dashboard.module.css';
export function PartyHeader({
  active,
  direction,
  onSort,
}: {
  active: string;
  direction: SortDirection;
  onSort: (key: 'owner' | 'research', direction: SortDirection) => void;
}) {
  return (
    <th
      scope="col"
      aria-sort={
        ['owner', 'research'].includes(active)
          ? direction === 'asc'
            ? 'ascending'
            : 'descending'
          : undefined
      }
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={styles.sortHeader}
            aria-label="Urutkan pengaju atau riset"
          >
            Pengaju / riset
            <ChevronDownIcon aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuGroup>
            {(['owner', 'research'] as const).flatMap((key) =>
              (['asc', 'desc'] as const).map((dir) => (
                <DropdownMenuItem key={`${key}-${dir}`} onSelect={() => onSort(key, dir)}>
                  {key === 'owner' ? 'Pengaju' : 'Riset'} {dir === 'asc' ? 'A–Z' : 'Z–A'}
                </DropdownMenuItem>
              )),
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </th>
  );
}
