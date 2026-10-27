import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import { BellIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { useDemo } from '../demo/use-demo';
import { consumeAdminNotice } from '../demo/store';
import { formatMoney, requestTotal } from '../demo/model';
import { adminRequestNotices } from './admin-request-notices';
import { Modal } from './shared';
import styles from './dashboard.module.css';

export function AdminDashboardNotice() {
  const { data, user } = useDemo();
  const [open, setOpen] = useState(() =>
    Boolean(
      user?.role === 'admin' && !data.adminNoticeSeen && adminRequestNotices(data, user).length,
    ),
  );
  const descriptionId = useId();
  useEffect(() => {
    if (user?.role === 'admin') consumeAdminNotice();
  }, [user?.role]);
  if (!open || user?.role !== 'admin') return null;
  const notices = adminRequestNotices(data, user);
  const close = () => setOpen(false);
  return (
    <Modal
      title="Pemberitahuan Request"
      onClose={close}
      closeLabel="Tutup pemberitahuan"
      headerIcon={<BellIcon aria-hidden="true" />}
      descriptionId={descriptionId}
      className={styles.requestNotice}
    >
      <p id={descriptionId} className={styles.dialogDescription} data-initial-focus tabIndex={-1}>
        Ada <strong>{notices.length} request menunggu persetujuan</strong>. Berikut pengajuan
        terbaru yang perlu Anda tinjau.
      </p>
      <ul className={styles.approvalList}>
        {notices.slice(0, 3).map((request) => (
          <li key={request.id}>
            <strong>{request.item}</strong>
            <span>
              {data.users.find((item) => item.id === request.ownerId)?.name} ·{' '}
              {formatMoney(requestTotal(request))}
            </span>
          </li>
        ))}
      </ul>
      <div className={styles.dialogActions}>
        <button type="button" className={styles.secondaryButton} onClick={close}>
          Nanti saja
        </button>
        <Link className={styles.primaryButton} to="/requests?status=pending_review" onClick={close}>
          Tinjau request <ArrowRightIcon aria-hidden="true" />
        </Link>
      </div>
    </Modal>
  );
}
