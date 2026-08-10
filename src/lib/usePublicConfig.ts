import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

/** Loads the public Discord Client ID (from env) once on mount. */
export function usePublicConfig(): { clientId: string; loading: boolean } {
  const load = useAction(api.public.publicConfig);
  const [clientId, setClientId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    load()
      .then((res) => {
        if (alive) setClientId(res?.clientId ?? "");
      })
      .catch(() => {
        if (alive) setClientId("");
      });
    return () => {
      alive = false;
    };
  }, [load]);
  return { clientId: clientId ?? "", loading: clientId === null };
}
