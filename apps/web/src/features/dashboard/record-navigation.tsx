import { useRef } from 'react';
import { useBeforeUnload, useBlocker, useLocation, useSearchParams } from 'react-router';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

export function useUnsavedChanges(dirty: boolean, busy = false) {
  const saved = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !saved.current &&
      (dirty || busy) &&
      `${currentLocation.pathname}${currentLocation.search}` !==
        `${nextLocation.pathname}${nextLocation.search}`,
  );
  useBeforeUnload((event) => {
    if (!saved.current && (dirty || busy)) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  return {
    resetSaved: () => {
      saved.current = false;
    },
    markSaved: () => {
      saved.current = true;
    },
    guard: (
      <AlertDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {busy ? 'Penyimpanan sedang berlangsung' : 'Tinggalkan perubahan?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {busy
                ? 'Tunggu hingga penyimpanan selesai sebelum meninggalkan halaman.'
                : 'Perubahan belum disimpan. Tetap di halaman untuk melanjutkan atau tinggalkan perubahan.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tetap di halaman</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                if (blocker.state === 'blocked') blocker.proceed();
              }}
            >
              Tinggalkan perubahan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    ),
  };
}

export function safeReturn(value: string | null, fallback: string) {
  return value &&
    /^\/(dashboard|requests|users|research-types|profile|notifications)(\/|\?|$)/.test(value)
    ? value
    : fallback;
}
export function useRecordNavigation(fallback = '/requests') {
  const location = useLocation();
  const [params] = useSearchParams();
  const back = safeReturn(params.get('returnTo'), fallback);
  function link(path: string) {
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}returnTo=${encodeURIComponent(location.pathname + location.search)}`;
  }
  return { back, link };
}

export function rememberScroll() {
  try {
    sessionStorage.setItem(
      `stas-scroll:${window.location.pathname}${window.location.search}`,
      String(window.scrollY),
    );
  } catch {
    /* Navigation works when browser storage is blocked. */
  }
}

export function recordDestination(path: string, returnTo: string) {
  let back = returnTo;
  const fallback = path.startsWith('/requests/rab/')
    ? '/requests/rab'
    : `/${path.split('/')[1] ?? 'dashboard'}`;
  for (let depth = 0; depth < 8; depth++) {
    const parent = new URL(back, 'https://stas.invalid');
    if (parent.pathname !== path) break;
    back = safeReturn(parent.searchParams.get('returnTo'), fallback);
  }
  return `${path}?returnTo=${encodeURIComponent(back)}`;
}
