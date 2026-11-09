import type { DemoSnapshot } from './model';

export function upgradeDemo(data: DemoSnapshot): DemoSnapshot {
  if (data.demoRevision >= 2) return data;
  return {
    ...data,
    demoRevision: 2,
  };
}
