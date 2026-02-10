
export interface Song {
  id: string;
  band_id?: string; // New: Supabase FK
  title: string;
  artist: string;
  durationSeconds: number;
  videoUrl?: string;
  tags?: string[];

  // New Fields
  rating?: number; // 1-5
  playedLive?: boolean;
  practiceStatus: 'Ready' | 'Practice';
  status: 'Active' | 'Archived'; // New soft-delete flag
  guitarLessonUrl?: string;
  bassLessonUrl?: string;
  lyricsUrl?: string; // Existing
  externalLink1?: string;
  externalLink2?: string;
  externalLink3?: string;
  externalLink4?: string;

  // Latest updates
  generalNotes?: string;
  createdAt?: string; // ISO String
}

export interface SetSong extends Song {
  instanceId: string;
  notes?: string;
}

export type SetStatus = 'Draft' | 'Final' | 'Proposed';

export interface SetList {
  id: string;
  gigId?: string; // Mapped from gig_id
  order_index?: number;
  name: string;
  songs: SetSong[];
  color?: string;
  status?: SetStatus;
}

export interface DragItem {
  type: 'LIBRARY_SONG' | 'SET_SONG' | 'SET_COLUMN';
  id: string;
  data: Song | SetSong | SetList;
  originSetId?: string; // If moving from a set
}

export interface GigDetails {
  name: string;
  location: string;
  date: string;
  startTime: string;
  arriveTime?: string;
  notes?: string;
  settings?: any; // To store flexible data like setOrder
  // bandLogoUrl moved to BandSettings
}

export interface BandSettings {
  name: string;
  website?: string;
  logoUrl?: string; // We can use this for the band logo
  accessCode: string; // "Shared Password" for read-only access
  adminPassword?: string; // Optional admin password
  members: string[]; // List of member names
}

export interface SetSummary {
  name: string;
  songCount: number;
  durationSeconds: number;
}

export interface Gig {
  id: string;
  band_id: string;
  name: string;
  date: string;
  location: string;
  status: 'upcoming' | 'past';
  settings?: any;
  setSummaries?: SetSummary[];
}

export interface PDFOptions {
  includeNotes: boolean;
  oneSetPerPage: boolean;
  largeType: boolean;
  includeLogo: boolean;
  includeGigInfo: boolean;
}

// For parsing CSV
export interface CSVRow {
  Title: string;
  Artist: string;
  Duration: string;
  Link?: string;
  Notes?: string;
  [key: string]: any;
}