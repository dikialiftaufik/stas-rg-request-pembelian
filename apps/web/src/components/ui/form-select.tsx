import { Controller } from 'react-hook-form';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { ThemedSelect } from './themed-select';
export function FormSelect<T extends FieldValues>({
  control,
  name,
  id,
  options,
  disabled = false,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  id: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <ThemedSelect
          id={id}
          name={field.name}
          triggerRef={field.ref}
          value={typeof field.value === 'string' ? field.value : ''}
          onValueChange={field.onChange}
          onBlur={field.onBlur}
          disabled={disabled}
          invalid={!!fieldState.error}
          describedBy={fieldState.error ? `${id}-error` : undefined}
          options={options}
        />
      )}
    />
  );
}
