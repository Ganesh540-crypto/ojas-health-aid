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
}

const LS_KEY = 'ojas.profile.v1';

export const profileStore = {
  get(): UserProfile {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? (JSON.parse(raw) as UserProfile) : {};
    } catch {
      return {};
    }
  },
  set(next: UserProfile) {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  },
};
