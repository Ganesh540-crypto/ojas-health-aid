export interface UserProfile {
  name?: string;
  email?: string;
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
