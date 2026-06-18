import { Capacitor, registerPlugin } from '@capacitor/core';

interface AppSettingsPlugin {
  open(): Promise<void>;
}

const AppSettings = registerPlugin<AppSettingsPlugin>('AppSettings');

export async function openAndroidAppSettings(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return false;
  }

  await AppSettings.open();
  return true;
}

export function canOpenAndroidAppSettings(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}
