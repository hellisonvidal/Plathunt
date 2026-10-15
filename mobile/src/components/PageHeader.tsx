import { useNavigate } from "react-router-dom";

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
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">
      {back && (
        <button onClick={() => navigate(-1)} className="-ml-1 px-1 text-xl text-muted" aria-label="Voltar">
          ←
        </button>
      )}
      <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{title}</h1>
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Atualizar"
          className="rounded-full px-2 text-xl text-muted disabled:opacity-40"
        >
          <span className={refreshing ? "inline-block animate-spin" : ""}>⟳</span>
        </button>
      )}
    </header>
  );
}
