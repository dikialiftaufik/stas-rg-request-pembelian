import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import styles from './dashboard.module.css';

export function RecordCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className={styles.recordCard}>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
export function RecordPage({
  title,
  back,
  section = 'Pembelian Barang',
  children,
  aside,
  actions,
}: {
  title: string;
  back: string;
  section?: string;
  children: ReactNode;
  aside?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={styles.recordPage}>
      <Breadcrumb aria-label="Lokasi halaman">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={back}>{section}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <header className={styles.recordHeading}>
        <div>
          <Link to={back} className={styles.iconButton} aria-label={`Kembali ke ${section}`}>
            <ArrowLeftIcon aria-hidden="true" />
          </Link>
          <h1>{title}</h1>
        </div>
        {actions}
      </header>
      <div className={aside ? styles.recordColumns : styles.recordSingle}>
        <div className={styles.recordMain}>{children}</div>
        {aside && <aside className={styles.recordAside}>{aside}</aside>}
      </div>
    </div>
  );
}
export function UnavailablePage({
  title = 'Request tidak tersedia',
  back = '/requests',
}: {
  title?: string;
  back?: string;
}) {
  return (
    <RecordPage title={title} back={back}>
      <RecordCard title={title}>
        <p role="alert">
          Data tidak ditemukan atau tidak dapat diakses. Kembali ke daftar untuk memilih data yang
          tersedia.
        </p>
      </RecordCard>
    </RecordPage>
  );
}
