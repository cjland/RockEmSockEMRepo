
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SetList, SetSong, Song } from '../types';
import { arrayMove } from '@dnd-kit/sortable';
import { v4 as uuidv4 } from 'uuid';

import { UserBand } from '../context/AuthContext';

export function useSets(profile: UserBand | null, gigId: string | null) {
    const [sets, setSets] = useState<SetList[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!profile?.band_id || !gigId) {
            setSets([]);
            return;
        }

        const fetchSets = async () => {
            setLoading(true);
            try {
                // Fetch Sets for this Gig, ordered by order_index
                const { data: setsData, error } = await supabase
                    .from('setlists')
                    .select('*')
                    .eq('band_id', profile.band_id)
                    .eq('gig_id', gigId)
                    .order('order_index', { ascending: true });

                if (error) throw error;

                if (setsData) {
                    const mappedSets: SetList[] = await Promise.all(setsData.map(async (s) => {
                        // Fetch songs for each set
                        const { data: setSongsData } = await supabase
                            .from('setlist_songs')
                            .select(`
                                *,
                                songs:song_id (*)
                            `)
                            .eq('setlist_id', s.id)
                            .order('order_index', { ascending: true });

                        const setSongsDataTyped = setSongsData as any[];
                        const setSongs: SetSong[] = setSongsDataTyped?.map((item: any) => {
                            const s = item.songs;
                            return {
                                id: s.id,
                                band_id: s.band_id,
                                title: s.title,
                                artist: s.artist,
                                durationSeconds: s.duration_seconds,
                                videoUrl: s.video_url,
                                rating: s.rating,
                                playedLive: s.played_live,
                                generalNotes: s.general_notes,
                                practiceStatus: s.practice_status,
                                status: s.status || 'Active',
                                createdAt: s.created_at,
                                guitarLessonUrl: s.links?.guitar,
                                bassLessonUrl: s.links?.bass,
                                lyricsUrl: s.links?.lyrics,
                                // SetSong specific
                                instanceId: item.id,
                                notes: item.notes || ''
                            };
                        }) || [];

                        return {
                            id: s.id,
                            name: s.name,
                            songs: setSongs,
                            status: s.status,
                            gigId: s.gig_id,
                            order_index: s.order_index
                        };
                    }));
                    setSets(mappedSets);
                }
            } catch (error) {
                console.error("Error fetching sets:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSets();
    }, [profile?.band_id, gigId]);

    // Persistence Helpers
    const persistSetListSongs = async (setId: string, songs: SetSong[]) => {
        const updates = songs.map((s, index) => ({
            id: s.instanceId,
            setlist_id: setId,
            song_id: s.id,
            order_index: index,
            notes: s.notes || ''
        }));

        const { error } = await supabase.from('setlist_songs').upsert(updates, { onConflict: 'id' });
        if (error) console.error("Error syncing set", error);
    };

    const addSet = async () => {
        console.log('[useSets] addSet called. sets:', sets.length, 'band:', profile?.band_id, 'gig:', gigId);
        if (sets.length >= 5 || !profile?.band_id || !gigId) {
            console.warn('[useSets] addSet aborted. Condition failed.');
            alert(`Cannot create set. Debug Info: Sets=${sets.length}, BandID=${profile?.band_id}, GigID=${gigId}`);
            return;
        }

        const newId = uuidv4();
        const newSetName = `Set ${sets.length + 1}`;
        const newSet: SetList = { id: newId, name: newSetName, songs: [], status: 'Draft', gigId };

        setSets(prev => [...prev, newSet]);

        const { error } = await supabase.from('setlists').insert({
            id: newId,
            band_id: profile.band_id,
            gig_id: gigId,
            name: newSetName,
            status: 'Draft',
            order_index: sets.length // Append to end
        });
        if (error) console.error("Error creating set", error);
    };

    const removeSet = async (id: string) => {
        setSets(prev => prev.filter(s => s.id !== id));
        if (profile?.band_id) {
            await supabase.from('setlists').delete().eq('id', id);
        }
    };

    const updateSetDetails = async (setId: string, updates: Partial<SetList>) => {
        setSets(prev => prev.map(s => s.id === setId ? { ...s, ...updates } : s));

        const set = sets.find(s => s.id === setId); // current state
        if (set) {
            await supabase.from('setlists').update({
                name: updates.name || set.name,
                status: updates.status || set.status
            }).eq('id', setId);
        }
    };

    const reorderSets = async (oldIndex: number, newIndex: number) => {
        console.log(`[useSets] reorderSets: Moving ${oldIndex} to ${newIndex}`);
        const newSets = arrayMove(sets, oldIndex, newIndex) as SetList[];
        setSets(newSets);

        // Persist order_index for all affects sets
        const updates = newSets.map((set, index) => ({
            id: set.id,
            band_id: profile.band_id,
            gig_id: gigId,
            name: set.name,
            status: set.status,
            order_index: index
        }));

        console.log(`[useSets] reorderSets: Persisting updates to DB`, updates);

        const { data, error } = await supabase.from('setlists').upsert(updates, { onConflict: 'id' }).select();

        if (error) {
            console.error("[useSets] Failed to reorder sets in DB", error);
        } else {
            console.log("[useSets] DB Update Success:", data);
        }
    };

    const reorderSongInSet = (setId: string, oldIndex: number, newIndex: number) => {
        const setIndex = sets.findIndex(s => s.id === setId);
        if (setIndex === -1) return;

        const set = sets[setIndex];
        const newSongs = arrayMove(set.songs, oldIndex, newIndex) as SetSong[];

        const newSets = [...sets];
        newSets[setIndex] = { ...set, songs: newSongs };
        setSets(newSets);

        persistSetListSongs(setId, newSongs);
    };

    const moveSongBetweenSets = (
        sourceSetId: string,
        targetSetId: string,
        songInstanceId: string,
        targetIndex: number
    ) => {
        const sourceSetIndex = sets.findIndex(s => s.id === sourceSetId);
        const targetSetIndex = sets.findIndex(s => s.id === targetSetId);
        if (sourceSetIndex === -1 || targetSetIndex === -1) return;

        const sourceSet = sets[sourceSetIndex];
        const targetSet = sets[targetSetIndex];

        const songIndex = sourceSet.songs.findIndex(s => s.instanceId === songInstanceId);
        if (songIndex === -1) return;

        const song = sourceSet.songs[songIndex];

        // Remove from source
        const newSourceSongs = [...sourceSet.songs];
        newSourceSongs.splice(songIndex, 1);

        // Add to target
        const newTargetSongs = [...targetSet.songs];
        // Handle insertion
        const index = targetIndex === -1 ? newTargetSongs.length : targetIndex;
        newTargetSongs.splice(index, 0, song);

        const newSets = [...sets];
        newSets[sourceSetIndex] = { ...sourceSet, songs: newSourceSongs };
        newSets[targetSetIndex] = { ...targetSet, songs: newTargetSongs };
        setSets(newSets);

        persistSetListSongs(sourceSetId, newSourceSongs);
        persistSetListSongs(targetSetId, newTargetSongs);
    };

    const addSongToSet = (setId: string, song: Song, index: number = -1) => {
        const setIndex = sets.findIndex(s => s.id === setId);
        if (setIndex === -1) return;

        const newSong: SetSong = {
            ...song,
            instanceId: uuidv4(),
            notes: ''
        };

        const set = sets[setIndex];
        const newSongs = [...set.songs] as SetSong[];

        if (index === -1) {
            newSongs.push(newSong);
        } else {
            newSongs.splice(index, 0, newSong);
        }

        const newSets = [...sets];
        newSets[setIndex] = { ...set, songs: newSongs };
        setSets(newSets);

        persistSetListSongs(setId, newSongs);
    };

    const addMultipleSongsToSet = (setId: string, songsToAdd: Song[]) => {
        console.log("useSets: addMultipleSongsToSet", setId, songsToAdd.length);
        const setIndex = sets.findIndex(s => s.id === setId);
        if (setIndex === -1) {
            console.error("Set not found for ID:", setId);
            return;
        }

        const set = sets[setIndex];
        const newSetSongs: SetSong[] = songsToAdd.map(s => ({
            ...s,
            instanceId: uuidv4(),
            notes: ''
        }));

        const newSongs = [...set.songs, ...newSetSongs];

        const newSets = [...sets];
        newSets[setIndex] = { ...set, songs: newSongs };
        setSets(newSets);

        persistSetListSongs(setId, newSongs);
    };

    const removeSongFromSet = async (setId: string, songInstanceId: string) => {
        const setIndex = sets.findIndex(s => s.id === setId);
        if (setIndex === -1) return;

        const set = sets[setIndex];
        const newSongs = set.songs.filter(s => s.instanceId !== songInstanceId);

        const newSets = [...sets];
        newSets[setIndex] = { ...set, songs: newSongs };
        setSets(newSets);

        await supabase.from('setlist_songs').delete().eq('id', songInstanceId);
    };

    const updateSongNote = async (setId: string, songInstanceId: string, note: string) => {
        const setIndex = sets.findIndex(s => s.id === setId);
        if (setIndex === -1) return;

        const set = sets[setIndex];
        const newSongs = set.songs.map(s => s.instanceId === songInstanceId ? { ...s, notes: note } : s);

        const newSets = [...sets];
        newSets[setIndex] = { ...set, songs: newSongs };
        setSets(newSets);

        await supabase.from('setlist_songs').update({ notes: note }).eq('id', songInstanceId);
    };

    // Propagate song updates (from Library edit) to Sets
    const updateSongInSets = (updatedSong: Song) => {
        setSets(prevSets => prevSets.map(set => ({
            ...set,
            songs: set.songs.map(s => {
                if (s.id === updatedSong.id) {
                    return { ...s, ...updatedSong, instanceId: s.instanceId, notes: s.notes };
                }
                return s;
            })
        })));
    };

    const clearAllSets = async () => {
        setSets([]);
        if (profile?.band_id && gigId) {
            const { error } = await supabase.from('setlists').delete().eq('band_id', profile.band_id).eq('gig_id', gigId);
            if (error) {
                console.error("Failed to clear sets", error);
                alert("Failed to clear sets from database");
            } else {
                // Re-initialize default set
                addSet();
            }
        }
    };

    const duplicateSet = async (setId: string) => {
        if (sets.length >= 5) {
            alert("Maximum 5 sets allowed.");
            return;
        }

        const sourceIndex = sets.findIndex(s => s.id === setId);
        if (sourceIndex === -1) return;

        const sourceSet = sets[sourceIndex];
        const newSetId = uuidv4();

        // Clone songs with new instance IDs
        const newSongs = sourceSet.songs.map(s => ({
            ...s,
            instanceId: uuidv4()
        }));

        const newSet: SetList = {
            ...sourceSet,
            id: newSetId,
            name: `${sourceSet.name} (Copy)`,
            songs: newSongs,
            status: 'Draft'
        };

        // Insert after source set
        const newSets = [...sets];
        newSets.splice(sourceIndex + 1, 0, newSet);

        // Re-index
        newSets.forEach((s, i) => s.order_index = i);
        setSets(newSets);

        if (!profile?.band_id || !gigId) return;

        // 1. Create Set in DB
        const { error: setError } = await supabase.from('setlists').insert({
            id: newSet.id,
            band_id: profile.band_id,
            gig_id: gigId,
            name: newSet.name,
            status: 'Draft',
            order_index: sourceIndex + 1
        });

        if (setError) {
            console.error("Failed to duplicate set", setError);
            return;
        }

        // 2. Create Songs
        await persistSetListSongs(newSet.id, newSongs);

        // 3. Update Order Indexes for all sets to ensure consistency
        const updates = newSets.map((set, index) => ({
            id: set.id,
            band_id: profile.band_id,
            gig_id: gigId,
            name: set.name,
            status: set.status,
            order_index: index
        }));
        await supabase.from('setlists').upsert(updates, { onConflict: 'id' });
    };

    return {
        sets,
        loading,
        addSet,
        removeSet,
        updateSetDetails,
        reorderSets,
        reorderSongInSet,
        moveSongBetweenSets,
        addSongToSet,
        addMultipleSongsToSet,
        removeSongFromSet,
        updateSongNote,
        updateSongInSets,
        clearAllSets,
        duplicateSet
    };
}
