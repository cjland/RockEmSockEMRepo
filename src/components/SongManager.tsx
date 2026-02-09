import React, { useState, useMemo } from 'react';
import { Song } from '../types';
import { Icons } from './ui/Icons';
import { formatDuration } from '../utils';

interface SongManagerProps {
    songs: Song[];
    usedSongIds: Set<string>;
    onBack: () => void;
    onAddSong: (song: Song) => void;
    onUpdateSong: (song: Song) => void;
    onDeleteSong: (id: string) => void;
    onImport: () => void;
}

export const SongManager: React.FC<SongManagerProps> = ({ songs, usedSongIds, onBack, onAddSong, onUpdateSong, onDeleteSong, onImport }) => {
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<keyof Song>('title');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [editingId, setEditingId] = useState<string | null>(null);

    // Initial Empty Row State
    const [newSong, setNewSong] = useState<Partial<Song>>({
        title: '',
        artist: '',
        durationSeconds: 0,
        practiceStatus: 'Ready'
    });

    const filteredSongs = useMemo(() => {
        let result = songs.filter(s =>
            s.title.toLowerCase().includes(search.toLowerCase()) ||
            s.artist.toLowerCase().includes(search.toLowerCase())
        );

        return result.sort((a, b) => {
            const valA = a[sortField];
            const valB = b[sortField];
            if (valA === undefined || valB === undefined) return 0;

            const compare = valA > valB ? 1 : -1;
            return sortDirection === 'asc' ? compare : -compare;
        });
    }, [songs, search, sortField, sortDirection]);

    const handleHeaderClick = (field: keyof Song) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[#09090b] text-zinc-100 font-sans">
            {/* Header */}
            <header className="h-16 border-b border-white/5 bg-black/40 backdrop-blur-xl px-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-full transition-colors"
                    >
                        <Icons.ArrowLeft size={20} />
                    </button>
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
                        Master Song Library
                    </h1>
                    <div className="bg-zinc-800 text-xs px-2 py-1 rounded-full text-zinc-400 border border-white/5">
                        {songs.length} Songs
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative w-64">
                        <Icons.Music className="absolute left-3 top-2.5 text-zinc-500" size={14} />
                        <input
                            type="text"
                            placeholder="Search library..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-zinc-900 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-primary/50"
                        />
                    </div>
                    <button
                        onClick={onImport}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors border border-white/5"
                    >
                        <Icons.Download size={16} /> Import CSV
                    </button>
                    <button
                        onClick={() => onAddSong(newSong as Song)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20"
                    >
                        <Icons.Plus size={16} /> Add Song
                    </button>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-auto p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-[#121215] border border-white/5 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/5">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-black/40 text-zinc-400 font-medium">
                                <tr>
                                    <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() => handleHeaderClick('title')}>Title <Icons.Sort size={12} className="inline ml-1" /></th>
                                    <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() => handleHeaderClick('artist')}>Artist <Icons.Sort size={12} className="inline ml-1" /></th>
                                    <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() => handleHeaderClick('rating')}>Rating <Icons.Sort size={12} className="inline ml-1" /></th>
                                    <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() => handleHeaderClick('durationSeconds')}>Time <Icons.Sort size={12} className="inline ml-1" /></th>
                                    <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() => handleHeaderClick('createdAt')}>Created <Icons.Sort size={12} className="inline ml-1" /></th>
                                    <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() => handleHeaderClick('practiceStatus')}>Status <Icons.Sort size={12} className="inline ml-1" /></th>
                                    <th className="px-6 py-4">Notes</th>
                                    <th className="px-6 py-4 text-center">Archive</th>
                                    <th className="px-6 py-4">Links</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-zinc-300">
                                {filteredSongs.map(song => (
                                    <tr key={song.id} className={`hover:bg-white/[0.02] transition-colors group ${song.status === 'Archived' ? 'opacity-40 grayscale' : ''}`}>
                                        <td className="px-6 py-4 font-medium text-white">
                                            {song.title}
                                            {song.status === 'Archived' && <span className="ml-2 text-[10px] border border-zinc-700 px-1 rounded text-zinc-500">ARCHIVED</span>}
                                        </td>
                                        <td className="px-6 py-4">{song.artist}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex text-yellow-500/80">
                                                {[1, 2, 3, 4, 5].map(i => (
                                                    <Icons.Star key={i} size={12} className={i <= (song.rating || 0) ? 'fill-current' : 'text-zinc-800 fill-zinc-800'} />
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs text-zinc-500">{formatDuration(song.durationSeconds)}</td>
                                        <td className="px-6 py-4 text-xs text-zinc-500 whitespace-nowrap">
                                            {song.createdAt ? new Date(song.createdAt).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {song.practiceStatus === 'Practice' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                                                    <Icons.Warning size={10} /> Practice
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20">
                                                    <Icons.Check size={10} /> Ready
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-zinc-500 max-w-[200px] truncate" title={song.generalNotes}>
                                            {song.generalNotes || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {song.status === 'Archived' && (
                                                <div className="w-2 h-2 bg-yellow-500 rounded-full mx-auto shadow-[0_0_8px_rgba(234,179,8,0.5)]" title="Archived"></div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2">
                                                {song.videoUrl && <a href={song.videoUrl} target="_blank" className="p-1 hover:bg-white/10 rounded text-zinc-500 hover:text-red-400" title="YouTube"><Icons.Youtube size={14} /></a>}
                                                {song.lyricsUrl && <a href={song.lyricsUrl} target="_blank" className="p-1 hover:bg-white/10 rounded text-zinc-500 hover:text-blue-400" title="Lyrics"><Icons.File size={14} /></a>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => onUpdateSong(song)} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-md transition-colors" title="Edit"><Icons.Edit size={14} /></button>
                                                {song.status !== 'Archived' && (
                                                    <button
                                                        onClick={() => onDeleteSong(song.id)}
                                                        className={`p-2 rounded-md transition-colors ${usedSongIds.has(song.id)
                                                            ? 'text-orange-400 hover:bg-orange-500/10'
                                                            : 'text-zinc-500 hover:text-red-400 hover:bg-zinc-800'
                                                            }`}
                                                        title={usedSongIds.has(song.id) ? "Archive (Used in Sets)" : "Delete Permanently"}
                                                    >
                                                        {usedSongIds.has(song.id) ? <Icons.Archive size={14} /> : <Icons.Trash size={14} />}
                                                    </button>
                                                )}
                                            </div>
                                        </td>

                                    </tr>
                                ))}
                                {filteredSongs.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                                            No songs found. Try searching or adding a new one.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
