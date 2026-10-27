import { Link, useSearchParams } from 'react-router';
import { FormSelect } from '@/components/ui/form-select';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
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

function FormActions({ onClose, label = 'Simpan' }: { onClose: () => void; label?: string }) {
  return (
    <div className={`${styles.dialogActions} ${styles.fullField}`}>
      <button className={styles.secondaryButton} type="button" onClick={onClose}>
        Kembali
      </button>
      <button className={styles.primaryButton} type="submit">
        {label}
      </button>
    </div>
  );
}

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
  const limits = requestDateLimits();
  const [params] = useSearchParams();
  const sourceDoc =
    !request && user
      ? scopedRabs(data, user).find((doc) => doc.id === params.get('sourceRab') && doc.active)
      : undefined;
  const sourceItem = sourceDoc?.items.find((item) => item.id === params.get('sourceItem'));
  const invalidSource = !request && params.has('sourceRab') && !sourceItem;
  const schema = requestInputSchema.refine(
    (value) =>
      value.requiredDate === request?.requiredDate || validateRequestDate(value.requiredDate),
    {
      path: ['requiredDate'],
      message: 'Pilih tanggal H-3 hari kerja sampai maksimal 180 hari ke depan.',
    },
  );
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isDirty },
  } = useForm<RequestInput>({
    resolver: zodResolver(schema),
    defaultValues: request ?? {
      item: sourceItem?.name ?? '',
      unit: sourceItem?.unit ?? 'unit',
      researchId: sourceDoc?.researchId ?? user?.researchIds[0] ?? '',
      quantity: sourceItem?.quantity ?? 1,
      unitPrice: sourceItem?.unitPrice ?? '',
      requiredDate: limits.minimum,
      url: '',
      notes: sourceItem?.notes ?? '',
    },
  });
  const { guard, markSaved } = useUnsavedChanges(isDirty);
  const { back } = useRecordNavigation();
  const [quantity, unitPrice] = useWatch({ control, name: ['quantity', 'unitPrice'] });
  const total =
    moneySchema.safeParse(unitPrice).success && Number.isFinite(quantity)
      ? new Decimal(unitPrice).times(quantity)
      : new Decimal(0);
  const submit = handleSubmit((values) => {
    try {
      if (invalidSource)
        throw new Error(
          'Barang RAB tidak tersedia. Pilih barang dari RAB aktif atau buat request manual.',
        );
      const savedId = saveRequest(
        values,
        request?.id,
        sourceDoc && sourceItem && sourceDoc.researchId === values.researchId
          ? { documentId: sourceDoc.id, itemId: sourceItem.id }
          : undefined,
      );
      toast.success(request ? 'Request berhasil diperbarui.' : 'Request berhasil diajukan.');
      markSaved();
      onSaved(savedId);
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Request gagal disimpan.',
      });
    }
  });
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
        </RecordCard>
      }
    >
      <RecordCard title="Informasi barang">
        {!request && (
          <p className={styles.dialogDescription}>
            {sourceItem
              ? `Diisi dari ${sourceDoc?.name ?? 'RAB'}. Jumlah dan harga dapat disesuaikan.`
              : 'Ajukan barang manual atau pilih dari daftar RAB riset Anda.'}{' '}
            <Link className={styles.textLink} to="/requests?tab=rab">
              Pilih dari RAB
            </Link>
          </p>
        )}
        {invalidSource && (
          <p className={styles.formError} role="alert">
            Barang RAB tidak tersedia. <Link to="/requests?create=1">Buat request manual</Link>.
          </p>
        )}
        <form
          autoComplete="off"
          noValidate
          className={styles.documentForm}
          onSubmit={(event) => void submit(event)}
        >
          <FieldGroup className={styles.formGrid}>
            <Field id="request-item" label="Nama barang" error={errors.item?.message}>
              <input
                {...register('item')}
                {...fieldAttributes('request-item', errors.item?.message)}
                required
              />
            </Field>
            <Field id="request-research" label="Jenis riset" error={errors.researchId?.message}>
              <FormSelect
                control={control}
                name="researchId"
                id="request-research"
                options={[
                  { value: '', label: 'Pilih jenis riset' },
                  ...data.research
                    .filter((item) => user?.role === 'admin' || user?.researchIds.includes(item.id))
                    .map((item) => ({ value: item.id, label: item.name })),
                ]}
              />
            </Field>
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
                required
              />
            </Field>
            <Field id="request-price" label="Harga satuan (Rp)" error={errors.unitPrice?.message}>
              <input
                {...register('unitPrice')}
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
              <fieldset
                className={`${styles.fieldset} ${styles.fullField}`}
                aria-describedby={errors.researchIds ? 'research-assignment-error' : undefined}
              >
                <legend>Perwakilan riset</legend>
                {data.research.map((item) => (
                  <label key={item.id} htmlFor={`assignment-${item.id}`}>
                    <input
                      id={`assignment-${item.id}`}
                      type="checkbox"
                      value={item.id}
                      {...register('researchIds')}
                    />
                    {item.name}
                  </label>
                ))}
                {errors.researchIds?.message && (
                  <p id="research-assignment-error" className={styles.formError} role="alert">
                    {errors.researchIds.message}
                  </p>
                )}
              </fieldset>
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
