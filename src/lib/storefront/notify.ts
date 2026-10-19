export const STORE_CHANNEL = "seen-storefront-updates";
export const STORE_STORAGE_KEY = "seen.storefront.updated";
export const STORE_UPDATED_EVENT = "seen:storefront-updated";

export function notifyStorefront() {
  try {
    const channel = new BroadcastChannel(STORE_CHANNEL);
    channel.postMessage("updated");
    channel.close();
  } catch {
    /* Storage/focus and version checks also keep the store fresh. */
  }
  try {
    localStorage.setItem(STORE_STORAGE_KEY, String(Date.now()));
  } catch {
    /* Storage may be disabled. */
  }
}
