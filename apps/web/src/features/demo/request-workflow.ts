import type { RequestStatus } from './model';

const transitions = new Map<RequestStatus, readonly RequestStatus[]>([
  ['pending_review', ['approved', 'rejected']],
  ['approved', ['ordered']],
  ['ordered', ['in_transit']],
  ['in_transit', ['delivered']],
  ['delivered', ['completed']],
]);

export function allowedNextStatuses(status: RequestStatus): readonly RequestStatus[] {
  return transitions.get(status) ?? [];
}
