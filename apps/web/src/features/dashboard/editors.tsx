import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import Decimal from 'decimal.js';
import { useDemo } from '../demo/use-demo';
import { saveRequest, saveResearch, saveUser } from '../demo/store';
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
import { Field, Modal } from './shared';
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
}: {
  request?: DemoRequest | undefined;
  onClose: () => void;
}) {
  const { data, user } = useDemo();
  const limits = requestDateLimits();
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
    formState: { errors },
  } = useForm<RequestInput>({
    resolver: zodResolver(schema),
    defaultValues: request ?? {
      item: '',
      unit: 'unit',
      researchId: user?.researchIds[0] ?? '',
      quantity: 1,
      unitPrice: '',
      requiredDate: limits.minimum,
      url: '',
      notes: '',
    },
  });
  const [quantity, unitPrice] = useWatch({ control, name: ['quantity', 'unitPrice'] });
  const total =
    moneySchema.safeParse(unitPrice).success && Number.isFinite(quantity)
      ? new Decimal(unitPrice).times(quantity)
      : new Decimal(0);
  const submit = handleSubmit((values) => {
    try {
      saveRequest(values, request?.id);
      onClose();
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Request gagal disimpan.',
      });
    }
  });
  return (
    <Modal title={request ? 'Edit Request Pembelian' : 'Buat Request Baru'} onClose={onClose} wide>
      <form noValidate className={styles.formGrid} onSubmit={(event) => void submit(event)}>
        <Field id="request-item" label="Nama barang" error={errors.item?.message}>
          <input
            {...register('item')}
            {...fieldAttributes('request-item', errors.item?.message)}
            required
          />
        </Field>
        <Field id="request-research" label="Jenis riset" error={errors.researchId?.message}>
          <select
            {...register('researchId')}
            {...fieldAttributes('request-research', errors.researchId?.message)}
            required
          >
            <option value="">Pilih jenis riset</option>
            {data.research
              .filter((item) => user?.role === 'admin' || user?.researchIds.includes(item.id))
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </Field>
        <Field id="request-quantity" label="Jumlah (unit)" error={errors.quantity?.message}>
          <input
            {...register('quantity', { valueAsNumber: true })}
            {...fieldAttributes('request-quantity', errors.quantity?.message)}
            type="number"
            min={1}
            step={1}
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
            placeholder="https://..."
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
        <output className={`${styles.summaryTotal} ${styles.fullField}`} aria-live="polite">
          Total: {formatMoney(total)}
        </output>
        {errors.root?.message && (
          <p className={`${styles.formError} ${styles.fullField}`} role="alert">
            {errors.root.message}
          </p>
        )}
        <FormActions onClose={onClose} label={request ? 'Simpan Perubahan' : 'Ajukan Request'} />
      </form>
    </Modal>
  );
}

export function UserEditor({
  user: editing,
  onClose,
}: {
  user?: DemoUser | undefined;
  onClose: () => void;
}) {
  const { data } = useDemo();
  const protectedAccount = demoAccounts.some((account) => account.id === editing?.id);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
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
  const role = useWatch({ control, name: 'role' });
  const submit = handleSubmit((values) => {
    try {
      saveUser(
        { ...values, researchIds: values.role === 'admin' ? [] : values.researchIds },
        editing?.id,
      );
      onClose();
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Pengguna gagal disimpan.',
      });
    }
  });
  return (
    <Modal title={editing ? 'Edit Pengguna' : 'Tambah Pengguna'} onClose={onClose}>
      <p className={styles.dialogDescription}>
        Pengguna tambahan merupakan data contoh; login demo tetap menggunakan dua akun utama.
      </p>
      <form noValidate className={styles.formGrid} onSubmit={(event) => void submit(event)}>
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
            <select {...register('role')} {...fieldAttributes('user-role', errors.role?.message)}>
              <option value="pengaju">Pengaju</option>
              <option value="admin">Admin</option>
            </select>
          )}
        </Field>
        {role === 'pengaju' && (
          <fieldset
            className={`${styles.fieldset} ${styles.fullField}`}
            aria-describedby={errors.researchIds ? 'research-assignment-error' : undefined}
          >
            <legend>Penugasan jenis riset</legend>
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
      </form>
    </Modal>
  );
}

export function ResearchEditor({
  research,
  onClose,
}: {
  research?: DemoResearch | undefined;
  onClose: () => void;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ResearchInput>({
    resolver: zodResolver(researchInputSchema),
    defaultValues: research ?? { name: '', description: '', allocated: '' },
  });
  const submit = handleSubmit((values) => {
    try {
      saveResearch(values, research?.id);
      onClose();
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Jenis riset gagal disimpan.',
      });
    }
  });
  return (
    <Modal title={research ? 'Edit Jenis Riset' : 'Tambah Jenis Riset'} onClose={onClose}>
      <form noValidate className={styles.formGrid} onSubmit={(event) => void submit(event)}>
        <Field id="research-name" label="Nama jenis riset" error={errors.name?.message}>
          <input
            {...register('name')}
            {...fieldAttributes('research-name', errors.name?.message)}
            required
          />
        </Field>
        <Field id="research-allocation" label="Alokasi dana (Rp)" error={errors.allocated?.message}>
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
      </form>
    </Modal>
  );
}
