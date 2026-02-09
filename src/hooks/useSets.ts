
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SetList, SetSong, Song } from '../types';
import { arrayMove } from '@dnd-kit/sortable';
import { v4 as uuidv4 } from 'uuid';

export function useSets(profile: any, setOrder?: string[]) {
    const [sets, setSets] = useState<SetList[]>([]);
    const [loading, setLoading] = useState(false);

    // Sort logic...
    const sortSets = (setsToSort: SetList[], order: string[] | undefined) => {
        if (!order || order.length === 0) return setsToSort;

        return [...setsToSort].sort((a, b) => {
            const indexA = order.indexOf(a.id);
            const indexB = order.indexOf(b.id);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return 0;
        });
    };


    // Serialize order to string for stable dependency
    const orderKey = setOrder ? setOrder.join(',') : '';

    useEffect(() => {
        if (!profile?.band_id) return;

        const fetchSets = async () => {
            // ...
            // (fetch logic)
            // ...
            // Inside success:
            // setSets(sortSets(mappedSets, setOrder));
        };
        fetchSets();
    }, [profile?.band_id, orderKey]); // Use primitive string dependency! // Re-run if setOrder changes (e.g. initial load or drag update)
    // NOTE: Adding setOrder to dependency array might cause re-fetches. 
    // Ideally we should just re-sort locally if data is already loaded.
    // But since setOrder comes from Parent -> useBand -> useSets, 
    // and useSets fetches internally...
    // Let's optimize: fetch once, then Effect for sort.

    // Actually, splitting fetch and sort is better to avoid DB spam.
    // But for now, let's just use the dependency array as it's simpler and setOrder changes are rare (drag end).

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
        if (sets.length >= 5) return;

        const newId = uuidv4();
        const newSetName = `Set ${sets.length + 1}`;
        const newSet: SetList = { id: newId, name: newSetName, songs: [], status: 'Draft' };

        setSets(prev => [...prev, newSet]);

        if (profile?.band_id) {
            const { error } = await supabase.from('setlists').insert({
                id: newId,
                band_id: profile.band_id,
                name: newSetName,
                status: 'Draft',
            });
            if (error) console.error("Error creating set", error);
        }
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

    const reorderSets = (oldIndex: number, newIndex: number) => {
        setSets(items => arrayMove(items, oldIndex, newIndex));
        // No DB persistence for set order yet
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

        persistSetListSongs(sourceSetId, newSourceSongs); // This removes it implicitly? No upsert doesn't delete!
        // We need to UPDATE the setlist_id for this song instance!
        // Wait, persistSetListSongs uses upsert.
        // If we move a song instance, we are changing its setlist_id.
        // So we should just update that one record?
        // Or drag-and-drop might imply creating a NEW instance if we copied? 
        // But here we are moving the *same* instance.

        // The helper `persistSetListSongs` upserts based on ID.
        // If we change setlist_id for that ID, it moves it.
        // BUT `persistSetListSongs` iterates over the *target* list.
        // So updates for target will contain the song with new setlist_id.
        // Updates for source will NOT contain the song.
        // So upsert on source list won't delete it from source! 
        // The song instance will just be updated to new setlist_id by the target update.
        // BUT what about order? `persistSetListSongs` handles order.

        // Correct logic: 
        // 1. Update the Moved Song Instance to point to new Set and new Order.
        // 2. Update remaining songs in Source to fix their order.
        // 3. Update other songs in Target to fix their order.

        // My `persistSetListSongs` iterates the whole array and upserts all. 
        // So calling it on Target Set is enough to move the song and reorder target.
        // Calling it on Source Set is enough to reorder source.

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
        // No DB update needed here as `songs` table update in useSongs handles the source of truth, 
        // and setlist_songs just links to it. 
        // Wait, setlist_songs doesn't store title/artist, it joins 'songs'.
        // So UI update is enough.
    };

    const clearAllSets = async () => {
        setSets([]);
        if (profile?.band_id) {
            const { error } = await supabase.from('setlists').delete().eq('band_id', profile.band_id);
            if (error) {
                console.error("Failed to clear sets", error);
                alert("Failed to clear sets from database");
            } else {
                // Re-initialize default set
                addSet();
            }
        }
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
        clearAllSets
    };
}
