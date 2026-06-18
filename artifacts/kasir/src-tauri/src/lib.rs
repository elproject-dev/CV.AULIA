use bluetooth_serial_port::*;
use serde::{Serialize, Deserialize};
use std::io::Write;
use std::time::Duration;

#[derive(Serialize, Deserialize, Debug)]
pub struct BluetoothDevice {
    name: String,
    address: String,
}

#[tauri::command]
async fn list_bluetooth_devices() -> Result<Vec<BluetoothDevice>, String> {
    log::info!("Memulai pemindaian Bluetooth...");
    
    // Jalankan pemindaian di thread terpisah agar tidak memblokir UI
    let devices_result = tauri::async_runtime::spawn_blocking(|| {
        scan_devices(Duration::from_secs(5))
    }).await.map_err(|e| format!("Thread error: {}", e))?;

    match devices_result {
        Ok(devices) => {
            log::info!("Pemindaian selesai, ditemukan {} perangkat", devices.len());
            let mut result = Vec::new();
            for device in devices {
                result.push(BluetoothDevice {
                    name: device.name,
                    address: device.addr.to_string(),
                });
            }
            Ok(result)
        },
        Err(e) => {
            log::error!("Gagal memindai Bluetooth: {}", e);
            // Kembalikan list kosong daripada error jika hanya masalah hardware tidak ditemukan
            // agar aplikasi tidak crash di sisi frontend
            Err(format!("Bluetooth tidak merespons atau tidak aktif: {}", e))
        }
    }
}

#[tauri::command]
async fn print_bluetooth_data(address: String, data: Vec<u8>) -> Result<(), String> {
    log::info!("Mencoba mencetak ke {}", address);
    
    tauri::async_runtime::spawn_blocking(move || {
        let mut socket = BtSocket::new(BtProtocol::RFCOMM).map_err(|e| e.to_string())?;
        
        let addr = address.parse::<BtAddr>().map_err(|_| format!("Alamat MAC tidak valid: {}", address))?;
        
        socket.connect(addr).map_err(|e| format!("Gagal menyambung ke {}: {}", address, e))?;
        socket.write_all(&data).map_err(|e| format!("Gagal mengirim data: {}", e))?;
        
        log::info!("Cetak berhasil ke {}", address);
        Ok(())
    }).await.map_err(|e| format!("Thread error: {}", e))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
        list_bluetooth_devices,
        print_bluetooth_data
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
