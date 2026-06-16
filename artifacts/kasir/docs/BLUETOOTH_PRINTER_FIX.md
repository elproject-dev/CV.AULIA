# Perbaikan Koneksi Bluetooth Printer

## Ringkasan Masalah dan Solusi

### Masalah yang Diperbaiki
1. **Plugin BluetoothSerial tidak terdeteksi** - Plugin tidak ditemukan dengan cara yang benar
2. **Permission tidak diminta dengan benar** - Android 12+ memerlukan runtime permission request yang proper
3. **Initialization tidak done saat startup** - Bluetooth tidak diinisialisasi saat app start
4. **Error handling kurang detail** - Pesan error tidak informatif untuk debugging

### Solusi yang Diterapkan

#### 1. **Bluetooth Plugin Detection** (`src/lib/bluetooth-printer.ts`)
```typescript
// Sebelum: Menggunakan declare const BluetoothSerial
// Sesudah: Menggunakan helper function getBluetoothSerial()
```
- Mencari plugin di berbagai lokasi yang mungkin
- Handle kasus dimana plugin belum fully loaded

#### 2. **Permission Handling** 
- Membuat function terpisah `initializeBluetooth()` untuk handling:
  - Request Bluetooth permission (Android 12+)
  - Enable Bluetooth
  - Proper error messages
  
#### 3. **App Startup Initialization** (`src/App.tsx`)
- Menambah `initializeBluetooth()` call di `useEffect`
- Permission diminta lebih awal sebelum user mencoba connect

#### 4. **Better Error Messages & Logging**
- Detail console logging di setiap step connection
- Informative error messages untuk user

---

## Step-by-Step Testing Guide

### Prerequisites
- Printer Bluetooth sudah dipair di Android device settings
- MAC address printer sudah diketahui (format: `XX:XX:XX:XX:XX:XX`)

### Step 1: Rebuild APK dengan perbaikan terbaru
```bash
cd c:\Users\Administrator\Desktop\SBAGIAMU\artifacts\kasir

# Build web app
npm run build

# Build APK (jika menggunakan Capacitor)
npx cap build android
# atau jika using Cordova:
npx cordova build android --release
```

### Step 2: Install APK ke Device
```bash
# Via Android Studio atau:
cd android
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### Step 3: Test pada App Startup
1. **Buka app baru** setelah install
2. **Buka browser DevTools** (Chrome → `chrome://inspect/#devices`)
3. **Perhatikan console logs**, seharusnya melihat:
   ```
   ✓ Bluetooth initialized successfully
   BluetoothSerial plugin ditemukan
   ```
   Jika tidak, akan melihat warning dengan pesan detail

### Step 4: Test Connection di Settings
1. **Buka Settings page** (icon settings di bottom navigation)
2. **Scroll ke Printer Bluetooth section**
3. **Input MAC address** printer yang sudah dipair
4. **Click "Test Connection"** button
5. **Perhatikan hasil**, seharusnya melihat:
   - ✅ **Connected**: `Berhasil terhubung ke printer`
   - ❌ **Failed**: Error message yang detail

### Step 5: Monitor Logs saat Connect
Buka DevTools Console untuk melihat detail logs:
```
connectToPrinter() → initializeBluetooth() → listBluetoothDevices() → BT.connect()
```

---

## Troubleshooting Guide

### Problem 1: "BluetoothSerial plugin tidak tersedia"
**Penyebab:** Plugin Cordova tidak terinstall dengan benar

**Solusi:**
```bash
# Di folder android:
cordova plugin add cordova-plugin-bluetooth-serial

# atau di root project:
npm install cordova-plugin-bluetooth-serial
```

### Problem 2: "Izin Bluetooth ditolak"
**Penyebab:** Permission request dialak user

**Solusi:**
1. Go to: `Settings → Apps → [Your App Name] → Permissions`
2. Enable: `Bluetooth`, `Bluetooth Admin`, `Bluetooth Connect`, `Bluetooth Scan`
3. Re-open app

### Problem 3: "Device tidak ditemukan dalam paired devices"
**Penyebab:** 
- MAC address salah
- Printer belum dipair
- Printer tidak aktif

**Solusi:**
1. Verify MAC address di: `Android Settings → Bluetooth → [Paired Devices]`
2. Pastikan printer dipair terlebih dahulu
3. Pastikan printer menyala

### Problem 4: "Connected tapi tidak bisa print"
**Penyebab:** 
- Data format salah untuk printer
- Printer buffer penuh
- Connection timeout

**Solusi:**
1. Coba lagi setelah beberapa detik
2. Disconnect → Connect ulang
3. Cek console logs untuk data yang dikirim
4. Test dengan app lain untuk verifikasi printer

---

## Console Logs Reference

### Normal Successful Connection Flow
```
BluetoothSerial plugin ditemukan
Requesting Bluetooth permissions...
Bluetooth permissions granted
Enabling Bluetooth...
Bluetooth enabled successfully
Bluetooth initialization successful
✓ Bluetooth initialized successfully
```

### Connection to Printer Flow
```
Attempting to connect to printer: AA:BB:CC:DD:EE:FF
Bluetooth not ready, initializing...
[initialization logs...]
Listing paired Bluetooth devices...
Devices found: [array of devices]
Device found: [Printer Name] (aa:bb:cc:dd:ee:ff)
Connecting to AA:BB:CC:DD:EE:FF...
Successfully connected to AA:BB:CC:DD:EE:FF
Printer connection established: AA:BB:CC:DD:EE:FF
```

### Print Data Flow
```
Sending 2048 bytes to printer...
Data sent to printer successfully
Receipt berhasil dicetak
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/bluetooth-printer.ts` | Core Bluetooth connection logic |
| `src/App.tsx` | Added Bluetooth initialization on startup |
| `android/app/src/main/AndroidManifest.xml` | Already has required permissions |

---

## Technical Details

### New Functions Exported
- `initializeBluetooth()` - Initialize and request permissions
- `isPrinterConnected()` - Check if printer is currently connected
- `setBluetoothPrinterMac(mac)` - Save printer MAC address

### Key Improvements
1. **Safe Plugin Access**: `getBluetoothSerial()` checks multiple locations
2. **Two-Phase Init**: Permissions first, then enable Bluetooth
3. **Detailed Logging**: Every step logged for debugging
4. **Delay Between Ops**: 500ms delay after disconnect before new connect
5. **Better Error Messages**: Specific error messages for each failure scenario

---

## Next Steps

### If Still Not Working:
1. **Check Android logs**: `adb logcat | grep -i bluetooth`
2. **Verify plugin installation**: Check if plugin files exist
3. **Test with other Bluetooth app**: Verify printer is working
4. **Check firewall/blocking**: Some apps block Bluetooth on certain devices

### Additional Notes:
- For Android 12+: BLUETOOTH_SCAN and BLUETOOTH_CONNECT permissions are critical
- Test connection feature in Settings page can be used to verify without printing
- Auto-print feature will use the last successful connection

---

**Last Updated:** June 7, 2026
**App Version:** v0.0.0
