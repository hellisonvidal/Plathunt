export type TrophyType = "bronze" | "silver" | "gold" | "platinum";

export interface Counts {
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
}

export interface Profile {
  accountId: string;
  onlineId: string;
  avatarUrl: string | null;
  aboutMe: string | null;
  isPlus: boolean;
  /** null quando o perfil de troféus é privado. */
  level: number | null;
  /** % para o próximo nível. */
  levelProgress: number | null;
  earned: Counts | null;
}

/** Jogo da lista de "jogados" da PSN (PS4/PS5), com tempo de jogo. */
export interface PlayedGame {
  titleId: string;
  name: string;
  imageUrl: string | null;
  /** Tempo de jogo em segundos. */
  playSeconds: number;
  /** "PS5", "PS4" ou null (da categoria da PSN: ps5_native_game, ps4_game…). */
  platform: string | null;
  lastPlayed: string | null;
}

/** Grupo de troféus: "default" é o jogo base; "001", "002"… são DLCs. */
export interface TrophyGroup {
  id: string;
  name: string;
  iconUrl: string | null;
  defined: Counts;
}

export interface Title {
  id: string; // npCommunicationId
  service: "trophy" | "trophy2";
  name: string;
  iconUrl: string | null;
  platform: string;
  progress: number;
  earned: Counts;
  defined: Counts;
  lastUpdated: string;
  hasGroups: boolean;
}

export interface TrophyRow {
  id: number;
  type: TrophyType;
  name: string;
  detail: string | null;
  iconUrl: string | null;
  hidden: boolean;
  groupId: string;
  earned: boolean;
  earnedAt: string | null;
  /** % de jogadores que têm o troféu. */
  rate: number | null;
}

export interface FeedItem {
  key: string;
  owner: { accountId: string; onlineId: string; avatarUrl: string | null; isMe: boolean };
  game: { id: string; service: Title["service"]; name: string; iconUrl: string | null; platform: string };
  trophy: { id: number; type: TrophyType; name: string; detail: string | null; iconUrl: string | null };
  earnedAt: string;
  rate: number | null;
}

/** Tudo que as telas precisam. Há uma implementação real (PSN) e uma de demonstração. */
export interface PsnClient {
  me(force?: boolean): Promise<Profile>;
  /** Lista completa de jogos com troféus. */
  titles(accountId: string, force?: boolean): Promise<Title[]>;
  /** Só os 100 jogos mais recentes (mais leve, para a lista de amigos). */
  recentTitles(accountId: string, force?: boolean): Promise<Title[]>;
  /** Jogos jogados com tempo de jogo; null se o perfil não permitir. */
  playedGames(accountId: string, force?: boolean): Promise<PlayedGame[] | null>;
  trophyGroups(game: { id: string; service: Title["service"] }): Promise<TrophyGroup[]>;
  gameTrophies(accountId: string, game: { id: string; service: Title["service"] }, force?: boolean): Promise<TrophyRow[]>;
  /** Todos os amigos da PSN (só os ids, em uma ou mais páginas). */
  friendIds(force?: boolean): Promise<string[]>;
  /** Perfis de todos os amigos (carrega cada um; pode demorar com listas grandes). */
  friends(force?: boolean): Promise<Profile[]>;
  profile(accountId: string, force?: boolean): Promise<Profile>;
  feed(force?: boolean): Promise<FeedItem[]>;
}
