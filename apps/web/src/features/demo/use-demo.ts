import { useSyncExternalStore } from 'react';
import { currentUser, getSnapshot, subscribe } from './store';

export function useDemo() {
  const data = useSyncExternalStore(subscribe, getSnapshot);
  return { data, user: currentUser(data) };
}
