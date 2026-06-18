/**
 * Tauri file save helper
 * Detects if running inside Tauri webview and provides native file save dialog + write.
 */

/** Check if we're running inside a Tauri desktop app */
export function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
}

/**
 * Save a Uint8Array/ArrayBuffer as a file using Tauri's native save dialog.
 * Falls back to browser download if not in Tauri.
 */
export async function tauriSaveFile(
  data: Uint8Array | ArrayBuffer,
  defaultFilename: string,
  filters?: { name: string; extensions: string[] }[]
): Promise<boolean> {
  if (!isTauri()) return false;

  try {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");

    // Show native save dialog
    const filePath = await save({
      defaultPath: defaultFilename,
      filters: filters || [
        { name: "Excel Files", extensions: ["xlsx"] },
      ],
    });

    if (!filePath) {
      // User cancelled the dialog
      return true; // Return true to indicate Tauri handled it (just cancelled)
    }

    // Write file to the chosen path
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    await writeFile(filePath, bytes);

    return true;
  } catch (err) {
    console.error("Tauri save file error:", err);
    throw err;
  }
}
