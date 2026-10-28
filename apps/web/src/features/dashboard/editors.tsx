import { Link, useSearchParams } from 'react-router';
import { useState } from 'react';
import { FormSelect } from '@/components/ui/form-select';
import { ThemedSelect } from '@/components/ui/themed-select';
import { z } from 'zod';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import Decimal from 'decimal.js';
import { useDemo } from '../demo/use-demo';
import { saveRequest, saveResearch, saveUser, scopedRabs } from '../demo/store';
import {
  requestInputSchema,
  researchInputSchema,
  userInputSchema,
  formatMoney,
  requestDateLimits,
  validateRequestDate,
  moneySchema,
} from '../demo/model';
import type {
  DemoRequest,
  DemoResearch,
  DemoUser,
  RequestInput,
  ResearchInput,
  UserInput,
} from '../demo/model';
import { demoAccounts } from '../demo/seed';
import { Field } from './shared';
import { RecordPage, RecordCard } from './record-page';
import { useUnsavedChanges, useRecordNavigation } from './record-navigation';
import { FieldGroup } from '@/components/ui/field';
import { fieldAttributes } from './form-utils';
import styles from './dashboard.module.css';

function FormActions({
  onClose,
  label = 'Simpan',
  disabled = false,
}: {
  onClose: () => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`${styles.dialogActions} ${styles.fullField}`}>
      <button className={styles.secondaryButton} type="button" onClick={onClose}>
        Kembali
      </button>
      <button className={styles.primaryButton} type="submit" disabled={disabled}>
        {label}
      </button>
    </div>
  );
}

type RequestFormValues = RequestInput & {
  sourceMode: 'manual' | 'rab';
  documentId: string;
  itemId: string;
};
export function RequestEditor({
  request,
  onClose,
  onSaved,
}: {
  request?: DemoRequest | undefined;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { data, user } = useDemo();
  const [expectedRevision] = useState(request?.revision);
  const limits = requestDateLimits();
  const [params] = useSearchParams();
  const documents = user ? scopedRabs(data, user).filter((doc) => doc.active) : [];
  const initialDoc = documents.find((doc) => doc.id === params.get('sourceRab'));
  const initialItem = initialDoc?.items.find((item) => item.id === params.get('sourceItem'));
  const schema = requestInputSchema
    .extend({
      sourceMode: z.enum(['manual', 'rab']),
      documentId: z.string(),
      itemId: z.string(),
    })
    .refine(
      (value) =>
        value.requiredDate === request?.requiredDate || validateRequestDate(value.requiredDate),
      {
        path: ['requiredDate'],
        message: 'Pilih tanggal H-3 hari kerja sampai maksimal 180 hari ke depan.',
      },
    )
    .superRefine((values, context) => {
      if (request || values.sourceMode !== 'rab') return;
      const document = documents.find((doc) => doc.id === values.documentId);
      if (!document)
        context.addIssue({
          code: 'custom',
          path: ['documentId'],
          message: 'Pilih RAB aktif untuk riset Anda.',
        });
      else if (!document.items.some((item) => item.id === values.itemId))
        context.addIssue({
          code: 'custom',
          path: ['itemId'],
          message: 'Pilih barang yang tersedia pada RAB.',
        });
    });
  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    setFocus,
    formState: { errors, isDirty, isSubmitted },
  } = useForm<RequestFormValues>({
    resolver: zodResolver(schema),
    shouldFocusError: false,
    defaultValues: {
      item: initialItem?.name ?? '',
      unit: initialItem?.unit ?? 'unit',
      researchId: user?.researchIds[0] ?? '',
      quantity: initialItem?.quantity ?? 1,
      unitPrice: initialItem?.unitPrice ?? '',
      requiredDate: limits.minimum,
      url: '',
      notes: initialItem?.notes ?? '',
      ...request,
      sourceMode: params.has('sourceRab') || params.get('source') === 'rab' ? 'rab' : 'manual',
      documentId: initialDoc?.id ?? '',
      itemId: initialItem?.id ?? '',
    },
  });
  const { guard, markSaved } = useUnsavedChanges(isDirty);
  const { back } = useRecordNavigation();
  const [quantity, unitPrice] = useWatch({ control, name: ['quantity', 'unitPrice'] });
  const [sourceMode, documentId] = useWatch({ control, name: ['sourceMode', 'documentId'] });
  const researchId = useWatch({ control, name: 'researchId' });
  const sourceDoc = documents.find((doc) => doc.id === documentId);
  const assigned = data.research.find((project) => project.id === researchId);
  function selectItem(docId: string, itemId: string) {
    const item = documents
      .find((doc) => doc.id === docId)
      ?.items.find((entry) => entry.id === itemId);
    setValue('itemId', itemId, { shouldDirty: true, shouldValidate: isSubmitted });
    setValue('item', item?.name ?? '', { shouldDirty: true, shouldValidate: isSubmitted });
    setValue('unit', item?.unit ?? 'unit', { shouldDirty: true, shouldValidate: isSubmitted });
    setValue('quantity', item?.quantity ?? 1, { shouldDirty: true, shouldValidate: isSubmitted });
    setValue('unitPrice', item?.unitPrice ?? '', {
      shouldDirty: true,
      shouldValidate: isSubmitted,
    });
    setValue('notes', item?.notes ?? '', { shouldDirty: true });
  }
  const total =
    moneySchema.safeParse(unitPrice).success && Number.isFinite(quantity)
      ? new Decimal(unitPrice).times(quantity)
      : new Decimal(0);
  const submit = handleSubmit(
    (values) => {
      try {
        const savedId = saveRequest(
          values,
          request?.id,
          !request && values.sourceMode === 'rab'
            ? { documentId: values.documentId, itemId: values.itemId }
            : undefined,
          expectedRevision,
        );
        toast.success(request ? 'Request berhasil diperbarui.' : 'Request berhasil diajukan.');
        markSaved();
        onSaved(savedId);
      } catch (error) {
        setError('root', {
          message: error instanceof Error ? error.message : 'Request gagal disimpan.',
        });
      }
    },
    (issues) => {
      const first = issues.documentId
        ? 'documentId'
        : issues.itemId
          ? 'itemId'
          : (Object.keys(issues)[0] as keyof RequestFormValues | undefined);
      if (first) setFocus(first);
    },
  );
  return (
    <RecordPage
      title={request ? 'Edit Pembelian Barang' : 'Buat request'}
      back={back}
      aside={
        <RecordCard
          title="Ringkasan nilai"
          description="Total dihitung dari jumlah dan harga satuan."
        >
          <output className={styles.pageTotal} aria-live="polite">
            {formatMoney(total)}
          </output>
          <p className={styles.hint}>
            Persetujuan mengikuti sisa alokasi riset. Nilai invoice dicatat secara terpisah.
          </p>
          <p className={styles.hint}>
            {request ? 'Riset barang' : 'Riset perwakilan'}:{' '}
            <strong>{assigned?.name ?? 'Belum ditetapkan'}</strong>
          </p>
        </RecordCard>
      }
    >
      <RecordCard title="Informasi barang">
        {request && request.status !== 'pending_review' && (
          <p className={styles.hint}>
            Tautan dan harga tidak diubah langsung setelah persetujuan.{' '}
            {['approved', 'ordered'].includes(request.status) ? (
              <Link className={styles.textLink} to={`/requests/${request.id}/replacement`}>
                Ajukan link pengganti untuk ditinjau Pengaju
              </Link>
            ) : (
              'Pembelian sudah memasuki tahap pengiriman atau berakhir.'
            )}
          </p>
        )}
        {!request && (!assigned || user?.researchIds.length !== 1) && (
          <p className={styles.formError} role="alert">
            Riset perwakilan belum valid. Minta Admin menetapkan tepat satu riset pada profil Anda
            sebelum mengajukan barang.
          </p>
        )}
        {!request && (
          <p className={styles.dialogDescription}>
            Riset mengikuti akun perwakilan Anda. Pilih pengajuan manual atau barang dari RAB aktif.{' '}
            <Link className={styles.textLink} to="/requests/rab">
              Lihat daftar RAB
            </Link>
          </p>
        )}
        <form
          autoComplete="off"
          noValidate
          className={styles.documentForm}
          onSubmit={(event) => void submit(event)}
        >
          <FieldGroup className={styles.formGrid}>
            {!request && (
              <>
                <div className={styles.fullField}>
                  <Field id="request-source" label="Sumber pengajuan">
                    <Controller
                      control={control}
                      name="sourceMode"
                      render={({ field }) => (
                        <ThemedSelect
                          id="request-source"
                          value={field.value}
                          triggerRef={field.ref}
                          onValueChange={(value) => {
                            field.onChange(value);
                            setValue('documentId', '', { shouldDirty: true });
                            selectItem('', '');
                          }}
                          options={[
                            { value: 'manual', label: 'Manual · barang di luar RAB' },
                            { value: 'rab', label: 'Dari RAB · pilih barang terdaftar' },
                          ]}
                        />
                      )}
                    />
                  </Field>
                </div>
                {sourceMode === 'rab' && (
                  <>
                    <Field
                      id="request-rab"
                      label="Dokumen RAB"
                      error={errors.documentId?.message}
                      hint={
                        documents.length
                          ? 'Hanya RAB aktif untuk riset perwakilan Anda.'
                          : 'RAB belum tersedia. Minta Admin mengunggah RAB atau gunakan pengajuan manual.'
                      }
                    >
                      <Controller
                        control={control}
                        name="documentId"
                        render={({ field, fieldState }) => (
                          <ThemedSelect
                            id="request-rab"
                            name={field.name}
                            value={field.value}
                            triggerRef={field.ref}
                            onBlur={field.onBlur}
                            invalid={!!fieldState.error}
                            describedBy={
                              fieldState.error ? 'request-rab-error' : 'request-rab-hint'
                            }
                            onValueChange={(value) => {
                              field.onChange(value);
                              selectItem(value, '');
                            }}
                            options={[
                              { value: '', label: 'Pilih dokumen RAB' },
                              ...documents.map((doc) => ({
                                value: doc.id,
                                label: `${doc.name} · Versi ${doc.version}`,
                              })),
                            ]}
                          />
                        )}
                      />
                    </Field>
                    <Field
                      id="request-rab-item"
                      label="Barang dalam RAB"
                      error={errors.itemId?.message}
                      hint="Nama dan satuan mengikuti RAB; jumlah dan harga perkiraan dapat disesuaikan."
                    >
                      <Controller
                        control={control}
                        name="itemId"
                        render={({ field, fieldState }) => (
                          <ThemedSelect
                            id="request-rab-item"
                            name={field.name}
                            value={field.value}
                            triggerRef={field.ref}
                            onBlur={field.onBlur}
                            disabled={!sourceDoc}
                            invalid={!!fieldState.error}
                            describedBy={
                              fieldState.error ? 'request-rab-item-error' : 'request-rab-item-hint'
                            }
                            onValueChange={(value) => selectItem(documentId, value)}
                            options={[
                              { value: '', label: 'Pilih barang RAB' },
                              ...(sourceDoc?.items.map((item) => ({
                                value: item.id,
                                label: item.name,
                              })) ?? []),
                            ]}
                          />
                        )}
                      />
                    </Field>
                  </>
                )}
                <input type="hidden" {...register('researchId')} />
              </>
            )}
            <Field id="request-item" label="Nama barang" error={errors.item?.message}>
              <input
                {...register('item')}
                {...fieldAttributes('request-item', errors.item?.message)}
                required
                readOnly={!request && sourceMode === 'rab'}
              />
            </Field>
            {request && (
              <Field id="request-research" label="Jenis riset" error={errors.researchId?.message}>
                <FormSelect
                  control={control}
                  name="researchId"
                  id="request-research"
                  options={[
                    { value: '', label: 'Pilih jenis riset' },
                    ...data.research
                      .filter(
                        (item) => user?.role === 'admin' || user?.researchIds.includes(item.id),
                      )
                      .map((item) => ({ value: item.id, label: item.name })),
                  ]}
                />
              </Field>
            )}
            <Field id="request-quantity" label="Jumlah" error={errors.quantity?.message}>
              <input
                {...register('quantity', { valueAsNumber: true })}
                {...fieldAttributes('request-quantity', errors.quantity?.message)}
                type="number"
                min={1}
                step={1}
                required
              />
            </Field>
            <Field id="request-unit" label="Satuan" error={errors.unit?.message}>
              <input
                {...register('unit')}
                {...fieldAttributes('request-unit', errors.unit?.message)}
                placeholder="unit, set, atau paket"
                readOnly={!request && sourceMode === 'rab'}
                required
              />
            </Field>
            <Field id="request-price" label="Harga satuan (Rp)" error={errors.unitPrice?.message}>
              <input
                {...register('unitPrice')}
                readOnly={!!request && request.status !== 'pending_review'}
                {...fieldAttributes('request-price', errors.unitPrice?.message)}
                inputMode="decimal"
                placeholder="Contoh: 1250000"
                required
              />
            </Field>
            <Field
              id="request-date"
              label="Tanggal kebutuhan"
              error={errors.requiredDate?.message}
              hint="Minimal 3 hari kerja dari hari ini (WIB), maksimal 180 hari."
            >
              <input
                {...register('requiredDate')}
                {...fieldAttributes('request-date', errors.requiredDate?.message)}
                type="date"
                min={
                  request && request.requiredDate < limits.minimum
                    ? request.requiredDate
                    : limits.minimum
                }
                max={limits.maximum}
                required
              />
            </Field>
            <Field id="request-url" label="URL barang (opsional)" error={errors.url?.message}>
              <input
                {...register('url')}
                readOnly={!!request && request.status !== 'pending_review'}
                {...fieldAttributes('request-url', errors.url?.message)}
                type="url"
                placeholder="https://contoh.id/barang"
              />
            </Field>
            <div className={styles.fullField}>
              <Field id="request-notes" label="Catatan (opsional)" error={errors.notes?.message}>
                <textarea
                  {...register('notes')}
                  {...fieldAttributes('request-notes', errors.notes?.message)}
                />
              </Field>
            </div>
            {errors.root?.message && (
              <p className={`${styles.formError} ${styles.fullField}`} role="alert">
                {errors.root.message}
              </p>
            )}
            <FormActions
              onClose={onClose}
              label={request ? 'Simpan Perubahan' : 'Ajukan Request'}
              disabled={!request && (!assigned || user?.researchIds.length !== 1)}
            />
          </FieldGroup>
        </form>
        {guard}
      </RecordCard>
    </RecordPage>
  );
}

export function UserEditor({
  user: editing,
  onClose,
  onSaved,
}: {
  user?: DemoUser | undefined;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { data } = useDemo();
  const protectedAccount = demoAccounts.some((account) => account.id === editing?.id);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isDirty },
  } = useForm<UserInput>({
    resolver: zodResolver(userInputSchema),
    defaultValues: editing ?? {
      name: '',
      identifier: '',
      email: '',
      role: 'pengaju',
      researchIds: [],
    },
  });
  const { guard, markSaved } = useUnsavedChanges(isDirty);
  const { back } = useRecordNavigation('/users');
  const role = useWatch({ control, name: 'role' });
  const submit = handleSubmit((values) => {
    try {
      const savedId = saveUser(
        { ...values, researchIds: values.role === 'admin' ? [] : values.researchIds },
        editing?.id,
      );
      toast.success(editing ? 'Pengguna berhasil diperbarui.' : 'Pengguna berhasil ditambahkan.');
      markSaved();
      onSaved(savedId);
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Pengguna gagal disimpan.',
      });
    }
  });
  return (
    <RecordPage
      title={editing ? 'Edit Pengguna' : 'Tambah Pengguna'}
      back={back}
      section="Manajemen Pengguna"
      aside={
        <RecordCard title="Akses pengguna">
          <p>Pengaju hanya mengakses barang miliknya dan RAB riset yang diwakili.</p>
          <p className={styles.hint}>Akun tambahan tidak menyediakan kredensial login baru.</p>
        </RecordCard>
      }
    >
      <RecordCard title="Informasi pengguna">
        <p className={styles.dialogDescription}>
          Pengguna tambahan merupakan data contoh; login demo tetap menggunakan dua akun utama.
        </p>
        <form
          autoComplete="off"
          noValidate
          className={styles.documentForm}
          onSubmit={(event) => void submit(event)}
        >
          <FieldGroup className={styles.formGrid}>
            <Field id="user-name" label="Nama lengkap" error={errors.name?.message}>
              <input
                {...register('name')}
                {...fieldAttributes('user-name', errors.name?.message)}
                required
              />
            </Field>
            <Field id="user-identifier" label="NIP/NIM" error={errors.identifier?.message}>
              <input
                {...register('identifier')}
                {...fieldAttributes('user-identifier', errors.identifier?.message)}
                required
              />
            </Field>
            <Field id="user-email" label="Email" error={errors.email?.message}>
              <input
                {...register('email')}
                {...fieldAttributes('user-email', errors.email?.message)}
                type="email"
                readOnly={protectedAccount}
                required
              />
            </Field>
            <Field id="user-role" label="Peran" error={errors.role?.message}>
              {protectedAccount ? (
                <>
                  <input id="user-role" value={role === 'admin' ? 'Admin' : 'Pengaju'} readOnly />
                  <input type="hidden" {...register('role')} />
                </>
              ) : (
                <FormSelect
                  control={control}
                  name="role"
                  id="user-role"
                  options={[
                    { value: 'pengaju', label: 'Pengaju' },
                    { value: 'admin', label: 'Admin' },
                  ]}
                />
              )}
            </Field>
            {role === 'pengaju' && (
              <div className={styles.fullField}>
                <Field
                  id="user-research"
                  label="Perwakilan riset"
                  error={errors.researchIds?.message}
                  hint="Satu akun Pengaju mewakili satu riset; pengajuan mengikuti riset ini secara otomatis."
                >
                  <Controller
                    control={control}
                    name="researchIds"
                    render={({ field, fieldState }) => (
                      <ThemedSelect
                        id="user-research"
                        name={field.name}
                        value={field.value[0] ?? ''}
                        triggerRef={field.ref}
                        onBlur={field.onBlur}
                        onValueChange={(value) => field.onChange(value ? [value] : [])}
                        invalid={!!fieldState.error}
                        describedBy={
                          fieldState.error ? 'user-research-error' : 'user-research-hint'
                        }
                        options={[
                          { value: '', label: 'Pilih riset perwakilan' },
                          ...data.research.map((project) => ({
                            value: project.id,
                            label: project.name,
                          })),
                        ]}
                      />
                    )}
                  />
                </Field>
              </div>
            )}
            {errors.root?.message && (
              <p className={`${styles.formError} ${styles.fullField}`} role="alert">
                {errors.root.message}
              </p>
            )}
            <FormActions onClose={onClose} />
          </FieldGroup>
        </form>
        {guard}
      </RecordCard>
    </RecordPage>
  );
}

export function ResearchEditor({
  research,
  onClose,
  onSaved,
}: {
  research?: DemoResearch | undefined;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<ResearchInput>({
    resolver: zodResolver(researchInputSchema),
    defaultValues: research ?? { name: '', description: '', allocated: '' },
  });
  const { guard, markSaved } = useUnsavedChanges(isDirty);
  const { back } = useRecordNavigation('/research-types');
  const submit = handleSubmit((values) => {
    try {
      const savedId = saveResearch(values, research?.id);
      toast.success(
        research ? 'Jenis riset berhasil diperbarui.' : 'Jenis riset berhasil ditambahkan.',
      );
      markSaved();
      onSaved(savedId);
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Jenis riset gagal disimpan.',
      });
    }
  });
  return (
    <RecordPage
      title={research ? 'Edit Jenis Riset' : 'Tambah Jenis Riset'}
      back={back}
      section="Jenis Riset"
      aside={
        <RecordCard title="Tentang alokasi">
          <p>Alokasi membatasi nilai request yang disetujui.</p>
          <p className={styles.hint}>Nilai RAB dan invoice tidak otomatis mengubah alokasi.</p>
        </RecordCard>
      }
    >
      <RecordCard title="Informasi riset">
        <form
          autoComplete="off"
          noValidate
          className={styles.documentForm}
          onSubmit={(event) => void submit(event)}
        >
          <FieldGroup className={styles.formGrid}>
            <Field id="research-name" label="Nama jenis riset" error={errors.name?.message}>
              <input
                {...register('name')}
                {...fieldAttributes('research-name', errors.name?.message)}
                required
              />
            </Field>
            <Field
              id="research-allocation"
              label="Alokasi dana (Rp)"
              error={errors.allocated?.message}
            >
              <input
                {...register('allocated')}
                {...fieldAttributes('research-allocation', errors.allocated?.message)}
                inputMode="decimal"
                required
              />
            </Field>
            <div className={styles.fullField}>
              <Field
                id="research-description"
                label="Deskripsi (opsional)"
                error={errors.description?.message}
              >
                <textarea
                  {...register('description')}
                  {...fieldAttributes('research-description', errors.description?.message)}
                />
              </Field>
            </div>
            {errors.root?.message && (
              <p className={`${styles.formError} ${styles.fullField}`} role="alert">
                {errors.root.message}
              </p>
            )}
            <FormActions onClose={onClose} />
          </FieldGroup>
        </form>
        {guard}
      </RecordCard>
    </RecordPage>
  );
}
