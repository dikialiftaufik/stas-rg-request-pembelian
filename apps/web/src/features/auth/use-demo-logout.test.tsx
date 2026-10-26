import { act, renderHook } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import { expect, it } from 'vitest';
import { AppProviders } from '@/providers';
import { useDemoLogout } from './use-demo-logout';
import { currentUser, getSnapshot, loginDemo } from '../demo/store';

it('logout menghapus cache pengguna dan mempertahankan dataset demo', async () => {
  loginDemo('admin@gmail.com', 'admin123');
  const { result } = renderHook(() => ({ client: useQueryClient(), logout: useDemoLogout() }), {
    wrapper: AppProviders,
  });
  result.current.client.setQueryData(['private-user-data'], { name: 'Administrator' });
  await act(async () => {
    await result.current.logout.mutateAsync();
  });
  expect(currentUser()).toBeNull();
  expect(result.current.client.getQueryData(['private-user-data'])).toBeUndefined();
  expect(result.current.client.getMutationCache().getAll()).toHaveLength(0);
  expect(getSnapshot().requests).toHaveLength(24);
});
