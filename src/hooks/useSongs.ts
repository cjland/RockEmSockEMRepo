
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Song } from '../types';
import { MOCK_SONGS } from '../utils';

export function useSongs(profile: any) {
    const [songs, setSongs] = useState<Song[]>(MOCK_SONGS);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!profile?.band_id) return;

        const fetchSongs = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('songs')
                .select('*')
                .eq('band_id', profile.band_id)
                .order('title');

            if (error) {
                console.error("Error fetching songs", error);
            } else if (data) {
                // Map DB snake_case to CamelCase
                const mappedSongs: Song[] = data.map(s => ({
                    id: s.id,
                    title: s.title,
                    artist: s.artist,
                    durationSeconds: s.duration_seconds,
                    videoUrl: s.video_url,
                    rating: s.rating,
                    playedLive: s.played_live,
                    generalNotes: s.general_notes,
                    practiceStatus: s.practice_status,
                    status: s.status || 'Active', // Default to Active if null
                    createdAt: s.created_at,
                    guitarLessonUrl: s.links?.guitar,
                    bassLessonUrl: s.links?.bass,
                    lyricsUrl: s.links?.lyrics,
                    externalLink1: s.links?.externalLink1,
                    externalLink2: s.links?.externalLink2,
                    externalLink3: s.links?.externalLink3,
                    externalLink4: s.links?.externalLink4
                }));
                // Combine with Mock if DB is empty? No, DB should be truth.
                // But for prototype we started with MOCK. 
                // If DB is empty, maybe we should persist mock data?
                // For now, if DB has data, use it. If not, empty (or MOCK if we want).
                // Let's stick to DB.
                if (mappedSongs.length > 0) {
                    setSongs(mappedSongs);
                } else {
                    setSongs([]);
                }
            }
            setLoading(false);
        };
        fetchSongs();
    }, [profile]);

    const upsertSongs = async (newSongs: Partial<Song>[]) => {
        // Safe Upsert Logic:
        // 1. If ID matches a song in THIS band -> Update (Merge)
        // 2. If ID is missing or does NOT match a known song -> Insert (New ID) to prevent overwriting other bands' data
        const processedSongs = newSongs.map(s => {
            // Check if this ID exists in our LOCALLY loaded songs (which are filtered by current band)
            const existing = s.id ? songs.find(local => local.id === s.id) : null;

            if (existing) {
                // UPDATE: Merge new data over existing
                return {
                    ...existing,
                    ...s,
                    // Prevent changing critical fields if needed, but 's' usually authoritative
                    band_id: profile.band_id // Ensure band_id sticks
                } as Song;
            } else {
                // INSERT: Treat as new song (New UUID)
                // This protects against ID collisions with other bands
                return {
                    ...s,
                    id: self.crypto.randomUUID(),
                    band_id: profile.band_id,
                    createdAt: s.createdAt || new Date().toISOString(),
                    status: s.status || 'Active',
                    // Ensure defaults for required fields if missing in Partial
                    rating: s.rating || 0,
                    practiceStatus: s.practiceStatus || 'Practice'
                } as Song;
            }
        });

        // Optimistic: Upsert (Merge)
        setSongs(prev => {
            const map = new Map(prev.map(s => [s.id, s]));
            processedSongs.forEach(s => map.set(s.id, s));
            return Array.from(map.values());
        });

        if (profile?.band_id) {
            const dbSongs = processedSongs.map(s => ({
                id: s.id,
                band_id: profile.band_id,
                title: s.title,
                artist: s.artist,
                duration_seconds: s.durationSeconds,
                video_url: s.videoUrl,
                rating: s.rating,
                played_live: s.playedLive,
                general_notes: s.generalNotes,
                practice_status: s.practiceStatus,
                status: s.status,
                created_at: s.createdAt, // Ensure Created At is persisted
                links: {
                    guitar: s.guitarLessonUrl,
                    bass: s.bassLessonUrl,
                    lyrics: s.lyricsUrl,
                    externalLink1: s.externalLink1,
                    externalLink2: s.externalLink2,
                    externalLink3: s.externalLink3,
                    externalLink4: s.externalLink4
                }
            }));
            const { error } = await supabase.from('songs').upsert(dbSongs, { onConflict: 'id' });
            if (error) {
                console.error("Failed to upsert songs to DB", error);
                alert("Failed to save songs to database! Please check your connection.");
            }
        }
    };

    const replaceLibrary = async (newSongs: Song[]) => {
        setSongs(newSongs);

        if (profile?.band_id) {
            // Delete all for band
            await supabase.from('songs').delete().eq('band_id', profile.band_id);

            // Insert new
            const dbSongs = newSongs.map(s => ({
                id: s.id,
                band_id: profile.band_id,
                title: s.title,
                artist: s.artist,
                duration_seconds: s.durationSeconds,
                video_url: s.videoUrl,
                rating: s.rating,
                played_live: s.playedLive,
                general_notes: s.generalNotes,
                practice_status: s.practiceStatus,
                status: s.status,
                links: {
                    guitar: s.guitarLessonUrl,
                    bass: s.bassLessonUrl,
                    lyrics: s.lyricsUrl,
                    externalLink1: s.externalLink1,
                    externalLink2: s.externalLink2,
                    externalLink3: s.externalLink3,
                    externalLink4: s.externalLink4
                }
            }));
            const { error } = await supabase.from('songs').insert(dbSongs);
            if (error) {
                console.error("Failed to replace library in DB", error);
                alert("Failed to save new library to database! Please check your connection.");
            }
        }
    };

    const updateSong = async (updatedSong: Song) => {
        setSongs(prev => prev.map(s => s.id === updatedSong.id ? updatedSong : s));

        if (profile?.band_id) { // Not strictly needed for ID match but good practice or implicit
            const { error } = await supabase.from('songs').update({
                title: updatedSong.title,
                artist: updatedSong.artist,
                duration_seconds: updatedSong.durationSeconds,
                video_url: updatedSong.videoUrl,
                rating: updatedSong.rating,
                played_live: updatedSong.playedLive,
                general_notes: updatedSong.generalNotes,
                practice_status: updatedSong.practiceStatus,
                status: updatedSong.status,
                links: {
                    guitar: updatedSong.guitarLessonUrl,
                    bass: updatedSong.bassLessonUrl,
                    lyrics: updatedSong.lyricsUrl,
                    externalLink1: updatedSong.externalLink1,
                    externalLink2: updatedSong.externalLink2,
                    externalLink3: updatedSong.externalLink3,
                    externalLink4: updatedSong.externalLink4
                }
            }).eq('id', updatedSong.id);

            if (error) console.error("Failed to update song", error);
        }
    };

    const clearLibrary = async () => {
        setSongs([]);
        if (profile?.band_id) {
            await supabase.from('songs').delete().eq('band_id', profile.band_id);
        }
    };

    const deleteSong = async (id: string) => {
        // Optimistic update
        setSongs(prev => prev.filter(s => s.id !== id));

        if (profile?.band_id) {
            const { error } = await supabase
                .from('songs')
                .delete()
                .eq('id', id)
                .eq('band_id', profile.band_id);

            if (error) {
                console.error("Failed to delete song from DB:", error);
                alert("Failed to delete song from database: " + error.message);
                // Ideally revert optimistic update here if needed
            }
        } else {
            console.error("No band_id in profile, cannot delete from DB");
        }
    };

    return {
        songs,
        loading,
        upsertSongs,
        replaceLibrary,
        updateSong,
        deleteSong,
        clearLibrary,
        setSongs // exposed for optimistic updates from other hooks if needed, but preferably not
    };
}
