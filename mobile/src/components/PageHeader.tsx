import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { t } from "../i18n";
import { SettingsIcon } from "./icons";
import { PullIndicator, usePullToRefresh } from "./PullToRefresh";

export function PageHeader({
  title,
  back,
  onRefresh,
  refreshing,
}: {
  title: string;
  back?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const navigate = useNavigate();
  // Para atualizar, puxe a tela para baixo (não há botão). O indicador gira
  // só nas atualizações feitas puxando (não na primeira carga da tela).
  const [fromPull, setFromPull] = useState(false);
  useEffect(() => {
    if (!refreshing) setFromPull(false);
  }, [refreshing]);
  const pull = usePullToRefresh(
    onRefresh && !refreshing
      ? () => {
          setFromPull(true);
          onRefresh();
        }
      : undefined,
  );

  return (
    <>
      <PullIndicator pull={pull} refreshing={fromPull && !!refreshing} />
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">
        {back && (
          <button onClick={() => navigate(-1)} className="-ml-1 px-1 text-xl text-muted" aria-label={t("Voltar")}>
            ←
          </button>
        )}
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{title}</h1>
        {!back && (
          <Link to="/settings" aria-label={t("Configurações")} className="rounded-full p-1 text-muted active:text-ink">
            <SettingsIcon />
          </Link>
        )}
      </header>
    </>
  );
}
