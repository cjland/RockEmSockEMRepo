
import { useEffect } from 'react';
import { Song, SetList } from '../types';

export function useDebugLogger(songs: Song[], sets: SetList[]) {
    useEffect(() => {
        if (sets.length === 0) return;

        console.group("🔍 Debug: ID Matcher");

        sets.forEach(set => {
            console.group(`Set: ${set.name} (${set.id})`);
            set.songs.forEach(setSong => {
                const match = songs.find(s => s.id === setSong.id);
                if (match) {
                    console.log(`✅ MATCH: "${setSong.title}"`, { SetID: setSong.id, LibID: match.id });
                } else {
                    console.log(`❌ NO MATCH: "${setSong.title}"`, { SetID: setSong.id });
                    // Try to find fuzzy match
                    const fuzzy = songs.find(s => s.title === setSong.title);
                    if (fuzzy) {
                        console.warn(`   ⚠️ FOUND TITLE MATCH BUT ID MISMATCH: LibID: ${fuzzy.id}`);
                    }
                }
            });
            console.groupEnd();
        });

        console.groupEnd();
    }, [songs, sets]);
}
