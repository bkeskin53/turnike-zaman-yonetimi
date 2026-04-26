const EMPLOYEES_LIST_CHANGED_STORAGE_KEY = "turnike:employees:list:changed";

export function notifyEmployeesListChanged(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      EMPLOYEES_LIST_CHANGED_STORAGE_KEY,
      JSON.stringify({
        at: Date.now(),
      }),
    );
  } catch {
    // storage erişimi engelliyse liste senkronizasyonu sessizce atlanır
  }
}

export function subscribeEmployeesListChanged(
  onChanged: () => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  function handleStorage(event: StorageEvent) {
    if (event.storageArea !== window.localStorage) return;
    if (event.key !== EMPLOYEES_LIST_CHANGED_STORAGE_KEY) return;
    if (event.newValue === event.oldValue) return;
    onChanged();
  }

  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener("storage", handleStorage);
  };
}