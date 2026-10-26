import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { BellIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useDemo } from '../demo/use-demo';
import { markNotificationsRead } from '../demo/store';
import { formatMoney, requestTotal } from '../demo/model';
import { adminRequestNotices } from './admin-request-notices';
import { Modal } from './shared';
import styles from './dashboard.module.css';

export function AdminDashboardNotice() {
  const { data, user } = useDemo();
  const [open, setOpen] = useState(true);
  const descriptionId = useId();
  const navigate = useNavigate();
  if (!open || user?.role !== 'admin') return null;
  const notices = adminRequestNotices(data, user);
  const request = notices[0];
  const owner = data.users.find((item) => item.id === request?.ownerId)?.name ?? 'Pengaju';
  const close = () => setOpen(false);

  function review() {
    if (!request || !user) return;
    markNotificationsRead(
      data.notifications
        .filter((notice) => notice.recipientId === user.id && notice.requestId === request.id)
        .map((notice) => notice.id),
    );
    close();
    void navigate(`/requests?detail=${encodeURIComponent(request.id)}`);
  }

  return (
    <Modal
      title="Pemberitahuan Request"
      role="alertdialog"
      closeLabel="Tutup pemberitahuan"
      closeOnEscape={false}
      onClose={close}
      headerIcon={<BellIcon aria-hidden="true" />}
      subtitle={request ? `1 dari ${notices.length}` : 'Ringkasan request'}
      descriptionId={descriptionId}
      className={styles.requestNotice}
    >
      <div className={styles.requestNoticeMessage} data-empty={!request} id={descriptionId}>
        <h3 tabIndex={-1} data-initial-focus>
          {request
            ? `Persetujuan diperlukan: ${request.item}`
            : 'Tidak ada request menunggu persetujuan'}
        </h3>
        <p>
          {request
            ? `Pengajuan dari ${owner} untuk ${request.quantity} unit ${request.item} senilai ${formatMoney(requestTotal(request))} masih menunggu persetujuan Anda. Tinjau request hari ini agar proses pembelian tidak tertunda.`
            : 'Saat ini tidak ada request yang memerlukan persetujuan Anda. Anda dapat melanjutkan pengelolaan pengadaan.'}
        </p>
      </div>
      <div className={styles.requestNoticeActions}>
        <button type="button" className={styles.secondaryButton} onClick={close}>
          <ChevronLeftIcon aria-hidden="true" />
          Nanti saja
        </button>
        <button type="button" className={styles.primaryButton} onClick={request ? review : close}>
          {request ? 'Tinjau Request' : 'Lanjut ke Dashboard'}
          <ChevronRightIcon aria-hidden="true" />
        </button>
      </div>
    </Modal>
  );
}
