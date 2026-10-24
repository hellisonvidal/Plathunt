import { getSettings } from "./settings";

interface NetworkInformation {
  /** Economia de dados do Android/Chrome ligada. */
  saveData?: boolean;
  /** "cellular", "wifi", "ethernet"... (quando o WebView informa). */
  type?: string;
}

/**
 * O app está economizando dados agora? Em "Automático", sim nos dados móveis
 * (4G/5G) ou com a economia de dados do Android ligada; no Wi-Fi, não.
 */
export function savingData(): boolean {
  const mode = getSettings().dataSaver;
  if (mode === "on") return true;
  if (mode === "off") return false;
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return !!connection && (connection.saveData === true || connection.type === "cellular");
}
