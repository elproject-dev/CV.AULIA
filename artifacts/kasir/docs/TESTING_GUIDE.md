# Kasir App - Bluetooth Printer Connection Testing Guide

## ✅ Current Status
- **App Version**: 1.0 (Build 6/7/2026)
- **APK Location**: `android/app/build/outputs/apk/debug/app-debug.apk` (4.41 MB)
- **Installation Status**: ✅ Installed on device (com.sbagiamu.app)
- **Device**: Xiaomi Redmi Note 9 Pro (e88b3f6b)
- **Target Android Version**: API 30+

## 🔧 Implementation Details

### Bluetooth Functionality Implemented
All code is in `src/lib/bluetooth-printer.ts`:

1. **Plugin Detection** (`getBluetoothSerial()`)
   - Checks multiple possible plugin locations
   - Handles cases where plugin may not be available
   - Provides clear error messages

2. **Initialization** (`initializeBluetooth()`)
   - Requests Bluetooth permissions (Android 12+)
   - Enables Bluetooth on device
   - Sets up internal state flags
   - Called automatically on app startup (see `src/App.tsx`)

3. **Connection Management**
   - `connectToPrinter(macAddress)` - Connects to Bluetooth printer
   - `disconnectPrinter()` - Safely disconnects
   - Validates MAC address against paired devices
   - Includes detailed error handling

4. **Printing Functions**
   - `printRaw(data)` - Print raw data
   - `printReceipt(receiptData)` - Print formatted receipt
   - ESC/POS thermal printer command support
   - Automatic formatting and alignment

### Settings Page Integration
Location: `src/pages/settings.tsx`

**Bluetooth Settings Section:**
- MAC Address input field (format: XX:XX:XX:XX:XX:XX)
- "Test Connection" button
- Real-time connection status indicator
- Stores preference in localStorage
- Auto-print option for transactions

## 🧪 Testing Instructions

### Step 1: Prepare Bluetooth Printer
1. Turn on your thermal Bluetooth printer
2. On Android device, go to Settings > Bluetooth
3. Search for Bluetooth devices
4. Pair the printer when it appears
5. Note the MAC address from paired devices list

### Step 2: Configure in App
1. Open Kasir app
2. Tap hamburger menu → Settings
3. Scroll to "Pengaturan Struk" (Receipt Settings) section
4. In "Alamat MAC Printer Bluetooth" field, paste the MAC address
5. Example format: `00:11:22:33:44:55`

### Step 3: Test Connection
1. Keep the printer nearby (Bluetooth range: ~10 meters)
2. Click "Tes Koneksi Printer" button
3. Wait for result (usually 3-5 seconds)

### Expected Results

**✅ Success**: 
- Green checkmark appears
- Message: "Printer terhubung berhasil"
- Toast notification confirms connection

**❌ Failure**:
- Red X appears
- Error message displayed
- Common errors:
  - "Printer dengan MAC [address] tidak ditemukan dalam daftar paired devices"
    → Solution: Pair printer in Android Bluetooth settings first
  - "BluetoothSerial plugin tidak ditemukan"
    → Solution: Rebuild and reinstall APK
  - "Izin Bluetooth ditolak"
    → Solution: Grant Bluetooth permissions in app settings

## 🔍 Debugging

### View Detailed Logs
Connect to desktop and run:
```bash
adb logcat | grep -i bluetooth
```

Or for all app logs:
```bash
adb logcat | grep chromium
```

### Check Device Connection
```bash
adb shell pm list features | grep bluetooth
```

### Permissions Check
On device: Settings > Apps > Kasir > Permissions
Ensure these are granted:
- ✅ Nearby devices
- ✅ Precise location
- ✅ Approximate location
- ✅ Bluetooth

## 📱 Permissions Configured
The app includes these permissions in `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

## 🛠️ Troubleshooting

### Issue: Button appears disabled
**Cause**: No MAC address entered
**Fix**: Enter the Bluetooth printer MAC address in the settings field

### Issue: Connection timeout
**Cause**: Printer not in range or not powered on
**Fix**: 
1. Check printer is turned on
2. Verify Bluetooth is enabled on device
3. Move closer to printer
4. Ensure printer is already paired in Android Bluetooth settings

### Issue: "Plugin not found" error
**Cause**: Cordova plugin not installed or loaded
**Fix**:
1. Run: `npm run build && npm run android`
2. Rebuild APK from scratch
3. Reinstall on device

### Issue: Permission denied
**Cause**: User denied Bluetooth permissions
**Fix**:
1. Go to device Settings > Apps > Kasir
2. Tap Permissions
3. Grant all Bluetooth-related permissions
4. Restart app

## 🔄 Auto-Print Setup

Once connection is tested successfully:
1. Return to Settings
2. Enable "Auto Print Struk" toggle
3. When you complete a transaction in POS, struk will print automatically

## 📝 Notes
- Settings are saved to browser localStorage
- Bluetooth connection persists until manually disconnected
- App initializes Bluetooth on startup (permissions requested automatically)
- Toast notifications provide feedback for all actions
- Detailed console logs available in Chrome DevTools (remote debugging)

## 🎯 Next Steps After Testing
1. ✅ Test basic connection
2. ✅ Verify printer pairing
3. ✅ Test printing a receipt
4. ✅ Enable auto-print for transactions
5. ✅ Verify settings persist after app restart

---
**Last Updated**: 6/7/2026
**App Package**: com.sbagiamu.app
**Build Type**: Debug APK
