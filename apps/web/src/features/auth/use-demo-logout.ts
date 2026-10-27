import { toast } from 'sonner';
import { useLogout } from '@refinedev/core';
import { useQueryClient } from '@tanstack/react-query';

export function useDemoLogout() {
  const queryClient = useQueryClient();
  return useLogout({
    mutationOptions: {
      onSettled: (result) => {
        // Refine invalidates auth queries; also discard cached user data and login variables.
        if (result?.success) {
          queryClient.clear();
          toast.success('Anda berhasil keluar.');
        }
      },
    },
  });
}
