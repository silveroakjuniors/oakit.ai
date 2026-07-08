export interface FeedPost {
  id: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  post_scope: 'section' | 'school';
  section_label: string | null;
  poster_name: string;
  poster_role: 'teacher' | 'admin' | 'principal';
  images: string[];
  media_types?: string[];
  like_count: number;
  liked_by_me: boolean;
  instagram_shares?: number;
  facebook_shares?: number;
  downloads?: number;
}

export interface FeedResponse {
  posts: FeedPost[];
  next_cursor: string | null;
}
