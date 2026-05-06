export interface M3UObject {
  title: string;
  url: string;
  group: string;
  logo?: string;
  category: 'Movie' | 'Series' | 'LiveStream';
  year?: number;
  season?: number;
  episode?: number;
}
