import type { Ref } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

type Option = { value: string; label: string; disabled?: boolean };
const EMPTY_VALUE = '__all__';
export function ThemedSelect({
  id,
  label,
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  invalid,
  describedBy,
  triggerRef,
  name,
  onBlur,
}: {
  name?: string;
  onBlur?: () => void;
  id?: string;
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string | undefined;
  triggerRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <Select
      name={name}
      value={value || EMPTY_VALUE}
      onValueChange={(value) => onValueChange(value === EMPTY_VALUE ? '' : value)}
      disabled={disabled ?? false}
    >
      <SelectTrigger
        onBlur={onBlur}
        ref={triggerRef}
        id={id}
        aria-label={label}
        aria-invalid={invalid}
        aria-describedby={describedBy}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectGroup>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value || EMPTY_VALUE}
              disabled={option.disabled ?? false}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
