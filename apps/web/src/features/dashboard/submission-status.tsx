import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { syncSingleRequestFromServer } from '../demo/store';
import { submissionStatusLabels, submissionStatusSchema } from '../demo/model';
import type { DemoRequest } from '../demo/model';
import { useDemo } from '../demo/use-demo';
import { updateSubmissionStatusApi } from '../requests/api';
import styles from './dashboard.module.css';

export function SubmissionStatusCell({ request }: { request: DemoRequest }) {
  const { user } = useDemo();
  const queryClient = useQueryClient();
  const [expectedRevision, setExpectedRevision] = useState(request.revision);
  const [expected, setExpected] = useState(request.submissionStatus);
  const [saving, setSaving] = useState(false);
  const badgeStatus = request.submissionStatus === 'submitted' ? 'approved' : 'pending_review';
  const label = submissionStatusLabels[request.submissionStatus];
  if (user?.role !== 'admin')
    return (
      <Badge variant="secondary" className={styles.statusBadge} data-status={badgeStatus}>
        {label}
      </Badge>
    );
  return (
    <DropdownMenu
      modal={false}
      onOpenChange={(open) => {
        if (open) {
          setExpected(request.submissionStatus);
          setExpectedRevision(request.revision);
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Badge asChild variant="secondary" className={styles.statusBadge} data-status={badgeStatus}>
          <button
            type="button"
            className={styles.submissionTrigger}
            disabled={saving}
            aria-label={`Status pengajuan ${request.item}: ${label}`}
          >
            {label}
          </button>
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" aria-label={`Status pengajuan ${request.item}`}>
        <DropdownMenuLabel>Status pengajuan</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={request.submissionStatus}
          onValueChange={(value) => {
            if (value === request.submissionStatus || saving) return;
            void (async () => {
              setSaving(true);
              try {
                const updated = await updateSubmissionStatusApi(request.id, {
                  expectedStatus: expected,
                  expectedRevision,
                  nextStatus: submissionStatusSchema.parse(value),
                });
                syncSingleRequestFromServer(updated);
                setExpected(updated.submissionStatus);
                setExpectedRevision(updated.revision);
                await queryClient.invalidateQueries({ queryKey: ['requests'] });
                toast.success(`Status pengajuan ${request.item} berhasil diperbarui.`);
              } catch (cause) {
                toast.error(
                  cause instanceof Error
                    ? cause.message
                    : 'Status pengajuan gagal disimpan. Silakan coba lagi.',
                );
              } finally {
                setSaving(false);
              }
            })();
          }}
        >
          {Object.entries(submissionStatusLabels).map(([value, optionLabel]) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {optionLabel}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
