import { useCallback, useEffect, useState } from "react";
import { SessionExpired } from "../psn/auth";
import { useApp } from "../app";

/** Carrega dados da PSN para uma tela, com estado de carregando/erro e "atualizar". */
export function useData<T>(load: (force: boolean) => Promise<T>, deps: unknown[]) {
  const { signOut } = useApp();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const run = useCallback(
    (force: boolean) => {
      let alive = true;
      setLoading(true);
      setError(null);
      load(force)
        .then((d) => alive && setData(d))
        .catch((e) => {
          if (e instanceof SessionExpired) signOut(e.message);
          else if (alive) setError(e);
        })
        .finally(() => alive && setLoading(false));
      return () => {
        alive = false;
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );

  useEffect(() => run(false), [run]);
  return { data, error, loading, refresh: () => run(true) };
}
