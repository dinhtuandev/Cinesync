export interface MovieListItem {
  slug: string;
  name: string;
  originName: string;
  posterUrl: string;
  thumbUrl: string;
  year: number;
  quality: "HD" | "4K" | "FullHD";
  lang: "Vietsub" | "Lồng tiếng" | "Thuyết minh";
  episodeCurrent?: number;
  episodeTotal?: number;
}

export interface MovieCategory {
  name: string;
  slug: string;
}

export interface MovieDetail extends MovieListItem {
  content: string;
  time: string;
  actor: string[];
  director: string[];
  category: MovieCategory[];
  country: MovieCategory[];
  trailerUrl?: string | null;
}

export interface Episode {
  name: string;
  slug: string;
  linkEmbed: string;
  linkM3u8: string | null;
}

export interface EpisodeServer {
  serverName: string;
  serverData: Episode[];
}

export interface MovieDetailResponse {
  movie: MovieDetail;
  episodes: EpisodeServer[];
  /** Provider key ("vsmov"/"kkphim") — hiển thị nhãn "Nguồn 1"/"Nguồn 2" */
  source?: string;
  internal?: {
    avgRating: number;
    ratingCount: number;
    isFavorited: boolean;
    isInWatchlist: boolean;
    myProgressSeconds?: number;
  };
}
