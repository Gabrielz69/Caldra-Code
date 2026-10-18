/** Estado da cota diária do VISION para a UI (chip + modal de esgotado). */

import { useCallback, useEffect, useState } from "react";
import { useFeatureAccess } from "@/lib/subscription/SubscriptionProvider";
import { FREE_DAILY_VECTORIZATIONS, consumeUsage, readLocal, syncUsage } from "./visionQuota";

export function useVisionQuota(active: boolean) {
  const { plan } = useFeatureAccess();
  const unlimited = plan !== "free";
  const [used, setUsed] = useState(0);

  useEffect(() => {
    if (!active || unlimited) return;
    setUsed(readLocal().count);
    let alive = true;
    void syncUsage().then((u) => {
      if (alive) setUsed(u.count);
    });
    return () => {
      alive = false;
    };
  }, [active, unlimited]);

  const remaining = Math.max(0, FREE_DAILY_VECTORIZATIONS - used);
  const exhausted = !unlimited && remaining <= 0;

  const consume = useCallback(async () => {
    if (unlimited) return true;
    const usage = await consumeUsage();
    setUsed(usage.count);
    return usage.count <= FREE_DAILY_VECTORIZATIONS;
  }, [unlimited]);

  return { unlimited, used, remaining, exhausted, consume, limit: FREE_DAILY_VECTORIZATIONS };
}
