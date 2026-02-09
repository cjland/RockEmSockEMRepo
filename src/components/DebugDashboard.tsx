import React, { useState } from 'react';
import { Song, SetList } from '../types';
import { Icons } from './ui/Icons';

interface DebugDashboardProps {
    songs: Song[];
    sets: SetList[];
    onClearAllSets: () => void;
    bandId: string | null;
}

export const DebugDashboard: React.FC<DebugDashboardProps> = ({ songs, sets, onClearAllSets, bandId }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Analyze Mismatches
    const analysis = sets.flatMap(set =>
        set.songs.map(setSong => {
            const exactMatch = songs.find(s => s.id === setSong.id);
            const titleMatch = songs.find(s => s.title === setSong.title && s.id !== setSong.id);

            if (exactMatch) return null; // All good

            return {
                set: set.name,
                songTitle: setSong.title,
                setSongId: setSong.id,
                issue: titleMatch ? 'ID_MISMATCH' : 'MISSING_FROM_LIBRARY',
                libraryMatchId: titleMatch?.id
            };
        })
    ).filter(Boolean);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 z-50 bg-red-900/80 hover:bg-red-800 text-red-100 p-2 rounded-full shadow-lg border border-red-500/50 backdrop-blur-md transition-all"
                title="Open Debug Tools"
            >
                <Icons.Settings size={20} />
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#121215] border border-red-900/50 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-red-950/20">
                    <h2 className="text-xl font-bold text-red-400 flex items-center gap-2">
                        <Icons.Settings /> Debug & Repair
                    </h2>
                    <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-white">
                        <Icons.Close size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-zinc-900 p-3 rounded-lg border border-white/5">
                            <div className="text-xs text-zinc-500 uppercase">Library Songs</div>
                            <div className="text-2xl font-mono text-white">{songs.length}</div>
                        </div>
                        <div className="bg-zinc-900 p-3 rounded-lg border border-white/5">
                            <div className="text-xs text-zinc-500 uppercase">Total Sets</div>
                            <div className="text-2xl font-mono text-white">{sets.length}</div>
                        </div>
                        <div className="bg-zinc-900 p-3 rounded-lg border border-white/5">
                            <div className="text-xs text-zinc-500 uppercase">Band ID</div>
                            <div className="text-[10px] font-mono text-zinc-400 truncate" title={bandId || ''}>
                                {bandId || 'N/A'}
                            </div>
                        </div>
                    </div>

                    {/* Logic Issues */}
                    {analysis.length > 0 ? (
                        <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-4">
                            <h3 className="text-red-400 font-bold mb-3 flex items-center gap-2">
                                <Icons.Warning size={18} />
                                Data Integrity Issues Found ({analysis.length})
                            </h3>
                            <div className="space-y-2 max-h-40 overflow-y-auto pr-2 scrollbar-thin">
                                {analysis.map((item: any, i) => (
                                    <div key={i} className="text-xs bg-black/40 p-2 rounded border border-red-500/20 flex items-center justify-between">
                                        <div>
                                            <span className="text-zinc-400">Set: </span>
                                            <span className="text-white font-medium">{item.set}</span>
                                            <span className="mx-2 text-zinc-600">|</span>
                                            <span className="text-red-300">"{item.songTitle}"</span>
                                        </div>
                                        <div className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                                            {item.issue}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 text-xs text-zinc-500">
                                This explains why badges aren't showing up. The songs in the set have different IDs than the songs in your library.
                            </div>
                        </div>
                    ) : (
                        <div className="bg-green-950/30 border border-green-900/50 rounded-xl p-4 flex items-center gap-3">
                            <Icons.Check className="text-green-500" />
                            <div>
                                <h3 className="text-green-400 font-bold">Data Integrity Good</h3>
                                <div className="text-xs text-zinc-500">All songs in sets correctly match songs in the library.</div>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-white font-bold">Wipe All Set Data</h4>
                                <p className="text-xs text-zinc-500">Deletes ALL sets and removes all songs from them. Library remains touched.</p>
                            </div>
                            <button
                                onClick={() => {
                                    if (confirm("ARE YOU SURE? This will verify delete ALL sets.")) {
                                        onClearAllSets();
                                        setIsOpen(false);
                                    }
                                }}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg shadow-lg hover:shadow-red-600/20 transition-all active:scale-95 flex items-center gap-2"
                            >
                                <Icons.Trash size={16} />
                                Clear All Sets
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
