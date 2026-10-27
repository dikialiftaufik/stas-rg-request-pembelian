import { useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
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
import { changeSubmissionStatus } from '../demo/store';
import { submissionStatusLabels, submissionStatusSchema } from '../demo/model';
import type { DemoRequest } from '../demo/model';
import { useDemo } from '../demo/use-demo';
import styles from './dashboard.module.css';

export function SubmissionStatusCell({ request }: { request: DemoRequest }) {
  const { user } = useDemo();
  const [expected, setExpected] = useState(request.submissionStatus);
  const variant = request.submissionStatus === 'submitted' ? 'default' : 'outline';
  const label = submissionStatusLabels[request.submissionStatus];
  if (user?.role !== 'admin') return <Badge variant={variant}>{label}</Badge>;
  return (
    <DropdownMenu
      modal={false}
      onOpenChange={(open) => {
        if (open) setExpected(request.submissionStatus);
      }}
    >
      <DropdownMenuTrigger asChild>
        <Badge asChild variant={variant}>
          <button
            type="button"
            className={styles.submissionTrigger}
            aria-label={`Status pengajuan ${request.item}: ${label}`}
          >
            {label}
            <ChevronDownIcon aria-hidden="true" />
          </button>
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" aria-label={`Status pengajuan ${request.item}`}>
        <DropdownMenuLabel>Status pengajuan</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={request.submissionStatus}
          onValueChange={(value) => {
            if (value === request.submissionStatus) return;
            try {
              changeSubmissionStatus({
                id: request.id,
                expectedStatus: expected,
                nextStatus: submissionStatusSchema.parse(value),
              });
              toast.success(`Status pengajuan ${request.item} berhasil diperbarui.`);
            } catch (cause) {
              toast.error(
                cause instanceof Error
                  ? cause.message
                  : 'Status pengajuan gagal disimpan. Silakan coba lagi.',
              );
            }
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
