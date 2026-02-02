
export interface Song {
  id: string;
  title: string;
  artist: string;
  durationSeconds: number; // Stored in seconds for easy math
  videoUrl?: string;
  tags?: string[];
  
  // New Fields
  rating?: number; // 1-5
  playedLive?: boolean;
  guitarLessonUrl?: string;
  bassLessonUrl?: string;
  lyricsUrl?: string;
  
  // Latest updates
  generalNotes?: string;
  practiceStatus?: 'Practice' | 'Ready';
}

export interface SetSong extends Song {
  instanceId: string; // Unique ID for this specific instance in a set (allows duplicates)
  notes?: string;
}

export type SetStatus = 'Draft' | 'Final' | 'Proposed';

export interface SetList {
  id: string;
  name: string;
  songs: SetSong[];
  color?: string; // For visual distinction
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