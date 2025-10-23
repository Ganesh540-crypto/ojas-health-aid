export interface UserProfile {
  name?: string; // Display name
  email?: string;
  username?: string; // Handle-like username
  photoUrl?: string; // Uploaded profile photo URL (Firebase Storage)
  age?: number;
  heightCm?: number;
  weightKg?: number;
  allergies?: string[];
  preexisting?: string[];
  medications?: string[];
  // New fields for personalization and Pulse
  language?: string; // e.g., 'en', 'hi', etc.
  location?: string; // city or region
  interests?: string[]; // general interests for AI personalization
  pulseTopics?: string[]; // curated news topics for Pulse
  notifications?: {
    dailyDigest?: boolean;
    breakingNews?: boolean;
  };
}

import { auth } from './firebase';

const BASE_KEY = 'ojas.profile.v1';
function keyForUser() {
  try {
    const uid = auth?.currentUser?.uid || 'nouser';
    return `${BASE_KEY}.${uid}`;
  } catch {
    return `${BASE_KEY}.nouser`;
  }
}

export const profileStore = {
  get(): UserProfile {
    try {
      const k = keyForUser();
      const raw = localStorage.getItem(k);
      if (raw) return JSON.parse(raw) as UserProfile;
      // Legacy fallback: migrate global key into per-user if present
      const legacy = localStorage.getItem(BASE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy) as UserProfile;
        try { localStorage.setItem(k, JSON.stringify(parsed)); } catch {}
        return parsed;
      }
      return {};
    } catch {
      return {};
    }
  },
  set(next: UserProfile) {
    try { localStorage.setItem(keyForUser(), JSON.stringify(next)); } catch {}
  },
};
