import { useState } from 'react';
import {
  ArrowRightIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import styles from './login.module.css';

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Masukkan ID, NIM, atau email Anda.'),
  password: z.string().min(1, 'Masukkan password Anda.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    shouldFocusError: true,
  });

  const submit = handleSubmit(
    () => setShowStatus(true),
    () => setShowStatus(false),
  );
  const PasswordVisibilityIcon = passwordVisible ? EyeSlashIcon : EyeIcon;

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => void submit(event)}
      onInput={() => setShowStatus(false)}
    >
      <div className={styles.fields}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="login-identifier">
            ID / NIM / EMAIL
          </label>
          <div className={styles.inputContainer}>
            <EnvelopeIcon className={styles.inputIcon} aria-hidden="true" />
            <input
              {...register('identifier')}
              className={styles.input}
              id="login-identifier"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Masukkan identitas Anda"
              required
              aria-invalid={Boolean(errors.identifier)}
              aria-describedby={errors.identifier ? 'login-identifier-error' : undefined}
            />
          </div>
          {errors.identifier && (
            <p id="login-identifier-error" className={styles.error} role="alert">
              {errors.identifier.message}
            </p>
          )}
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="login-password">
            PASSWORD
          </label>
          <div className={styles.inputContainer}>
            <LockClosedIcon className={styles.inputIcon} aria-hidden="true" />
            <input
              {...register('password')}
              className={`${styles.input} ${styles.passwordInput}`}
              id="login-password"
              type={passwordVisible ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Masukkan password"
              required
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
            />
            <button
              className={styles.passwordToggle}
              type="button"
              aria-label="Tampilkan password"
              aria-pressed={passwordVisible}
              aria-controls="login-password"
              onClick={() => setPasswordVisible((visible) => !visible)}
            >
              <PasswordVisibilityIcon aria-hidden="true" />
            </button>
          </div>
          {errors.password && (
            <p id="login-password-error" className={styles.error} role="alert">
              {errors.password.message}
            </p>
          )}
        </div>
      </div>
      <Button className={styles.submit} type="submit">
        Masuk ke Dashboard
        <ArrowRightIcon aria-hidden="true" />
      </Button>
      <p className={styles.status} role="status" aria-live="polite">
        {showStatus ? 'Fitur masuk belum tersedia saat ini.' : ''}
      </p>
      <p className={styles.accountNote}>
        Akun dibuat dan dikelola oleh Admin STAS-RG. Tidak ada registrasi mandiri.
      </p>
    </form>
  );
}
