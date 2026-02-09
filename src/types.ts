
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
  lyricsUrl?: string;

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
  gig_id?: string; // New: Supabase FK
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
  logoUrl: string;
  members: string[]; // List of names
  defaultLibraryUrl?: string; // URL to fetch initial library from (e.g. Google Sheets)
  bandProfileUrl?: string; // URL to fetch band profile info
  gigDetailsUrl?: string; // URL to fetch gig details
}

export interface Gig {
  id: string;
  band_id: string;
  name: string;
  date: string;
  location: string;
  status: 'upcoming' | 'past';
  settings?: any;
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