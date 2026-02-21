// lib/counter-api.ts
// Simple counter implementation without Firebase dependencies

/**
 * Get the total number of obfuscations performed
 * Uses localStorage in browser, returns default value on server
 */
export async function getTotalObfuscations(): Promise<number> {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('xzx-total-obfuscations');
      if (stored) {
        const parsed = parseInt(stored, 10);
        // Validate it's a number
        if (!isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
    } catch (error) {
      console.error('Error reading from localStorage:', error);
    }
    // Default starting value
    return 150;
  }
  // Server-side rendering fallback
  return 150;
}

/**
 * Increment the total obfuscations counter
 * Returns the new count
 */
export async function incrementTotalObfuscations(): Promise<number> {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    try {
      const current = await getTotalObfuscations();
      const newCount = current + 1;
      localStorage.setItem('xzx-total-obfuscations', newCount.toString());
      return newCount;
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  }
  // Fallback if localStorage fails or on server
  return 151;
}

/**
 * Reset the counter to its default value
 * Useful for testing or admin purposes
 */
export async function resetTotalObfuscations(): Promise<number> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('xzx-total-obfuscations', '150');
      return 150;
    } catch (error) {
      console.error('Error resetting counter:', error);
    }
  }
  return 150;
}

/**
 * Get counter statistics
 * Returns object with count and metadata
 */
export async function getCounterStats(): Promise<{
  count: number;
  lastUpdated: string;
  source: 'local' | 'server';
}> {
  const count = await getTotalObfuscations();
  
  return {
    count,
    lastUpdated: new Date().toISOString(),
    source: typeof window !== 'undefined' ? 'local' : 'server'
  };
}

// Default export for convenience
export default {
  getTotalObfuscations,
  incrementTotalObfuscations,
  resetTotalObfuscations,
  getCounterStats
};
