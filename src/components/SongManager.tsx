import React, { useState } from 'react';
import { Song } from '../types';
import { Icons } from './ui/Icons';
import { generateCSV } from '../utils';

interface SongManagerProps {
    songs: Song[];
    usedSongIds: Set<string>;
    onBack: () => void;
    onAddSong: () => void;
    onUpdateSong: (song: Song) => void;
    onDeleteSong: (id: string) => void;
    onImport: () => void;
    onClearLibrary: () => void;
    onViewMetrics: () => void;
}

const LinkIcon = ({ url, icon, label, text }: { url?: string, icon?: React.ReactNode, label: string, text?: string }) => {
    if (url) {
        return (
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center p-1.5 rounded-md bg-green-500/10 text-green-500 hover:bg-green-500/20 hover:text-green-400 transition-all border border-green-500/20"
                title={`${label}: ${url}`}
            >
                {icon || <span className="text-[10px] font-bold font-mono w-5 text-center">{text}</span>}
            </a>
        );
    }
    return (
        <span
            className="flex items-center justify-center p-1.5 rounded-md bg-zinc-800/50 text-zinc-700 border border-white/5 cursor-default"
            title={`${label} (Not set)`}
        >
            {icon || <span className="text-[10px] font-bold font-mono w-5 text-center">{text}</span>}
        </span>
    );
};

export const SongManager: React.FC<SongManagerProps> = ({ songs, usedSongIds, onBack, onAddSong, onUpdateSong, onDeleteSong, onImport, onClearLibrary, onViewMetrics }) => {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'ALL' | 'USED' | 'UNUSED'>('ALL');
    const [sortBy, setSortBy] = useState<'title' | 'artist' | 'rating' | 'date' | 'status'>('date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    const handleSort = (key: 'title' | 'artist' | 'rating' | 'date' | 'status') => {
        if (sortBy === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(key);
            setSortDirection(key === 'date' || key === 'rating' ? 'desc' : 'asc'); // Default desc for date/rating, asc for text
        }
    };

    const filteredSongs = songs.filter(song => {
        const matchesSearch = song.title.toLowerCase().includes(search.toLowerCase()) || song.artist.toLowerCase().includes(search.toLowerCase());
        const matchesFilter =
            filter === 'ALL' ? true :
                filter === 'USED' ? usedSongIds.has(song.id) :
                    !usedSongIds.has(song.id);
        return matchesSearch && matchesFilter;
    }).sort((a, b) => {
        const modifier = sortDirection === 'asc' ? 1 : -1;
        if (sortBy === 'title') return modifier * a.title.localeCompare(b.title);
        if (sortBy === 'artist') return modifier * a.artist.localeCompare(b.artist);
        if (sortBy === 'rating') return modifier * ((a.rating || 0) - (b.rating || 0));
        if (sortBy === 'date') return modifier * (new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
        if (sortBy === 'status') return modifier * (a.status || '').localeCompare(b.status || '');
        return 0;
    });

    const handleExport = () => {
        const csv = generateCSV(songs);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'master_song_library.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[#09090b] text-zinc-100 font-sans">
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 -ml-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-full transition-colors">
                        <Icons.ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Icons.Music className="text-indigo-400" />
                            Master Song Library
                        </h2>
                        <p className="text-xs text-zinc-500">{songs.length} total songs</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onClearLibrary}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-900/20 hover:bg-red-600/20 text-red-400 hover:text-red-200 text-sm font-medium rounded-md border border-red-500/20 transition-colors"
                        title="Delete All Songs"
                    >
                        <Icons.Trash size={16} />
                    </button>
                    <button
                        onClick={onViewMetrics}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 text-sm font-medium rounded-md border border-indigo-500/20 transition-colors"
                        title="View Analytics"
                    >
                        <Icons.BarChart size={16} />
                        <span className="hidden sm:inline">Analytics</span>
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-md border border-white/5 transition-colors"
                    >
                        <Icons.Download size={16} className="rotate-180" /> Export CSV
                    </button>
                    <button
                        onClick={onImport}
                        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-md border border-white/5 transition-colors"
                    >
                        <Icons.Download size={16} /> Import
                    </button>
                    <button
                        onClick={onAddSong}
                        className="flex items-center gap-2 px-3 py-1.5 bg-primary hover:bg-indigo-500 text-white text-sm font-bold rounded-md shadow-lg shadow-primary/20 transition-colors"
                    >
                        <Icons.Plus size={16} /> Add Song
                    </button>
                </div>
            </div>

            {/* Content */}
            {/* Empty State Overlay */}
            {songs.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 animate-fade-in">
                    <div className="w-24 h-24 rounded-full bg-zinc-800/50 flex items-center justify-center mb-6 border border-white/5">
                        <Icons.Music size={48} className="text-zinc-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Your Library is Empty</h3>
                    <p className="text-zinc-400 max-w-md mb-8">
                        Start building your repertoire by adding individual songs or importing a CSV file.
                    </p>
                    <div className="flex gap-4">
                        <button
                            onClick={onAddSong}
                            className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary/20"
                        >
                            <Icons.Plus size={20} />
                            Add First Song
                        </button>
                        <button
                            onClick={onImport}
                            className="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-all border border-white/10"
                        >
                            <Icons.Download size={20} />
                            Import CSV
                        </button>
                    </div>
                    <button
                        onClick={onBack}
                        className="mt-8 text-zinc-500 hover:text-zinc-300 text-sm hover:underline transition-all"
                    >
                        Go Back
                    </button>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <div className="max-w-6xl mx-auto space-y-6">

                        {/* Filters */}
                        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-zinc-900/30 p-4 rounded-xl border border-white/5">
                            <div className="relative w-full md:w-96">
                                <Icons.Search className="absolute left-3 top-2.5 text-zinc-500" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search songs..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full bg-black/40 border border-zinc-700 rounded-lg py-2 pl-10 pr-4 text-sm text-zinc-200 focus:border-primary outline-none"
                                />
                            </div>

                            <div className="flex gap-2 w-full md:w-auto">
                                <select
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value as any)}
                                    className="bg-black/40 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 outline-none focus:border-primary"
                                >
                                    <option value="ALL">All Songs</option>
                                    <option value="USED">Used in Sets</option>
                                    <option value="UNUSED">Unused</option>
                                </select>

                                <select
                                    value={`${sortBy}-${sortDirection}`}
                                    onChange={(e) => {
                                        const [key, dir] = e.target.value.split('-');
                                        setSortBy(key as any);
                                        setSortDirection(dir as 'asc' | 'desc');
                                    }}
                                    className="bg-black/40 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 outline-none focus:border-primary"
                                >
                                    <option value="date-desc">Newest First</option>
                                    <option value="date-asc">Oldest First</option>
                                    <option value="title-asc">Title (A-Z)</option>
                                    <option value="title-desc">Title (Z-A)</option>
                                    <option value="artist-asc">Artist (A-Z)</option>
                                    <option value="artist-desc">Artist (Z-A)</option>
                                    <option value="rating-desc">Highest Rated</option>
                                    <option value="rating-asc">Lowest Rated</option>
                                </select>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-zinc-900/30 rounded-xl border border-white/5 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/5 bg-white/5 text-xs text-zinc-400 uppercase tracking-wider">
                                        <th className="p-4 font-medium cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('title')}>
                                            Title {sortBy === 'title' && (sortDirection === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="p-4 font-medium cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('artist')}>
                                            Artist {sortBy === 'artist' && (sortDirection === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="p-4 font-medium cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('rating')}>
                                            Rating {sortBy === 'rating' && (sortDirection === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="p-4 font-medium text-center">Time</th>
                                        <th className="p-4 font-medium cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('date')}>
                                            Created {sortBy === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="p-4 font-medium text-center cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('status')}>
                                            Status {sortBy === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="p-4 font-medium">Notes</th>
                                        <th className="p-4 font-medium text-center">Archive</th>
                                        <th className="p-4 font-medium">Links</th>
                                        <th className="p-4 font-medium text-right">Edit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredSongs.map(song => (
                                        <tr key={song.id} className="group hover:bg-white/[0.02] transition-colors">
                                            <td className="p-4">
                                                <div className="font-bold text-white text-sm hover:text-primary cursor-pointer transition-colors" onClick={() => onUpdateSong(song)}>{song.title}</div>
                                            </td>
                                            <td className="p-4 text-sm text-zinc-300">{song.artist}</td>
                                            <td className="p-4">
                                                <div className="flex text-zinc-700 text-[10px]">
                                                    {Array.from({ length: 5 }).map((_, i) => (
                                                        <span key={i} className={i < (song.rating || 0) ? "text-yellow-500" : "text-zinc-800"}>★</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="p-4 text-center font-mono text-xs text-zinc-500">
                                                {Math.floor(song.durationSeconds / 60)}m, {song.durationSeconds % 60}s
                                            </td>
                                            <td className="p-4 text-xs text-zinc-500">{new Date(song.createdAt || Date.now()).toLocaleDateString()}</td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${song.practiceStatus === 'Ready' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
                                                    }`}>
                                                    {song.practiceStatus === 'Ready' && <Icons.Check size={10} className="inline mr-1" />}
                                                    {song.practiceStatus === 'Practice' && <Icons.Warning size={10} className="inline mr-1" />}
                                                    {song.practiceStatus || 'Practice'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-xs text-zinc-500 max-w-[150px] truncate" title={song.generalNotes}>
                                                {song.generalNotes || '-'}
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => onDeleteSong(song.id)}
                                                    className={`p-1.5 rounded-md transition-colors ${usedSongIds.has(song.id) || song.status === 'Archived'
                                                        ? 'text-orange-400 hover:bg-orange-500/10'
                                                        : 'text-zinc-600 hover:text-red-400 hover:bg-red-500/10'
                                                        }`}
                                                    title={song.status === 'Archived' ? "Un-Archive" : usedSongIds.has(song.id) ? "Archive (Used in Sets)" : "Delete Permanently"}
                                                >
                                                    {song.status === 'Archived' ? <Icons.Refresh size={14} /> : usedSongIds.has(song.id) ? <Icons.Archive size={14} /> : <Icons.Trash size={14} />}
                                                </button>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-1.5">
                                                    {/* Top Row: Learning Links */}
                                                    <div className="flex items-center gap-1.5">
                                                        <LinkIcon url={song.videoUrl} label="Video" icon={<Icons.Youtube size={12} />} />
                                                        <LinkIcon url={song.guitarLessonUrl} label="Guitar" icon={<Icons.Guitar size={12} />} />
                                                        <LinkIcon url={song.bassLessonUrl} label="Bass" icon={<Icons.Music size={12} />} />
                                                        <LinkIcon url={song.lyricsUrl} label="Lyrics" icon={<Icons.File size={12} />} />
                                                    </div>
                                                    {/* Bottom Row: External Links */}
                                                    <div className="flex items-center gap-1.5 border-t border-white/5 pt-1.5">
                                                        <LinkIcon url={song.externalLink1} label="Link 1" text="1" />
                                                        <LinkIcon url={song.externalLink2} label="Link 2" text="2" />
                                                        <LinkIcon url={song.externalLink3} label="Link 3" text="3" />
                                                        <LinkIcon url={song.externalLink4} label="Link 4" text="4" />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => onUpdateSong(song)}
                                                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
                                                    title="Edit Song Details"
                                                >
                                                    <Icons.Edit size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredSongs.length === 0 && (
                                        <tr>
                                            <td colSpan={10} className="p-8 text-center text-zinc-500 italic">
                                                No songs found matching your filters.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Danger Zone */}
                        <div className="mt-12 mb-8 border border-red-900/30 bg-red-950/10 rounded-xl overflow-hidden">
                            <div className="p-4 bg-red-950/20 border-b border-red-900/30 flex items-center gap-2">
                                <Icons.Warning className="text-red-500" size={20} />
                                <h3 className="text-red-400 font-bold text-sm uppercase tracking-wider">Danger Zone</h3>
                            </div>
                            <div className="p-6 flex items-center justify-between">
                                <div>
                                    <h4 className="text-white font-bold mb-1">Wipe Song Library</h4>
                                    <p className="text-sm text-zinc-400 max-w-md">
                                        Permanently delete ALL songs in your library. This action cannot be undone and will remove songs from all setlists.
                                    </p>
                                </div>
                                <button
                                    onClick={onClearLibrary}
                                    className="px-5 py-2.5 bg-red-900/20 hover:bg-red-600 border border-red-500/50 text-red-200 hover:text-white rounded-lg font-bold transition-all flex items-center gap-2"
                                >
                                    <Icons.Trash size={16} />
                                    Wipe Data
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};
