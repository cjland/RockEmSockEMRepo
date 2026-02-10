import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Song } from '../types';
import { Icons } from './ui/Icons';
import { formatDuration, parseDurationToSeconds } from '../utils';

interface EditSongModalProps {
    song: Song | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (s: Song) => void;
    existingSongs?: Song[];
    mode?: 'add' | 'edit' | 'view';
    bandId?: string;
}

interface PlayHistoryItem {
    date: string;
    gigName: string;
    setDescription: string;
}

export const EditSongModal: React.FC<EditSongModalProps> = ({ song, isOpen, onClose, onSave, existingSongs = [], mode = 'edit', bandId }) => {
    const [formData, setFormData] = useState<Song | null>(null);
    const [durationStr, setDurationStr] = useState('');
    const [history, setHistory] = useState<PlayHistoryItem[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const uniqueArtists = useMemo(() => {
        const artists = new Set(existingSongs.map(s => s.artist).filter(Boolean));
        return Array.from(artists).sort();
    }, [existingSongs]);

    useEffect(() => {
        if (song) {
            setFormData({ ...song });
            setDurationStr(formatDuration(song.durationSeconds));
            if (mode === 'edit' && bandId) {
                fetchPlayHistory(song.id);
            } else {
                setHistory([]);
            }
        }
    }, [song, mode, bandId]);

    const fetchPlayHistory = async (songId: string) => {
        if (!bandId) return;
        setLoadingHistory(true);
        try {
            // 1. Get all setlist_songs for this song
            const { data: setlistSongs } = await supabase
                .from('setlist_songs')
                .select('setlist_id, order_index')
                .eq('song_id', songId);

            if (!setlistSongs || setlistSongs.length === 0) {
                setHistory([]);
                return;
            }

            const setlistIds = setlistSongs.map(s => s.setlist_id);

            // 2. Get Setlists info
            const { data: setlists } = await supabase
                .from('setlists')
                .select('id, gig_id, name')
                .in('id', setlistIds);

            if (!setlists || setlists.length === 0) {
                setHistory([]);
                return;
            }

            const gigIds = [...new Set(setlists.map(s => s.gig_id))];

            // 3. Get Gigs info
            const { data: gigs } = await supabase
                .from('gigs')
                .select('id, name, date')
                .in('id', gigIds)
                .order('date', { ascending: false });

            if (!gigs) {
                setHistory([]);
                return;
            }

            // 4. Combine data
            const historyItems: PlayHistoryItem[] = [];

            // Map for quick lookup
            const gigMap = new Map(gigs.map(g => [g.id, g]));
            const setlistMap = new Map(setlists.map(s => [s.id, s]));

            setlistSongs.forEach(ss => {
                const setlist = setlistMap.get(ss.setlist_id);
                if (setlist) {
                    const gig = gigMap.get(setlist.gig_id);
                    if (gig) {
                        // Build "Set 1, Pos 1" string
                        const setPart = setlist.name.replace('Set ', ''); // simplify "Set 1" -> "1"
                        const posPart = ss.order_index + 1;
                        const desc = `${setPart}-${posPart}`;

                        historyItems.push({
                            date: gig.date,
                            gigName: gig.name,
                            setDescription: desc
                        });
                    }
                }
            });

            // Sort by date desc
            historyItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            setHistory(historyItems);

        } catch (error) {
            console.error("Error fetching song history:", error);
        } finally {
            setLoadingHistory(false);
        }
    };

    if (!isOpen || !formData) return null;

    const handleSave = () => {
        if (formData) {
            if (!formData.title?.trim() || !formData.artist?.trim()) {
                alert("Title and Artist are required.");
                return;
            }

            // Duplicate Check
            if (mode === 'add') {
                const isDuplicate = existingSongs.some(s =>
                    s.title.toLowerCase() === formData.title.trim().toLowerCase() &&
                    s.artist.toLowerCase() === formData.artist.trim().toLowerCase()
                );
                if (isDuplicate) {
                    alert("A song with this Title and Artist already exists!");
                    return;
                }
            }

            onSave({
                ...formData,
                durationSeconds: parseDurationToSeconds(durationStr)
            });
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[#121215]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto ring-1 ring-white/5 flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-white/5 bg-zinc-900 sticky top-0 z-10">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                        {mode === 'add' && <Icons.Plus size={16} className="text-primary" />}
                        {mode === 'edit' && <Icons.Edit size={16} className="text-primary" />}
                        {mode === 'view' && <Icons.Info size={16} className="text-primary" />}
                        {mode === 'add' ? 'Adding New Song' : mode === 'edit' ? 'Edit Song Details' : 'Song Details'}
                    </h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white"><Icons.Close size={20} /></button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Basic Info</h4>
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Song Title <span className="text-red-500">*</span></label>
                            <input disabled={mode === 'view'} type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-sm text-white focus:border-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed" placeholder="e.g. Bohemian Rhapsody" />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Artist <span className="text-red-500">*</span></label>
                            <input
                                disabled={mode === 'view'}
                                type="text"
                                value={formData.artist}
                                onChange={e => setFormData({ ...formData, artist: e.target.value })}
                                list="artist-list"
                                className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-sm text-white focus:border-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="e.g. Queen"
                            />
                            <datalist id="artist-list">
                                {uniqueArtists.map(artist => (
                                    <option key={artist} value={artist} />
                                ))}
                            </datalist>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="text-xs text-zinc-400 block mb-1">Duration (m:s) <span className="text-red-500">*</span></label>
                                <input disabled={mode === 'view'} type="text" value={durationStr} onChange={e => setDurationStr(e.target.value)} className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-sm text-white focus:border-primary outline-none font-mono disabled:opacity-50 disabled:cursor-not-allowed" placeholder="0:00" />
                            </div>
                        </div>

                        {/* Status Toggles */}
                        <div className="bg-black/20 p-3 rounded-lg border border-white/5 space-y-3">
                            {/* Played Live Toggle */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-zinc-300">Played Live</span>
                                <button
                                    disabled={mode === 'view'}
                                    onClick={() => setFormData(prev => {
                                        const newVal = !(prev?.playedLive);
                                        return {
                                            ...prev!,
                                            playedLive: newVal,
                                            // Auto set ready if played live is checked
                                            practiceStatus: newVal ? 'Ready' : prev?.practiceStatus
                                        };
                                    })}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.playedLive ? 'bg-green-600' : 'bg-zinc-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.playedLive ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {/* Status Selector (Active / Hold / Archived) */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-zinc-300">Status</span>
                                <div className="flex bg-zinc-800 rounded-lg p-0.5">
                                    <button
                                        onClick={() => mode !== 'view' && setFormData({ ...formData, status: 'Active' })}
                                        disabled={mode === 'view'}
                                        className={`px-3 py-1 text-xs rounded-md transition-all ${formData.status === 'Active' ? 'bg-green-600 text-white' : 'text-zinc-500 hover:text-zinc-300'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >Active</button>
                                    <button
                                        onClick={() => mode !== 'view' && setFormData({ ...formData, status: 'Hold' })}
                                        disabled={mode === 'view'}
                                        className={`px-3 py-1 text-xs rounded-md transition-all ${formData.status === 'Hold' ? 'bg-yellow-600 text-white' : 'text-zinc-500 hover:text-zinc-300'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >Hold</button>
                                    <button
                                        onClick={() => mode !== 'view' && setFormData({ ...formData, status: 'Archived' })}
                                        disabled={mode === 'view'}
                                        className={`px-3 py-1 text-xs rounded-md transition-all ${formData.status === 'Archived' ? 'bg-zinc-600 text-white' : 'text-zinc-500 hover:text-zinc-300'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >Archived</button>
                                </div>
                            </div>


                            {/* Status State */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-zinc-300">Practice Status</span>
                                <div className="flex bg-zinc-800 rounded-lg p-0.5">
                                    <button
                                        onClick={() => mode !== 'view' && setFormData({ ...formData, practiceStatus: 'Practice', playedLive: false })}
                                        disabled={mode === 'view'}
                                        className={`px-3 py-1 text-xs rounded-md transition-all ${formData.practiceStatus === 'Practice' ? 'bg-zinc-600 text-white' : 'text-zinc-500'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >Practice</button>
                                    <button
                                        onClick={() => mode !== 'view' && setFormData({ ...formData, practiceStatus: 'Ready' })}
                                        disabled={mode === 'view'}
                                        className={`px-3 py-1 text-xs rounded-md transition-all ${formData.practiceStatus === 'Ready' ? 'bg-primary text-white' : 'text-zinc-500'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >Ready</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Meta Info */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Metrics</h4>
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Rating (1-5)</label>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button disabled={mode === 'view'} key={star} onClick={() => setFormData({ ...formData, rating: star })} className={`text-xl ${star <= (formData.rating || 0) ? 'text-yellow-500' : 'text-zinc-700'} disabled:opacity-50 disabled:cursor-not-allowed`}>★</button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">General Notes</label>
                            <textarea
                                disabled={mode === 'view'}
                                rows={4}
                                value={formData.generalNotes || ''}
                                onChange={e => setFormData({ ...formData, generalNotes: e.target.value })}
                                className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-xs text-zinc-300 focus:border-primary outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="Tuning, Capo, Key, etc."
                            />
                        </div>

                    </div>
                </div>

                {/* Play History Section - Full Width at Bottom */}
                {mode === 'edit' && (
                    <div className="p-6 border-t border-white/5 bg-black/20">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center justify-between">
                            Play History
                            {loadingHistory && <Icons.Loader className="animate-spin text-zinc-600" size={12} />}
                        </h4>
                        <div className="bg-black/40 border border-white/5 rounded-lg overflow-hidden relative">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-zinc-900 text-zinc-400">
                                    <tr>
                                        <th className="p-3 font-medium border-b border-white/5">Date</th>
                                        <th className="p-3 font-medium border-b border-white/5">Gig</th>
                                        <th className="p-3 font-medium text-right border-b border-white/5">Set #/Order</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {history.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="p-8 text-center text-zinc-600 italic">
                                                {loadingHistory ? 'Loading history...' : 'No performance history found.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        history.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-white/5 transition-colors group">
                                                <td className="p-3 text-zinc-300 font-mono border-r border-white/5 group-hover:border-white/10">{item.date}</td>
                                                <td className="p-3 text-zinc-300 border-r border-white/5 group-hover:border-white/10">
                                                    <span className="block" title={item.gigName}>{item.gigName}</span>
                                                </td>
                                                <td className="p-3 text-indigo-400 font-bold text-right bg-indigo-500/5 group-hover:bg-indigo-500/10 transition-colors">
                                                    {item.setDescription}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Links */}
                <div className="col-span-1 md:col-span-2 space-y-4 pt-4 border-t border-white/5 p-6">
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">External Links</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1 flex items-center gap-1"><Icons.Youtube size={12} /> Video URL</label>
                            <input disabled={mode === 'view'} type="text" value={formData.videoUrl || ''} onChange={e => setFormData({ ...formData, videoUrl: e.target.value })} className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-xs text-zinc-300 focus:border-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed" placeholder="https://youtube.com/..." />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1 flex items-center gap-1"><Icons.Link size={12} /> Lyrics URL</label>
                            <input disabled={mode === 'view'} type="text" value={formData.lyricsUrl || ''} onChange={e => setFormData({ ...formData, lyricsUrl: e.target.value })} className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-xs text-zinc-300 focus:border-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed" placeholder="https://..." />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1 flex items-center gap-1"><Icons.Guitar size={12} /> Guitar Lesson</label>
                            <input disabled={mode === 'view'} type="text" value={formData.guitarLessonUrl || ''} onChange={e => setFormData({ ...formData, guitarLessonUrl: e.target.value })} className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-xs text-zinc-300 focus:border-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed" placeholder="https://youtube.com/..." />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1 flex items-center gap-1"><Icons.Music size={12} /> Bass Lesson</label>
                            <input disabled={mode === 'view'} type="text" value={formData.bassLessonUrl || ''} onChange={e => setFormData({ ...formData, bassLessonUrl: e.target.value })} className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-xs text-zinc-300 focus:border-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed" placeholder="https://youtube.com/..." />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/5 space-y-4">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">EXTERNAL PERFORMED BANK LINKS FOR THIS SONG</h4>
                        <div className="grid grid-cols-1 gap-3">
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1">Version 1 URL</label>
                                <input disabled={mode === 'view'} type="text" value={formData.externalLink1 || ''} onChange={e => setFormData({ ...formData, externalLink1: e.target.value })} className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-xs text-zinc-300 focus:border-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed" placeholder="https://..." />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1">Version 2 URL</label>
                                <input disabled={mode === 'view'} type="text" value={formData.externalLink2 || ''} onChange={e => setFormData({ ...formData, externalLink2: e.target.value })} className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-xs text-zinc-300 focus:border-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed" placeholder="https://..." />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1">Version 3 URL</label>
                                <input disabled={mode === 'view'} type="text" value={formData.externalLink3 || ''} onChange={e => setFormData({ ...formData, externalLink3: e.target.value })} className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-xs text-zinc-300 focus:border-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed" placeholder="https://..." />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1">Version 4 URL</label>
                                <input disabled={mode === 'view'} type="text" value={formData.externalLink4 || ''} onChange={e => setFormData({ ...formData, externalLink4: e.target.value })} className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-xs text-zinc-300 focus:border-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed" placeholder="https://..." />
                            </div>
                        </div>
                    </div>
                </div>


                <div className="flex justify-end gap-2 p-4 border-t border-white/5 bg-zinc-900 sticky bottom-0 z-10">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400">Close</button>
                    {mode !== 'view' && (
                        <button onClick={handleSave} className="px-6 py-2 bg-primary hover:bg-indigo-500 text-white rounded-md text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20">
                            Save Song
                        </button>
                    )}
                </div>
            </div>
        </div >
    );
};
