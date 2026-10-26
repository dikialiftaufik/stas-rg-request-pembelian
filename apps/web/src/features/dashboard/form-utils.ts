export function fieldAttributes(id: string, error?: string) {
  return {
    id,
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? `${id}-error` : undefined,
  };
}
