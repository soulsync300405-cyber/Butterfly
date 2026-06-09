export const SPOTIFY_CLIENT_ID = "4bc982e031f44c728253098569d69c11";

function generateRandomString(length: number) {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function generateCodeChallenge(codeVerifier: string) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function redirectToAuthCodeFlow(clientId: string) {
  const verifier = generateRandomString(128);
  const challenge = await generateCodeChallenge(verifier);

  localStorage.setItem("verifier", verifier);

  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("response_type", "code");
  
  // Use current origin as redirect URI, fallback to window.location.origin
  // To avoid Vercel 404s, we will just use the root path since we check `window.location.search` in App.tsx
  let redirectUri = window.location.origin;
  if (redirectUri.endsWith('/')) redirectUri = redirectUri.slice(0, -1);
  // Wait, in the developer dashboard we added "https://soulsync-30.vercel.app/callback". 
  // Let's use exactly what was requested, or let's use the origin + /callback to be safe, but they added `/callback` explicitly in the screenshot!
  // I'll stick to `${window.location.origin}/callback`
  redirectUri = `${redirectUri}/callback`;
  
  params.append("redirect_uri", redirectUri);
  params.append("scope", "user-read-private user-read-email user-top-read playlist-read-private");
  params.append("code_challenge_method", "S256");
  params.append("code_challenge", challenge);

  document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function getAccessToken(clientId: string, code: string): Promise<string> {
  const verifier = localStorage.getItem("verifier");

  let redirectUri = window.location.origin;
  if (redirectUri.endsWith('/')) redirectUri = redirectUri.slice(0, -1);
  redirectUri = `${redirectUri}/callback`;

  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", redirectUri);
  params.append("code_verifier", verifier!);

  const result = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });

  const { access_token } = await result.json();
  return access_token;
}

export async function fetchProfile(token: string): Promise<any> {
  const result = await fetch("https://api.spotify.com/v1/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` }
  });
  return await result.json();
}

export async function fetchTopTracks(token: string): Promise<any> {
  const result = await fetch("https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=10", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` }
  });
  return await result.json();
}
