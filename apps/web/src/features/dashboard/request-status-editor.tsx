import { FormSelect } from '@/components/ui/form-select';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import { changeRequestStatus, replacementBlocked } from '../demo/store';
import { statusSchema, statusLabelMap } from '../demo/model';
import type { DemoRequest } from '../demo/model';
import { allowedNextStatuses } from '../demo/request-workflow';
import { Field, StatusBadge } from './shared';
import { useUnsavedChanges } from './record-navigation';
import { FieldGroup } from '@/components/ui/field';
import { fieldAttributes } from './form-utils';
import styles from './dashboard.module.css';

const schema = z
  .object({ nextStatus: statusSchema, reason: z.string().trim() })
  .refine((value) => value.nextStatus !== 'rejected' || value.reason.length > 0, {
    path: ['reason'],
    message: 'Jelaskan alasan penolakan agar Pengaju dapat menindaklanjuti.',
  });
type Values = z.infer<typeof schema>;

export function RequestStatusEditor({
  request,
  onClose,
  onSaved,
}: {
  request: DemoRequest;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [expectedRevision] = useState(request.revision);
  const [expectedStatus] = useState(request.status);
  const options = replacementBlocked(request) ? [] : allowedNextStatuses(expectedStatus);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { nextStatus: options[0] ?? expectedStatus, reason: '' },
  });
  const { guard, markSaved } = useUnsavedChanges(isDirty, isSubmitting);
  const nextStatus = useWatch({ control, name: 'nextStatus' });
  const submit = handleSubmit(async (values) => {
    try {
      await changeRequestStatus({ id: request.id, expectedStatus, expectedRevision, ...values });
      toast.success(`Status ${request.item} berhasil diperbarui.`);
      markSaved();
      onSaved();
    } catch (cause) {
      setError('root', {
        message:
          cause instanceof Error ? cause.message : 'Status gagal diperbarui. Silakan coba lagi.',
      });
    }
  });
  return (
    <form noValidate className={styles.statusEditor} onSubmit={(event) => void submit(event)}>
      <FieldGroup>
        <div className={styles.sectionRow}>
          <h3>Ubah status pembelian</h3>
          <StatusBadge status={expectedStatus} />
        </div>
        {!options.length && (
          <p role="status">
            {replacementBlocked(request)
              ? 'Pembelian dijeda. Buka detail dan tuntaskan penawaran pengganti.'
              : 'Status akhir tidak dapat diubah.'}
          </p>
        )}
        <Field id="next-status" label="Status berikutnya" error={errors.nextStatus?.message}>
          <FormSelect
            control={control}
            name="nextStatus"
            id="next-status"
            options={options.map((status) => ({
              value: status,
              label: statusLabelMap.get(status) ?? status,
            }))}
            disabled={isSubmitting}
          />
        </Field>
        <Field
          id="status-reason"
          label={nextStatus === 'rejected' ? 'Alasan penolakan' : 'Catatan perubahan (opsional)'}
          error={errors.reason?.message}
        >
          <textarea
            {...register('reason')}
            {...fieldAttributes('status-reason', errors.reason?.message)}
            required={nextStatus === 'rejected'}
          />
        </Field>
        <p className={styles.hint}>
          Pastikan tahapan sudah benar. Perubahan dicatat dan diberitahukan kepada Pengaju.
        </p>
        {errors.root?.message && (
          <p className={styles.formError} role="alert">
            {errors.root.message}
          </p>
        )}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>
            Batal ubah status
          </button>
          <button
            type="submit"
            className={nextStatus === 'rejected' ? styles.dangerButton : styles.primaryButton}
            disabled={!options.length || isSubmitting}
          >
            {isSubmitting ? 'Menyimpan…' : 'Konfirmasi perubahan status'}
          </button>
        </div>
      </FieldGroup>
      {guard}
    </form>
  );
}
