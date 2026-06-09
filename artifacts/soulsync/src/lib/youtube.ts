export const YOUTUBE_API_KEY = "AIzaSyDViQ_AYCzABHahxuukHDOAiBVlzX_yLq0";

export interface YouTubeSearchResult {
  id: {
    videoId: string;
  };
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      default: { url: string };
      medium: { url: string };
      high: { url: string };
    };
    channelTitle: string;
  };
}

export async function searchYouTube(query: string): Promise<YouTubeSearchResult[]> {
  if (!query.trim()) return [];
  
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encodeURIComponent(query)}&type=video&key=${YOUTUBE_API_KEY}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.statusText}`);
    }
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error("Failed to search YouTube:", error);
    return [];
  }
}
