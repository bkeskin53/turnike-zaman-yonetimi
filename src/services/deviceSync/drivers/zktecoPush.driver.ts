import type { DeviceSyncDriver, DeviceSyncPullArgs, DeviceSyncPullResult } from "@/src/services/deviceSync/driver";

/**
 * ZKTECO_PUSH (placeholder)
 *
 * Push modunda cihaz logları bize "itiyor".
 * Bu durumda /sync endpoint'i çoğu zaman 0 dönebilir veya health-check gibi çalışabilir.
 */
export const zktecoPushDriver: DeviceSyncDriver = {
  name: "ZKTECO_PUSH",
  async pull(_args: DeviceSyncPullArgs): Promise<DeviceSyncPullResult> {
    throw new Error("ZKTECO_PUSH_NOT_IMPLEMENTED");
  },
};
