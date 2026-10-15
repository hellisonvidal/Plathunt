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
  earned: Counts | null;
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
  titles(accountId: string, force?: boolean): Promise<Title[]>;
  gameTrophies(accountId: string, game: { id: string; service: Title["service"] }, force?: boolean): Promise<TrophyRow[]>;
  friends(force?: boolean): Promise<Profile[]>;
  profile(accountId: string, force?: boolean): Promise<Profile>;
  feed(force?: boolean): Promise<FeedItem[]>;
}
