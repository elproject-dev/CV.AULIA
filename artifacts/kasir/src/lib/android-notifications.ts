import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { formatRupiah } from './formatters';

const CHANNEL_ID = 'kasir';
const TRANSACTION_CHANNEL_ID = 'kasir_transaksi_sukses';
const TRANSACTION_SOUND = 'transaksi.wav';

export const NOTIFICATION_SETTINGS = {
  transactionSuccess: 'notifyTransactionSuccess',
  print: 'notifyPrint',
} as const;

export function isTransactionSuccessNotificationEnabled(): boolean {
  return localStorage.getItem(NOTIFICATION_SETTINGS.transactionSuccess) !== 'false';
}

export function isPrintNotificationEnabled(): boolean {
  return localStorage.getItem(NOTIFICATION_SETTINGS.print) !== 'false';
}

let initPromise: Promise<void> | null = null;

async function ensureInitialized(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  if (!initPromise) {
    initPromise = (async () => {
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }

      await LocalNotifications.createChannel({
        id: CHANNEL_ID,
        name: 'Kasir',
        description: 'Notifikasi printer dan sistem',
        importance: 4,
        visibility: 1,
      });

      await LocalNotifications.createChannel({
        id: TRANSACTION_CHANNEL_ID,
        name: 'Transaksi Berhasil',
        description: 'Notifikasi saat transaksi berhasil',
        importance: 4,
        visibility: 1,
        sound: TRANSACTION_SOUND,
      });
    })().catch((error) => {
      initPromise = null;
      console.warn('Gagal menginisialisasi notifikasi Android:', error);
    });
  }

  await initPromise;
}

function nextNotificationId(): number {
  return Math.floor(Date.now() % 2147483647);
}

async function scheduleNotification(
  title: string,
  body: string,
  options?: { channelId?: string }
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  await ensureInitialized();

  await LocalNotifications.schedule({
    notifications: [
      {
        id: nextNotificationId(),
        title,
        body,
        channelId: options?.channelId ?? CHANNEL_ID,
      },
    ],
  });
}

export async function initializeAndroidNotifications(): Promise<void> {
  await ensureInitialized();
}

export async function showTransactionSuccessNotification(
  total: number,
  invoiceNumber?: string
): Promise<void> {
  if (!isTransactionSuccessNotificationEnabled()) return;

  const body = invoiceNumber
    ? `Transaksi ${invoiceNumber} sebesar ${formatRupiah(total)} berhasil`
    : `Transaksi sebesar ${formatRupiah(total)} berhasil`;

  await scheduleNotification('Transaksi Berhasil', body, {
    channelId: TRANSACTION_CHANNEL_ID,
  });
}

export async function showPrinterNotConnectedNotification(message?: string): Promise<void> {
  if (!isPrintNotificationEnabled()) return;

  await scheduleNotification(
    'Printer Tidak Terhubung',
    message || 'Pastikan printer Bluetooth menyala dan sudah dipasangkan di pengaturan.'
  );
}

export async function showPrintSuccessNotification(
  total: number,
  invoiceNumber?: string
): Promise<void> {
  if (!isPrintNotificationEnabled()) return;

  const body = invoiceNumber
    ? `Print ${invoiceNumber} sebesar ${formatRupiah(total)} berhasil`
    : `Print sebesar ${formatRupiah(total)} berhasil`;

  await scheduleNotification('Cetak Berhasil', body);
}
