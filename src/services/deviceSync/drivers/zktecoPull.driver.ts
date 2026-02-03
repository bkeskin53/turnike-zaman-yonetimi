import type { DeviceSyncDriver, DeviceSyncPullArgs, DeviceSyncPullResult } from "@/src/services/deviceSync/driver";

/**
 * ZKTECO_PULL (placeholder)
 *
 * Gerçek cihaz geldiğinde burada:
 * - cihazdan logları "pull" edip
 * - kartNo -> employeeId mapping yapıp
 * - stable externalRef üretip
 * DeviceSyncService'e vereceğiz.
 */
export const zktecoPullDriver: DeviceSyncDriver = {
  name: "ZKTECO_PULL",
  async pull(_args: DeviceSyncPullArgs): Promise<DeviceSyncPullResult> {
    throw new Error("ZKTECO_PULL_NOT_IMPLEMENTED");
  },
};
