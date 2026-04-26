let dataManagementDirtyGuardActive = false;

export const DATA_MANAGEMENT_DIRTY_GUARD_MESSAGE =
  "Kaydedilmemiş değişiklikler var. Bu sayfadan çıkarsan taslak değişiklikler kaybolacak. Devam etmek istiyor musun?";

export function setDataManagementDirtyGuardActive(active: boolean) {
  dataManagementDirtyGuardActive = active;
}

export function isDataManagementDirtyGuardActive() {
  return dataManagementDirtyGuardActive;
}

export function clearDataManagementDirtyGuard() {
  dataManagementDirtyGuardActive = false;
}

export function confirmDataManagementNavigationIfDirty() {
  if (!dataManagementDirtyGuardActive) {
    return true;
  }

  if (typeof window === "undefined") {
    return true;
  }

  return window.confirm(DATA_MANAGEMENT_DIRTY_GUARD_MESSAGE);
}