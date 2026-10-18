/**
 * Gêneros dos jogos para os Méritos. A PSN não informa o gênero de um jogo,
 * então o app reconhece pelo nome do jogo (franquias e palavras típicas de
 * cada gênero). Um jogo pode ter mais de um gênero; jogos que o app não
 * reconhece ficam sem gênero.
 */
export interface Genre {
  id: string;
  /** Nome em português (chave de tradução). */
  label: string;
  icon: string;
  patterns: RegExp;
}

const words = (list: string[]) => new RegExp(`\\b(${list.join("|")})\\b`);

export const GENRES: Genre[] = [
  {
    id: "acao",
    label: "Ação e Aventura",
    icon: "⚔️",
    patterns: words([
      "god of war", "uncharted", "the last of us", "spider man", "horizon", "ghost of tsushima", "tomb raider",
      "assassin s creed", "batman", "devil may cry", "bayonetta", "ratchet", "jak and daxter", "infamous", "days gone",
      "death stranding", "marvel s", "star wars jedi", "god of war ragnarok", "sly cooper", "prince of persia",
      "shadow of the colossus", "ico", "the order 1886", "detroit", "heavy rain", "beyond two souls", "until dawn",
      "gravity rush", "kena", "stray", "a plague tale", "lego",
    ]),
  },
  {
    id: "rpg",
    label: "RPG",
    icon: "🧙",
    patterns: words([
      "final fantasy", "persona", "dragon quest", "the witcher", "witcher", "elder scrolls", "skyrim", "fallout",
      "mass effect", "dragon age", "kingdom hearts", "ni no kuni", "tales of", "yakuza", "like a dragon", "diablo",
      "baldur s gate", "divinity", "cyberpunk", "star ocean", "xenoblade", "atelier", "disgaea", "trails", "ys",
      "octopath", "nier", "monster hunter", "pillars of eternity", "hogwarts legacy", "starfield", "path of exile",
    ]),
  },
  {
    id: "tiro",
    label: "Tiro",
    icon: "🔫",
    patterns: words([
      "call of duty", "battlefield", "killzone", "resistance", "destiny", "borderlands", "far cry", "doom", "wolfenstein",
      "bioshock", "overwatch", "rainbow six", "apex legends", "titanfall", "halo", "metro", "crysis", "medal of honor",
      "splatoon", "the division", "ghost recon", "sniper elite", "returnal", "deathloop", "helldivers", "valorant",
      "fortnite", "pubg", "warzone", "counter strike", "payday",
    ]),
  },
  {
    id: "corrida",
    label: "Corrida",
    icon: "🏎️",
    patterns: words([
      "gran turismo", "need for speed", "f1", "forza", "dirt", "wrc", "burnout", "the crew", "project cars", "driveclub",
      "ride", "motogp", "mx vs atv", "crash team racing", "mario kart", "assetto corsa", "grid", "wreckfest", "hot wheels",
      "nascar", "trackmania", "sonic racing", "riders republic", "monster jam",
    ]),
  },
  {
    id: "esportes",
    label: "Esportes",
    icon: "⚽",
    patterns: words([
      "fifa", "ea sports fc", "pes", "efootball", "pro evolution soccer", "nba", "madden", "nhl", "mlb", "ufc", "wwe",
      "tony hawk", "skate", "pga tour", "golf", "tennis", "rocket league", "fight night", "steep", "olympic", "rugby",
      "cricket", "football manager", "top spin", "everybody s golf", "knockout city",
    ]),
  },
  {
    id: "luta",
    label: "Luta",
    icon: "🥊",
    patterns: words([
      "mortal kombat", "tekken", "street fighter", "soulcalibur", "soul calibur", "dragon ball fighterz", "guilty gear",
      "injustice", "king of fighters", "dead or alive", "blazblue", "virtua fighter", "naruto shippuden", "jump force",
      "multiversus", "brawlhalla", "granblue fantasy versus", "under night",
    ]),
  },
  {
    id: "terror",
    label: "Terror",
    icon: "👻",
    patterns: words([
      "resident evil", "silent hill", "dead space", "outlast", "the evil within", "until dawn", "alan wake", "amnesia",
      "layers of fear", "little nightmares", "dead by daylight", "the quarry", "alien isolation", "the callisto protocol",
      "five nights at freddy s", "visage", "the medium", "until dawn", "dying light", "state of decay", "fatal frame",
      "man of medan", "little hope", "house of ashes", "the dark pictures",
    ]),
  },
  {
    id: "plataforma",
    label: "Plataforma",
    icon: "🍄",
    patterns: words([
      "crash bandicoot", "spyro", "sackboy", "littlebigplanet", "astro bot", "astro s playroom", "rayman", "sonic",
      "celeste", "hollow knight", "ori and", "cuphead", "limbo", "inside", "spelunky", "shovel knight", "yooka laylee",
      "psychonauts", "a hat in time", "it takes two", "unravel", "trine", "puppeteer", "knack", "tearaway", "ape escape",
      "klonoa", "super meat boy", "dead cells", "blasphemous",
    ]),
  },
  {
    id: "soulslike",
    label: "Soulslike",
    icon: "🗡️",
    patterns: words([
      "dark souls", "demon s souls", "bloodborne", "elden ring", "sekiro", "nioh", "lies of p", "lords of the fallen",
      "the surge", "code vein", "mortal shell", "wo long", "salt and sanctuary", "remnant", "steelrising", "thymesia",
      "black myth",
    ]),
  },
  {
    id: "mundoAberto",
    label: "Mundo Aberto",
    icon: "🗺️",
    patterns: words([
      "grand theft auto", "gta", "red dead", "far cry", "horizon", "ghost of tsushima", "assassin s creed", "the witcher",
      "skyrim", "fallout", "elden ring", "watch dogs", "just cause", "saints row", "mad max", "middle earth", "sleeping dogs",
      "days gone", "infamous", "spider man", "cyberpunk", "hogwarts legacy", "mafia", "the crew", "forza horizon",
      "no man s sky", "minecraft", "palworld",
    ]),
  },
  {
    id: "estrategia",
    label: "Estratégia",
    icon: "♟️",
    patterns: words([
      "xcom", "civilization", "tropico", "frostpunk", "into the breach", "valkyria chronicles", "fire emblem",
      "final fantasy tactics", "company of heroes", "age of empires", "they are billions", "mutant year zero", "phoenix point",
      "halo wars", "command conquer", "stellaris", "crusader kings", "total war", "advance wars", "triangle strategy",
      "tactics ogre", "darkest dungeon", "slay the spire", "plants vs zombies",
    ]),
  },
  {
    id: "puzzle",
    label: "Quebra-cabeça",
    icon: "🧩",
    patterns: words([
      "portal", "the witness", "tetris", "puyo", "the talos principle", "fez", "braid", "baba is you", "superliminal",
      "the room", "captain toad", "q b e r t", "lumines", "catherine", "unpacking", "monument valley", "manifold garden",
      "tricky towers", "human fall flat", "overcooked", "moving out", "pathless", "gris", "journey", "flower", "abzu",
    ]),
  },
  {
    id: "musica",
    label: "Música e Ritmo",
    icon: "🎵",
    patterns: words([
      "guitar hero", "rock band", "just dance", "singstar", "beat saber", "thumper", "hatsune miku", "project diva",
      "persona 5 dancing", "persona 3 dancing", "crypt of the necrodancer", "sayonara wild hearts", "taiko", "dj hero",
      "rez", "tetris effect", "hi fi rush", "patapon", "parappa", "fuser",
    ]),
  },
  {
    id: "furtividade",
    label: "Furtividade",
    icon: "🥷",
    patterns: words([
      "metal gear", "hitman", "splinter cell", "dishonored", "thief", "tenchu", "sly cooper", "styx", "mark of the ninja",
      "aragami", "shadow tactics", "deus ex", "assassin s creed", "ghost of tsushima", "the last of us", "a plague tale",
      "sniper elite", "invisible inc",
    ]),
  },
  {
    id: "simulacao",
    label: "Simulação",
    icon: "🛠️",
    patterns: words([
      "the sims", "stardew valley", "farming simulator", "euro truck", "american truck", "cities skylines", "planet coaster",
      "planet zoo", "two point", "jurassic world evolution", "house flipper", "powerwash simulator", "goat simulator",
      "microsoft flight simulator", "animal crossing", "story of seasons", "harvest moon", "train sim", "snowrunner",
      "mudrunner", "car mechanic", "surgeon simulator", "job simulator", "no man s sky", "minecraft",
    ]),
  },
];

/** Nome comparável: minúsculas, sem acentos, sem ™/®, só letras e números. */
export const normalizeTitle = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[™®©]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Gêneros reconhecidos pelo nome do jogo. */
export function genresOf(name: string): string[] {
  const n = normalizeTitle(name);
  return GENRES.filter((g) => g.patterns.test(n)).map((g) => g.id);
}
