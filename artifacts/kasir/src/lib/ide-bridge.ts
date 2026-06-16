// IDE Bridge Client Utility
const BRIDGE_URL = `http://${window.location.hostname || 'localhost'}:8098/collect`;

export async function sendToIde(type: 'log' | 'error' | 'element' | 'state', data: any) {
  // Only execute in development mode
  if (!import.meta.env.DEV) return;

  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  try {
    await fetch(BRIDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type,
        content,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    // Fail silently in development so we don't spam console
  }
}

// Bind utilities to window for easy developer access in console
if (import.meta.env.DEV) {
  (window as any).sendToIde = sendToIde;

  // Utility to send details of a specific element
  (window as any).sendElementToIde = (selector: string) => {
    const el = document.querySelector(selector);
    if (el) {
      sendToIde('element', el.outerHTML);
      console.log(`[IDE Bridge] Sent HTML element "${selector}" to IDE Bridge`);
    } else {
      console.warn(`[IDE Bridge] Element with selector "${selector}" not found`);
    }
  };

  // Automatically hook console.error to report errors to IDE
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const formattedError = args
      .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
      .join(' ');

    sendToIde('error', formattedError);
    originalConsoleError.apply(console, args);
  };

  console.log('[IDE Bridge Client] Initialized. Call sendToIde(type, data) or sendElementToIde(selector) to inspect.');
}
