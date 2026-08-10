import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Loads the public Discord Client ID (from env) once on mount.
 *
 * `error` is true when the backend could not be reached at all (so the caller
 * can show a "server unreachable" message instead of blaming a missing
 * Client ID).
 */
export function usePublicConfig(): {
  clientId: string;
  loading: boolean;
  error: boolean;
} {
  const load = useAction(api.public.publicConfig);
  const [clientId, setClientId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    load()
      .then((res) => {
        if (alive) {
          setClientId(res?.clientId ?? "");
          setError(false);
        }
      })
      .catch(() => {
        if (alive) {
          setClientId("");
          setError(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [load]);
  return { clientId: clientId ?? "", loading: clientId === null, error };
}
