// lib/counter-api.ts
const API_URL = 'https://api.countapi.xyz'; // Free counting API
const NAMESPACE = 'xzx-obfuscator';
const KEY = 'total-obfuscations';

export async function getTotalObfuscations(): Promise<number> {
  try {
    const response = await fetch(`${API_URL}/get/${NAMESPACE}/${KEY}`);
    const data = await response.json();
    return data.value || 150;
  } catch (error) {
    console.error('Failed to fetch count:', error);
    return 150; // Fallback to 150
  }
}

export async function incrementTotalObfuscations(): Promise<number> {
  try {
    const response = await fetch(`${API_URL}/hit/${NAMESPACE}/${KEY}`);
    const data = await response.json();
    return data.value;
  } catch (error) {
    console.error('Failed to increment count:', error);
    return 151; // Fallback
  }
}
