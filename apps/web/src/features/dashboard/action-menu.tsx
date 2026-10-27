import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from 'react-router';
import { rememberScroll } from './record-navigation';
import styles from './dashboard.module.css';
type MenuItem = {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  hint?: string;
} & ({ onSelect: () => void; to?: never } | { to: string; onSelect?: never });
export function ActionMenu({ label, items }: { label: string; items: MenuItem[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={styles.iconButton} aria-label={label}>
          <EllipsisHorizontalIcon aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {items.map((item) => (
            <DropdownMenuItem
              key={item.label}
              asChild={Boolean(item.to && !item.disabled)}
              disabled={item.disabled ?? false}
              variant={item.danger ? 'destructive' : 'default'}
              onSelect={item.onSelect}
              title={item.hint}
            >
              {item.to && !item.disabled ? (
                <Link to={item.to} onClick={rememberScroll}>
                  {item.label}
                </Link>
              ) : (
                item.label
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
