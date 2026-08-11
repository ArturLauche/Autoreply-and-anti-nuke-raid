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
  discordInvite: string;
  facebookUrl: string;
  loading: boolean;
  error: boolean;
} {
  const load = useAction(api.public.publicConfig);
  const [clientId, setClientId] = useState<string | null>(null);
  const [discordInvite, setDiscordInvite] = useState("https://discord.gg/rftv");
  const [facebookUrl, setFacebookUrl] = useState(
    "https://www.facebook.com/profile.php?id=61592820547312",
  );
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    load()
      .then((res) => {
        if (alive) {
          setClientId(res?.clientId ?? "");
          setDiscordInvite(res?.discordInvite ?? "https://discord.gg/rftv");
          setFacebookUrl(
            res?.facebookUrl ??
              "https://www.facebook.com/profile.php?id=61592820547312",
          );
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
  return {
    clientId: clientId ?? "",
    discordInvite,
    facebookUrl,
    loading: clientId === null,
    error,
  };
}
