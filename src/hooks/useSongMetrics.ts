import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Song } from '../types';

export interface SongMetric {
    song: Song;
    playCount: number;
    lastPlayed?: string;
}

export interface ArtistMetric {
    artist: string;
    playCount: number;
}

export interface MetricsState {
    topSongsAllTime: SongMetric[];
    topSongs12Months: SongMetric[];
    topSongs6Months: SongMetric[];
    leastPlayedSongs: SongMetric[];
    topArtistsAllTime: ArtistMetric[];
    topArtists12Months: ArtistMetric[];
    topArtists6Months: ArtistMetric[];
    totalGigs: number;
    totalSongsTracker: number; // Unique songs played
    loading: boolean;
    error: string | null;
}

export function useSongMetrics(bandId: string) {
    const [metrics, setMetrics] = useState<MetricsState>({
        topSongsAllTime: [],
        topSongs12Months: [],
        topSongs6Months: [],
        leastPlayedSongs: [],
        topArtistsAllTime: [],
        topArtists12Months: [],
        topArtists6Months: [],
        totalGigs: 0,
        totalSongsTracker: 0,
        loading: true,
        error: null
    });

    useEffect(() => {
        if (!bandId) return;

        const fetchMetrics = async () => {
            try {
                setMetrics(prev => ({ ...prev, loading: true, error: null }));

                // 1. Fetch all Gigs
                const { data: gigs, error: gigsError } = await supabase
                    .from('gigs')
                    .select('id, date, status')
                    .eq('band_id', bandId)
                    .order('date', { ascending: false });

                if (gigsError) throw gigsError;

                // 2. Fetch all Setlists
                const { data: setlists, error: setlistsError } = await supabase
                    .from('setlists')
                    .select('id, gig_id')
                    .eq('band_id', bandId);

                if (setlistsError) throw setlistsError;

                // 3. Fetch all Setlist Songs
                // We need to know which song is in which setlist
                const { data: setlistSongs, error: slsError } = await supabase
                    .from('setlist_songs')
                    .select('song_id, setlist_id');

                if (slsError) throw slsError;

                // 4. Fetch all Songs (for details)
                const { data: allSongs, error: songsError } = await supabase
                    .from('songs')
                    .select('*')
                    .eq('band_id', bandId);
                // .eq('status', 'Active'); // Removing potentially missing column filter for now

                if (songsError) throw songsError;

                // --- Aggregation Logic ---

                // Map Setlist ID -> Gig ID
                const setlistToGigMap = new Map<string, { gigId: string, date: string }>();
                setlists?.forEach(sl => {
                    const gig = gigs?.find(g => g.id === sl.gig_id);
                    if (gig) {
                        setlistToGigMap.set(sl.id, { gigId: gig.id, date: gig.date });
                    }
                });

                // Song ID -> Set of Gig IDs (to count unique gigs)
                const songGigHistory = new Map<string, Set<string>>();
                // Song ID -> Last Played Date
                const songLastPlayed = new Map<string, string>();

                setlistSongs?.forEach(sls => {
                    const gigInfo = setlistToGigMap.get(sls.setlist_id);
                    if (gigInfo) {
                        if (!songGigHistory.has(sls.song_id)) {
                            songGigHistory.set(sls.song_id, new Set());
                        }
                        songGigHistory.get(sls.song_id)?.add(gigInfo.gigId);

                        // Update Last Played
                        const currentLast = songLastPlayed.get(sls.song_id);
                        if (!currentLast || new Date(gigInfo.date) > new Date(currentLast)) {
                            songLastPlayed.set(sls.song_id, gigInfo.date);
                        }
                    }
                });

                // Helper to count gigs within a date range
                const countGigsInWindow = (songId: string, daysLookback?: number) => {
                    const gigIds = songGigHistory.get(songId);
                    if (!gigIds) return 0;

                    if (!daysLookback) return gigIds.size; // All times

                    const cutoff = new Date();
                    cutoff.setDate(cutoff.getDate() - daysLookback);

                    let count = 0;
                    gigIds.forEach(gigId => {
                        const gig = gigs?.find(g => g.id === gigId);
                        if (gig && new Date(gig.date) >= cutoff) {
                            count++;
                        }
                    });
                    return count;
                };

                // Build Metrics Arrays
                const allMetrics: SongMetric[] = (allSongs || []).map(song => {
                    return {
                        song,
                        playCount: 0, // Placeholder, calculated below for sorting
                        lastPlayed: songLastPlayed.get(song.id)
                    };
                });

                // Top Songs Sorters
                const getTopSongs = (days?: number) => {
                    return [...allMetrics]
                        .map(m => ({
                            ...m,
                            playCount: countGigsInWindow(m.song.id, days)
                        }))
                        .filter(m => m.playCount > 0)
                        .sort((a, b) => b.playCount - a.playCount) // High to Low
                        .slice(0, 10);
                };

                const getLeastPlayed = () => {
                    return [...allMetrics]
                        .map(m => ({
                            ...m,
                            playCount: countGigsInWindow(m.song.id) // All time
                        }))
                        .sort((a, b) => {
                            if (a.playCount !== b.playCount) return a.playCount - b.playCount;
                            return a.song.title.localeCompare(b.song.title);
                        })
                        .slice(0, 10);
                };

                const topSongsAllTime = getTopSongs();
                const topSongs12Months = getTopSongs(365);
                const topSongs6Months = getTopSongs(180);
                const leastPlayedSongs = getLeastPlayed();


                // --- Artist Metrics ---
                const getTopArtists = (days?: number) => {
                    const artistCounts = new Map<string, number>();

                    (allSongs || []).forEach(song => {
                        const playCount = countGigsInWindow(song.id, days);
                        if (playCount > 0 && song.artist) {
                            // Normalize artist name? (Optional, skipping complex normalization for now)
                            const artist = song.artist.trim();
                            artistCounts.set(artist, (artistCounts.get(artist) || 0) + playCount);
                        }
                    });

                    return Array.from(artistCounts.entries())
                        .map(([artist, playCount]) => ({ artist, playCount }))
                        .sort((a, b) => b.playCount - a.playCount)
                        .slice(0, 10);
                };

                const topArtistsAllTime = getTopArtists();
                const topArtists12Months = getTopArtists(365);
                const topArtists6Months = getTopArtists(180);


                // Unique songs played (in history)
                const playedSongIds = new Set<string>();
                setlistSongs?.forEach(sls => playedSongIds.add(sls.song_id));

                setMetrics({
                    topSongsAllTime,
                    topSongs12Months,
                    topSongs6Months,
                    leastPlayedSongs,
                    topArtistsAllTime,
                    topArtists12Months,
                    topArtists6Months,
                    totalGigs: gigs?.length || 0,
                    totalSongsTracker: playedSongIds.size,
                    loading: false,
                    error: null
                });

            } catch (err: any) {
                console.error("Error fetching metrics:", err);
                setMetrics(prev => ({ ...prev, loading: false, error: err.message }));
            }
        };

        fetchMetrics();
    }, [bandId]);

    return metrics;
}
