// Family profiles — store multiple named people (you, a parent, a child) locally
// so a report can be analyzed for the right person. Stored in localStorage only;
// no account, no server. Mirrors the AnalysisProfile shape used by the analyzer.

import type { AnalysisProfile } from '@/types';

export interface FamilyProfile extends AnalysisProfile {
  id: string;
  name: string;
  relation?: string; // e.g. "Self", "Mother", "Son"
}

const KEY = 'feelfit_profiles_v1';

function read(): FamilyProfile[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

function write(list: FamilyProfile[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore quota */ }
}

export function getProfiles(): FamilyProfile[] {
  return read();
}

export function saveProfileEntry(p: Omit<FamilyProfile, 'id'> & { id?: string }): FamilyProfile {
  const list = read();
  if (p.id) {
    const idx = list.findIndex(x => x.id === p.id);
    if (idx >= 0) { list[idx] = { ...list[idx], ...p } as FamilyProfile; write(list); return list[idx]; }
  }
  const entry: FamilyProfile = {
    id: `p_${Date.now().toString(36)}`,
    name: p.name || 'Unnamed',
    relation: p.relation,
    age: p.age || '', gender: p.gender || '', conditions: p.conditions || '', medications: p.medications || '',
  };
  list.push(entry);
  write(list);
  return entry;
}

export function deleteProfile(id: string): void {
  write(read().filter(p => p.id !== id));
}

export function toAnalysisProfile(p: FamilyProfile): AnalysisProfile {
  return { age: p.age, gender: p.gender, conditions: p.conditions, medications: p.medications };
}
