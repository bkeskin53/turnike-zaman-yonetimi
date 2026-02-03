import type { DeviceSyncDriver, DeviceSyncPullArgs, DeviceSyncPullResult } from "@/src/services/deviceSync/driver";

/**
 * GENERIC (placeholder)
 * İleride farklı markalar için ortak driver veya CSV/SDK entegrasyon...
 */
export const genericDriver: DeviceSyncDriver = {
  name: "GENERIC",
  async pull(_args: DeviceSyncPullArgs): Promise<DeviceSyncPullResult> {
    throw new Error("GENERIC_DRIVER_NOT_IMPLEMENTED");
  },
};
