
import React, { useState, useMemo, useEffect } from 'react';
import {
    DndContext,
    DragOverlay,
    useSensor,
    useSensors,
    PointerSensor,
    DragStartEvent,
    DragEndEvent,
    defaultDropAnimationSideEffects,
    DropAnimation,
    closestCorners
} from '@dnd-kit/core';
import { horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable';

import { Song, SetList, GigDetails, PDFOptions, BandSettings } from './types'; // Removed SetSong as mostly internal or implicit
import { parseCSV, formatDuration, generatePDFDoc, parseDurationToSeconds, parseBandProfileCSV, transformGoogleSheetUrl, parseGigDetailsCSV } from './utils';
import { SongLibrary } from './components/SongLibrary';
import { SetListColumn } from './components/SetListColumn';
import { Icons } from './components/ui/Icons';
import { useAuth } from './context/AuthContext';
import { useBand } from './hooks/useBand';
import { useSongs } from './hooks/useSongs';
import { useSets } from './hooks/useSets';
import { GigSelector } from './components/GigSelector';
import { SongManager } from './components/SongManager';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useDebugLogger } from './hooks/useDebugLogger';
import { DebugDashboard } from './components/DebugDashboard';

const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
        styles: {
            active: {
                opacity: '0.5',
            },
        },
    }),
};

// Custom Sensor to ignore interactive elements
class SafePointerSensor extends PointerSensor {
    static activators = [
        {
            eventName: 'onPointerDown' as const,
            handler: ({ nativeEvent }: any) => {
                const target = nativeEvent?.target as HTMLElement | null;
                if (!target) return false;

                // Do NOT start a drag from interactive elements
                if (target.closest('button, a, input, select, textarea, [data-no-dnd]')) {
                    return false;
                }
                return true;
            },
        },
    ];
}

// --- Edit Modal Component ---
const EditSongModal = ({ song, isOpen, onClose, onSave, existingSongs = [], mode = 'edit' }: { song: Song | null, isOpen: boolean, onClose: () => void, onSave: (s: Song) => void, existingSongs?: Song[], mode?: 'add' | 'edit' }) => {
    const [formData, setFormData] = React.useState<Song | null>(null);
    const [durationStr, setDurationStr] = React.useState('');

    const uniqueArtists = React.useMemo(() => {
        const artists = new Set(existingSongs.map(s => s.artist).filter(Boolean));
        return Array.from(artists).sort();
    }, [existingSongs]);

    React.useEffect(() => {
        if (song) {
            setFormData({ ...song });
            setDurationStr(formatDuration(song.durationSeconds));
        }
    }, [song]);

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
            <div className="bg-[#121215]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto ring-1 ring-white/5">
                <div className="flex items-center justify-between p-4 border-b border-white/5 bg-zinc-900 sticky top-0 z-10">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                        {mode === 'add' ? <Icons.Plus size={16} className="text-primary" /> : <Icons.Edit size={16} className="text-primary" />}
                        {mode === 'add' ? 'Adding New Song' : 'Edit Song Details'}
                    </h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white"><Icons.Close size={20} /></button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Basic Info</h4>
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Song Title <span className="text-red-500">*</span></label>
                            <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-sm text-white focus:border-primary outline-none" placeholder="e.g. Bohemian Rhapsody" />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Artist <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={formData.artist}
                                onChange={e => setFormData({ ...formData, artist: e.target.value })}
                                list="artist-list"
                                className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-sm text-white focus:border-primary outline-none"
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
                                <input type="text" value={durationStr} onChange={e => setDurationStr(e.target.value)} className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-sm text-white focus:border-primary outline-none font-mono" placeholder="0:00" />
                            </div>
                        </div>

                        {/* Status Toggles */}
                        <div className="bg-black/20 p-3 rounded-lg border border-white/5 space-y-3">
                            {/* Played Live Toggle */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-zinc-300">Played Live</span>
                                <button
                                    onClick={() => setFormData(prev => {
                                        const newVal = !(prev?.playedLive);
                                        return {
                                            ...prev!,
                                            playedLive: newVal,
                                            // Auto set ready if played live is checked
                                            practiceStatus: newVal ? 'Ready' : prev?.practiceStatus
                                        };
                                    })}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.playedLive ? 'bg-green-600' : 'bg-zinc-700'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.playedLive ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {/* Archived Toggle */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-zinc-300">Archived</span>
                                <button
                                    onClick={() => setFormData(prev => ({ ...prev!, status: prev?.status === 'Archived' ? 'Active' : 'Archived' }))}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.status === 'Archived' ? 'bg-orange-600' : 'bg-zinc-700'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.status === 'Archived' ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>


                            {/* Status State */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-zinc-300">Song Status</span>
                                <div className="flex bg-zinc-800 rounded-lg p-0.5">
                                    <button
                                        onClick={() => setFormData({ ...formData, practiceStatus: 'Practice', playedLive: false })}
                                        className={`px-3 py-1 text-xs rounded-md transition-all ${formData.practiceStatus === 'Practice' ? 'bg-zinc-600 text-white' : 'text-zinc-500'}`}
                                    >Practice</button>
                                    <button
                                        onClick={() => setFormData({ ...formData, practiceStatus: 'Ready' })}
                                        className={`px-3 py-1 text-xs rounded-md transition-all ${formData.practiceStatus === 'Ready' ? 'bg-primary text-white' : 'text-zinc-500'}`}
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
                                    <button key={star} onClick={() => setFormData({ ...formData, rating: star })} className={`text-xl ${star <= (formData.rating || 0) ? 'text-yellow-500' : 'text-zinc-700'}`}>★</button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">General Notes</label>
                            <textarea
                                rows={4}
                                value={formData.generalNotes || ''}
                                onChange={e => setFormData({ ...formData, generalNotes: e.target.value })}
                                className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-xs text-zinc-300 focus:border-primary outline-none resize-none"
                                placeholder="Tuning, Capo, Key, etc."
                            />
                        </div>
                    </div>

                    {/* Links */}
                    <div className="col-span-1 md:col-span-2 space-y-4 pt-4 border-t border-white/5">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">External Links</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1 flex items-center gap-1"><Icons.Youtube size={12} /> Video URL</label>
                                <input type="text" value={formData.videoUrl || ''} onChange={e => setFormData({ ...formData, videoUrl: e.target.value })} className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-xs text-zinc-300 focus:border-primary outline-none" placeholder="https://youtube.com/..." />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1 flex items-center gap-1"><Icons.Link size={12} /> Lyrics URL</label>
                                <input type="text" value={formData.lyricsUrl || ''} onChange={e => setFormData({ ...formData, lyricsUrl: e.target.value })} className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-xs text-zinc-300 focus:border-primary outline-none" placeholder="https://..." />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1 flex items-center gap-1"><Icons.Guitar size={12} /> Guitar Lesson</label>
                                <input type="text" value={formData.guitarLessonUrl || ''} onChange={e => setFormData({ ...formData, guitarLessonUrl: e.target.value })} className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-xs text-zinc-300 focus:border-primary outline-none" placeholder="https://youtube.com/..." />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1 flex items-center gap-1"><Icons.Music size={12} /> Bass Lesson</label>
                                <input type="text" value={formData.bassLessonUrl || ''} onChange={e => setFormData({ ...formData, bassLessonUrl: e.target.value })} className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-xs text-zinc-300 focus:border-primary outline-none" placeholder="https://youtube.com/..." />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 p-4 border-t border-white/5 bg-zinc-900 sticky bottom-0 z-10">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400">Cancel</button>
                    <button onClick={handleSave} className="px-6 py-2 bg-primary hover:bg-indigo-500 text-white rounded-md text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20">
                        Save Song
                    </button>
                </div>
            </div>
        </div>

    );
};

// PDF Options Modal Component
const PDFOptionsModal = ({ isOpen, onClose, onGenerate }: { isOpen: boolean, onClose: () => void, onGenerate: (opts: PDFOptions) => void }) => {
    const [options, setOptions] = useState<PDFOptions>({
        includeNotes: false,
        oneSetPerPage: false,
        largeType: false,
        includeLogo: true,
        includeGigInfo: true
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[#121215]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden ring-1 ring-white/5">
                <div className="p-4 border-b border-white/5 bg-zinc-900 flex justify-between">
                    <h3 className="font-semibold text-white">Print Settings</h3>
                    <button onClick={onClose}><Icons.Close size={20} className="text-zinc-500" /></button>
                </div>
                <div className="p-4 space-y-3">
                    <label className="flex items-center justify-between p-2 rounded hover:bg-zinc-800 cursor-pointer">
                        <span className="text-sm text-zinc-300">Include Notes</span>
                        <input type="checkbox" checked={options.includeNotes} onChange={e => setOptions({ ...options, includeNotes: e.target.checked })} className="rounded bg-zinc-700 text-primary" />
                    </label>
                    <label className="flex items-center justify-between p-2 rounded hover:bg-zinc-800 cursor-pointer">
                        <span className="text-sm text-zinc-300">One Set Per Page</span>
                        <input type="checkbox" checked={options.oneSetPerPage} onChange={e => setOptions({ ...options, oneSetPerPage: e.target.checked })} className="rounded bg-zinc-700 text-primary" />
                    </label>
                    <label className="flex items-center justify-between p-2 rounded hover:bg-zinc-800 cursor-pointer">
                        <span className="text-sm text-zinc-300">Extra Large Type</span>
                        <input type="checkbox" checked={options.largeType} onChange={e => setOptions({ ...options, largeType: e.target.checked })} className="rounded bg-zinc-700 text-primary" />
                    </label>
                    <label className="flex items-center justify-between p-2 rounded hover:bg-zinc-800 cursor-pointer">
                        <span className="text-sm text-zinc-300">Include Band Logo</span>
                        <input type="checkbox" checked={options.includeLogo} onChange={e => setOptions({ ...options, includeLogo: e.target.checked })} className="rounded bg-zinc-700 text-primary" />
                    </label>
                    <label className="flex items-center justify-between p-2 rounded hover:bg-zinc-800 cursor-pointer">
                        <span className="text-sm text-zinc-300">Include Venue/Time</span>
                        <input type="checkbox" checked={options.includeGigInfo} onChange={e => setOptions({ ...options, includeGigInfo: e.target.checked })} className="rounded bg-zinc-700 text-primary" />
                    </label>

                    <button
                        onClick={() => onGenerate(options)}
                        className="w-full mt-4 py-2 bg-primary text-white rounded-md font-medium hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2"
                    >
                        <Icons.Print size={16} /> Generate PDF
                    </button>
                </div>
            </div>
        </div>
    );
};

// Band Settings Modal
const BandSettingsModal = ({
    isOpen,
    onClose,
    settings,
    onSave,
    onApplyProfile,
    onApplyGigDetails
}: {
    isOpen: boolean,
    onClose: () => void,
    settings: BandSettings,
    onSave: (s: BandSettings) => void,
    onApplyProfile: (s: Partial<BandSettings>) => void
    onApplyGigDetails: (s: Partial<GigDetails>) => void
}) => {
    const [data, setData] = useState<BandSettings>(settings);
    // State for 5 specific member slots
    const [memberSlots, setMemberSlots] = useState<string[]>(Array(5).fill(''));
    const [status, setStatus] = useState<{ msg: string, isError: boolean } | null>(null);
    const [gigStatus, setGigStatus] = useState<{ msg: string, isError: boolean } | null>(null);

    // Sync when modal opens
    useEffect(() => {
        if (isOpen) {
            setData(settings);
            // Pad existing members to 5 slots
            const currentMembers = [...settings.members];
            while (currentMembers.length < 5) currentMembers.push('');
            setMemberSlots(currentMembers.slice(0, 5));
            setStatus(null);
            setGigStatus(null);
        }
    }, [isOpen, settings]);

    const handleUpdateMemberSlot = (index: number, value: string) => {
        const newSlots = [...memberSlots];
        newSlots[index] = value;
        setMemberSlots(newSlots);
    };

    const handleFetchProfile = async () => {
        setStatus({ msg: 'Loading...', isError: false });
        if (!data.bandProfileUrl) return;

        // Use the robust utility for transformation
        const url = transformGoogleSheetUrl(data.bandProfileUrl);

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('Network response was not ok');
            const text = await res.text();

            // Check for HTML response (often Google Permissions login page)
            if (text.trim().startsWith("<!DOCTYPE html") || text.trim().startsWith("<html")) {
                throw new Error("Google returned HTML. Make sure the sheet is Public.");
            }

            const parsed = parseBandProfileCSV(text);

            if (Object.keys(parsed).length > 0) {
                const newMembers = parsed.members && parsed.members.length > 0 ? parsed.members : data.members;

                // Pad new members to 5 slots
                const paddedMembers = [...newMembers];
                while (paddedMembers.length < 5) paddedMembers.push('');
                const finalSlots = paddedMembers.slice(0, 5);

                const newData = {
                    ...data,
                    name: parsed.name || data.name,
                    logoUrl: parsed.logoUrl || data.logoUrl,
                    members: newMembers // Keep original array logic for internal data
                };

                setData(newData);
                setMemberSlots(finalSlots);

                // Immediately apply to global app state
                onApplyProfile(newData);

                setStatus({ msg: 'Profile loaded and applied!', isError: false });
                setTimeout(() => setStatus(null), 3000);
            } else {
                setStatus({ msg: 'No valid band info found in CSV.', isError: true });
            }
        } catch (error) {
            console.error("Failed to fetch band profile", error);
            setStatus({ msg: 'Failed to load profile. Check URL & permissions.', isError: true });
        }
    };

    const handleFetchGigDetails = async () => {
        setGigStatus({ msg: 'Loading...', isError: false });
        if (!data.gigDetailsUrl) return;

        const url = transformGoogleSheetUrl(data.gigDetailsUrl);

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('Network response was not ok');
            const text = await res.text();
            // Check for HTML response (often Google Permissions login page)
            if (text.trim().startsWith("<!DOCTYPE html") || text.trim().startsWith("<html")) {
                throw new Error("Google returned HTML. Make sure the sheet is Public.");
            }

            const parsed = parseGigDetailsCSV(text);

            if (Object.keys(parsed).length > 0) {
                onApplyGigDetails(parsed);
                setGigStatus({ msg: 'Gig details loaded and applied!', isError: false });
                setTimeout(() => setGigStatus(null), 3000);
            } else {
                setGigStatus({ msg: 'No valid gig details found in CSV.', isError: true });
            }

        } catch (error) {
            console.error("Failed to fetch gig details", error);
            setGigStatus({ msg: 'Failed to load gig details.', isError: true });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[#121215]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden ring-1 ring-white/5">
                <div className="p-4 border-b border-white/5 bg-zinc-900 flex justify-between items-center">
                    <h3 className="font-semibold text-white flex items-center gap-2"><Icons.Globe size={16} /> Global Band Settings</h3>
                    <button onClick={onClose}><Icons.Close size={20} className="text-zinc-500" /></button>
                </div>
                <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    {/* Band Profile URL */}
                    <div>
                        <label className="block text-xs text-zinc-500 mb-1">Band Profile URL (CSV/Google Sheet)</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="flex-1 bg-background border border-zinc-700 rounded p-2 text-sm text-white focus:border-primary outline-none"
                                value={data.bandProfileUrl || ''}
                                onChange={e => setData({ ...data, bandProfileUrl: e.target.value })}
                                placeholder="https://docs.google.com/spreadsheets/..."
                            />
                            <button
                                onClick={handleFetchProfile}
                                className="px-3 py-1 bg-zinc-800 text-xs text-white rounded hover:bg-zinc-700 border border-white/5 whitespace-nowrap"
                                disabled={!data.bandProfileUrl}
                            >
                                Load Profile
                            </button>
                        </div>
                        {status ? (
                            <p className={`text-[10px] mt-1 font-medium ${status.isError ? 'text-red-400' : 'text-green-400'}`}>
                                {status.msg}
                            </p>
                        ) : (
                            <p className="text-[10px] text-zinc-600 mt-1">Loads Name, Logo, and Members from a spreadsheet.</p>
                        )}
                    </div>

                    <div className="h-px bg-white/5 my-4"></div>

                    {/* Band Preferences Section */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Band Preferences</h4>

                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">Band Name</label>
                            <input
                                type="text"
                                className="w-full bg-background border border-zinc-700 rounded p-2 text-sm text-white focus:border-primary outline-none"
                                value={data.name}
                                onChange={e => setData({ ...data, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">Band Logo URL</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    className="flex-1 bg-background border border-zinc-700 rounded p-2 text-sm text-white focus:border-primary outline-none"
                                    value={data.logoUrl}
                                    onChange={e => setData({ ...data, logoUrl: e.target.value })}
                                    placeholder="https://..."
                                />
                                {data.logoUrl && (
                                    <img src={data.logoUrl} className="w-10 h-10 object-contain bg-white rounded" alt="Logo Preview" />
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs text-zinc-500 mb-2">Band Members</label>
                            <div className="grid grid-cols-2 gap-3">
                                {memberSlots.map((member, idx) => (
                                    <div key={idx} className="col-span-1">
                                        <label className="block text-[10px] text-zinc-600 mb-0.5">Member {idx + 1}</label>
                                        <input
                                            type="text"
                                            className="w-full bg-background border border-zinc-700 rounded p-2 text-sm text-white focus:border-primary outline-none"
                                            value={member}
                                            onChange={(e) => handleUpdateMemberSlot(idx, e.target.value)}
                                            placeholder={`Member ${idx + 1}`}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-white/5 my-4"></div>

                    {/* Default Library URL */}
                    <div>
                        <label className="block text-xs text-zinc-500 mb-1">Default Library URL (CSV/Google Sheet)</label>
                        <input
                            type="text"
                            className="w-full bg-background border border-zinc-700 rounded p-2 text-sm text-white focus:border-primary outline-none"
                            value={data.defaultLibraryUrl || ''}
                            onChange={e => setData({ ...data, defaultLibraryUrl: e.target.value })}
                            placeholder="https://docs.google.com/spreadsheets/..."
                        />
                        <p className="text-[10px] text-zinc-600 mt-1">Used for quickly importing a base library in the Import dialog.</p>
                    </div>

                    {/* Gig Details URL */}
                    <div>
                        <label className="block text-xs text-zinc-500 mb-1">Gig Details URL (CSV/Google Sheet)</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="flex-1 bg-background border border-zinc-700 rounded p-2 text-sm text-white focus:border-primary outline-none"
                                value={data.gigDetailsUrl || ''}
                                onChange={e => setData({ ...data, gigDetailsUrl: e.target.value })}
                                placeholder="https://docs.google.com/spreadsheets/..."
                            />
                            <button
                                onClick={handleFetchGigDetails}
                                className="px-3 py-1 bg-zinc-800 text-xs text-white rounded hover:bg-zinc-700 border border-white/5 whitespace-nowrap"
                                disabled={!data.gigDetailsUrl}
                            >
                                Load Details
                            </button>
                        </div>
                        {gigStatus ? (
                            <p className={`text-[10px] mt-1 font-medium ${gigStatus.isError ? 'text-red-400' : 'text-green-400'}`}>
                                {gigStatus.msg}
                            </p>
                        ) : (
                            <p className="text-[10px] text-zinc-600 mt-1">Imports Gig Name, Location, Date, Time, and Notes.</p>
                        )}
                    </div>

                    <div className="pt-2 flex justify-end gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400">Cancel</button>
                        <button
                            onClick={() => {
                                // Filter out empty slots for the final save
                                const finalMembers = memberSlots.filter(m => m.trim() !== '');
                                onSave({ ...data, members: finalMembers });
                                onClose();
                            }}
                            className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-white hover:bg-indigo-500 transition-colors"
                        >
                            Save Settings
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Generic Confirmation Modal
interface ConfirmationState {
    type: 'REMOVE_SET' | 'REPLACE_LIBRARY' | 'CLEAR_LIBRARY' | 'ARCHIVE_SONG';
    title: string;
    message: string;
    confirmLabel: string;
    confirmVariant?: 'danger' | 'primary';
    data?: any;
}

const ConfirmationModal = ({ isOpen, state, onClose, onConfirm }: { isOpen: boolean, state: ConfirmationState | null, onClose: () => void, onConfirm: () => void }) => {
    if (!isOpen || !state) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[#121215]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden ring-1 ring-white/5">
                <div className="p-4 border-b border-white/5 bg-zinc-900 flex justify-between items-center">
                    <h3 className="font-semibold text-white">{state.title}</h3>
                    <button onClick={onClose}>
                        <Icons.Close size={20} className="text-zinc-500" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        {state.message}
                    </p>

                    <div className="flex justify-end gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-zinc-400 hover:text-white"
                        >
                            Cancel
                        </button>

                        <button
                            onClick={() => { onConfirm(); onClose(); }}
                            className={`px-4 py-2 rounded-md text-sm font-medium text-white transition-colors ${state.confirmVariant === 'danger' ? 'bg-red-600 hover:bg-red-500' : 'bg-primary hover:bg-indigo-500'}`}
                        >
                            {state.confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper to get used song IDs
const getUsedSongIds = (sets: SetList[]) => {
    const ids = new Set<string>();
    sets.forEach(set => {
        set.songs.forEach(s => ids.add(s.id));
    });
    return ids;
};

const EditGigModal = ({ gig, isOpen, onClose, onSave }: { gig: any, isOpen: boolean, onClose: () => void, onSave: (data: any) => void }) => {
    const [formData, setFormData] = useState({
        name: gig.name || '',
        date: gig.date ? new Date(gig.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        location: gig.location || ''
    });

    useEffect(() => {
        if (gig) {
            setFormData({
                name: gig.name || '',
                date: gig.date ? new Date(gig.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                location: gig.location || ''
            });
        }
    }, [gig]);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[#121215] border border-white/10 rounded-xl shadow-2xl w-full max-w-md p-6 ring-1 ring-white/5">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white">Edit Gig Details</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white"><Icons.Close size={20} /></button>
                </div>

                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-xs text-zinc-400 mb-1">Gig Name</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-black/30 border border-zinc-700 rounded p-2.5 text-sm text-white focus:border-primary outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-zinc-400 mb-1">Date</label>
                        <input
                            type="date"
                            required
                            value={formData.date}
                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                            className="w-full bg-black/30 border border-zinc-700 rounded p-2.5 text-sm text-white focus:border-primary outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-zinc-400 mb-1">Location</label>
                        <input
                            type="text"
                            required
                            value={formData.location}
                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                            className="w-full bg-black/30 border border-zinc-700 rounded p-2.5 text-sm text-white focus:border-primary outline-none"
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-white">Cancel</button>
                        <button type="submit" className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-md hover:bg-indigo-500 transition-colors shadow-lg shadow-primary/20">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default function App() {
    // 1. URL Cleanup Effect Removed to prevent infinite loop with Supabase Auth
    // Auth & Hooks
    const { user, profile, signInWithGoogle, signOut, loading: authLoading } = useAuth();
    const {
        bandSettings,
        gigs,
        gigDetails,
        currentGigId,
        loading: bandLoading,
        selectGig,
        createGig,
        updateBandSettings,
        updateGigDetails,
        refreshGigDetailsFromUrl
    } = useBand(profile);

    const {
        songs,
        loading: songsLoading,
        addSongsToLibrary,
        replaceLibrary,
        updateSong,
        deleteSong,
        clearLibrary
    } = useSongs(profile);

    const {
        sets,
        loading: setsLoading,
        addSet,
        removeSet,
        updateSetDetails,
        reorderSets,
        reorderSongInSet,
        addMultipleSongsToSet,
        moveSongBetweenSets,
        addSongToSet,
        removeSongFromSet,
        updateSongNote,
        updateSongInSets,
        clearAllSets
    } = useSets(profile, gigDetails?.settings?.setOrder);

    // Dnd Sensors
    const sensors = useSensors(
        useSensor(SafePointerSensor)
    );

    // Local UI State
    const [activeDragItem, setActiveDragItem] = useState<{ type: string; data: any } | null>(null);
    const [view, setView] = useState<'GIG_SELECT' | 'APP' | 'SONG_MANAGER'>('GIG_SELECT');
    const [showImport, setShowImport] = useState(false);
    const [importText, setImportText] = useState('');
    const [showGigDetails, setShowGigDetails] = useState(false);
    const [showBandSettings, setShowBandSettings] = useState(false);
    const [showEditingGig, setShowEditingGig] = useState(false); // Add this line
    const [showPDFOptions, setShowPDFOptions] = useState(false);

    const [editingSong, setEditingSong] = useState<Song | null>(null);
    const [confirmState, setConfirmState] = useState<ConfirmationState | null>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    // Effect to switch view if currentGigId changes (e.g. from sign in with existing state)
    useEffect(() => {
        if (currentGigId) {
            setView('APP');
        } else {
            setView('GIG_SELECT');
        }
    }, [currentGigId]);

    // Derived State
    const usedInSetsMap = useMemo(() => {
        const map: Record<string, { name: string, index: number }[]> = {};
        sets.forEach((set, setIndex) => {
            set.songs.forEach(s => {
                if (!map[s.id]) {
                    map[s.id] = [];
                }
                map[s.id].push({ name: set.name, index: setIndex });
            });
        });
        return map;
    }, [sets]);

    const duplicateSongIds = useMemo(() => {
        const counts = new Map<string, number>();
        sets.forEach(set => {
            set.songs.forEach(s => {
                const key = s.id;
                counts.set(key, (counts.get(key) || 0) + 1);
            });
        });
        return Array.from(counts.entries()).filter(([_, count]) => count > 1).map(([key]) => key);
    }, [sets]);

    useDebugLogger(songs, sets);

    // Handlers
    const handleSaveBandSettingsLogic = async (newSettings: BandSettings) => {
        setSaveStatus('saving');
        await updateBandSettings(newSettings);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    };

    const handleUpdateGigDetailsLogic = async (updates: Partial<GigDetails>) => {
        setSaveStatus('saving');
        await updateGigDetails(updates);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    };

    const saveData = async () => {
        // Simple visual confirmation
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    };

    const handleImportLogic = async (mode: 'add' | 'replace') => {
        const newSongs = parseCSV(importText);
        if (newSongs.length === 0) {
            alert("No valid songs found.");
            return;
        }

        if (mode === 'replace') {
            setConfirmState({
                type: 'REPLACE_LIBRARY',
                title: 'Replace Library?',
                message: `This will delete ALL existing songs and replace them with the ${newSongs.length} songs from your import.`,
                confirmLabel: 'Replace All',
                confirmVariant: 'danger',
                data: { newSongs }
            });
        } else {
            await addSongsToLibrary(newSongs);
            // NEW: Automatically add imported songs to the first set if available
            if (sets.length > 0) {
                addMultipleSongsToSet(sets[0].id, newSongs);
            }
            setShowImport(false);
            setImportText('');
        }
    };

    const handleConfirmAction = async () => {
        if (!confirmState) return;

        if (confirmState.type === 'REMOVE_SET') {
            if (confirmState.data?.id) await removeSet(confirmState.data.id);
        } else if (confirmState.type === 'REPLACE_LIBRARY') {
            if (confirmState.data?.newSongs) {
                await replaceLibrary(confirmState.data.newSongs);
                setShowImport(false);
                setImportText('');
            }
        } else if (confirmState.type === 'CLEAR_LIBRARY') {
            await clearLibrary();
        }
        setConfirmState(null);
    };

    const handleAddToFirstSet = (song: Song) => {
        if (sets.length > 0) {
            addSongToSet(sets[0].id, song);
        } else {
            alert("No sets available. Create a set first.");
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveDragItem({ type: active.data.current?.type, data: active.data.current?.data });
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        console.log("Drag End:", { active: active.data.current, over: over?.data.current, overId: over?.id });
        setActiveDragItem(null);
        if (!over) return;

        // 1. Column Reorder
        if (active.data.current?.type === 'SET_COLUMN' && over.data.current?.type === 'SET_COLUMN') {
            if (active.id !== over.id) {
                const oldIndex = sets.findIndex(s => s.id === active.id);
                const newIndex = sets.findIndex(s => s.id === over.id);
                reorderSets(oldIndex, newIndex);

                // Persist new order to Gig Settings
                const newSets = [...sets];
                const [movedSet] = newSets.splice(oldIndex, 1);
                newSets.splice(newIndex, 0, movedSet);
                const newOrder = newSets.map(s => s.id);

                updateGigDetails({
                    settings: {
                        ...gigDetails.settings,
                        setOrder: newOrder
                    }
                });
            }
            return;
        }

        // 2. Song Reorder (Same or Different Set)
        if (active.data.current?.type === 'SET_SONG') {
            const activeSetId = active.data.current.originSetId; // origin
            // Determine target set
            let targetSetId = null;
            let targetIndex = -1;

            if (over.data.current?.type === 'SET_SONG') {
                const overSet = sets.find(s => s.songs.some(song => song.instanceId === over.id));
                if (overSet) {
                    targetSetId = overSet.id;
                    targetIndex = overSet.songs.findIndex(s => s.instanceId === over.id);
                }
            } else if (over.data.current?.type === 'SET' || over.data.current?.type === 'SET_COLUMN') {
                targetSetId = over.id;
                // Append to end
                const targetSet = sets.find(s => s.id === targetSetId);
                targetIndex = targetSet ? targetSet.songs.length : 0;
            }

            if (targetSetId) {
                if (activeSetId === targetSetId) {
                    // Same Set Reorder
                    const oldIndex = sets.find(s => s.id === activeSetId)?.songs.findIndex(s => s.instanceId === active.id) ?? -1;
                    if (oldIndex !== -1 && oldIndex !== targetIndex) {
                        reorderSongInSet(activeSetId, oldIndex, targetIndex);
                    }
                } else {
                    // Move between sets
                    moveSongBetweenSets(activeSetId, targetSetId, active.id as string, targetIndex);
                }
            }
            return;
        }

        // 3. Drop from Library
        if (active.data.current?.type === 'LIBRARY_SONG') {
            const songData = active.data.current.data as Song;
            let targetSetId = null;
            let insertIndex = -1;

            if (over.data.current?.type === 'SET' || over.data.current?.type === 'SET_COLUMN') {
                targetSetId = over.id;
            } else if (over.data.current?.type === 'SET_SONG') {
                const overSet = sets.find(s => s.songs.some(so => so.instanceId === over.id));
                if (overSet) {
                    targetSetId = overSet.id;
                    insertIndex = overSet.songs.findIndex(s => s.instanceId === over.id);
                }
            }

            if (targetSetId) {
                addSongToSet(targetSetId, songData, insertIndex);
            }
        }
    };

    const requestRemoveSetWrapper = (id: string) => {
        const set = sets.find(s => s.id === id);
        if (set && set.songs.length > 0) {
            setConfirmState({
                type: 'REMOVE_SET',
                title: 'Remove Set',
                message: `Remove "${set.name}"? ${set.songs.length} songs will be removed from the set.`,
                confirmLabel: 'Remove',
                confirmVariant: 'danger',
                data: { id }
            });
        } else {
            removeSet(id);
        }
    };



    const handleUpdateSongWrapper = async (updatedSong: Song) => {
        await updateSong(updatedSong);
        updateSongInSets(updatedSong); // Optimistic update in sets
    };

    // Auth & Loading States
    if (authLoading || bandLoading || songsLoading || setsLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-black text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-[#09090b] to-[#09090b] z-0"></div>
                <div className="z-10 max-w-md w-full text-center space-y-8 animate-fade-in">
                    <div>
                        <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent transform hover:scale-105 transition-transform duration-500">Band Manager</h1>
                        <p className="mt-2 text-zinc-400">Manage your setlists, songs, and gigs with your entire band.</p>
                    </div>
                    <div className="bg-[#121215]/80 backdrop-blur-xl border border-white/10 rounded-xl p-8 shadow-2xl ring-1 ring-white/5">
                        <button
                            onClick={signInWithGoogle}
                            className="w-full py-3 px-4 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 flex items-center justify-center gap-3 transition-all hover:shadow-lg hover:-translate-y-0.5"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Sign in with Google
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const renderContent = () => {
        if (view === 'SONG_MANAGER') {
            return (
                <SongManager
                    key={songs.length} // Force re-render on count change
                    songs={songs}
                    usedSongIds={getUsedSongIds(sets)}
                    onBack={() => setView('GIG_SELECT')}
                    onAddSong={() => {
                        setEditingSong({ id: crypto.randomUUID(), title: '', artist: '', durationSeconds: 0, practiceStatus: 'Ready', status: 'Active' } as Song);
                    }}
                    onUpdateSong={(song) => setEditingSong(song)}
                    onDeleteSong={(id) => {
                        const song = songs.find(s => s.id === id);
                        if (song) {
                            const isUsed = getUsedSongIds(sets).has(id);
                            if (isUsed) {
                                setConfirmState({
                                    type: 'ARCHIVE_SONG',
                                    title: 'Archive Song?',
                                    message: `"${song.title}" is currently used in setlists. It will be archived but will remain in your sets.`,
                                    confirmLabel: 'Archive',
                                    confirmVariant: 'warning',
                                    data: { song }
                                });
                            } else {
                                setConfirmState({
                                    type: 'DELETE_SONG',
                                    title: 'Delete Song?',
                                    message: `Are you sure you want to permanently delete "${song.title}"? This cannot be undone.`,
                                    confirmLabel: 'Delete Forever',
                                    confirmVariant: 'danger',
                                    data: { id }
                                });
                            }
                        }
                    }}
                    onImport={() => setShowImport(true)}
                />
            );
        }

        if (view === 'GIG_SELECT') {
            return (
                <GigSelector
                    gigs={gigs}
                    onCreateGig={createGig}
                    onSelectGig={(id) => selectGig(id)}
                    onManageSongs={() => setView('SONG_MANAGER')}
                    onSignOut={signOut}
                    onBandSettings={() => setShowBandSettings(true)}
                    userEmail={user?.email}
                />
            );
        }

        return (
            <div className="flex flex-col h-screen bg-[#09090b] text-zinc-100 font-sans overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#09090b] to-[#09090b]">
                {/* Header */}
                <header className="h-[60px] bg-black/40 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 shrink-0 z-40 sticky top-0 custom-glass">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => selectGig(null)}
                            className="p-2 -ml-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-full transition-colors group"
                            title="Back to Gig Selection"
                        >
                            <Icons.ArrowLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
                        </button>

                        <div className="h-6 w-px bg-white/10 mx-1"></div>

                        <div className="flex items-center gap-2">
                            <div className="bg-primary/20 text-primary px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-primary/20">
                                Set Manager
                            </div>
                        </div>

                        <div className="h-6 w-px bg-white/10 mx-1"></div>

                        <div className="flex items-center gap-2 group cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors" onClick={() => setShowEditingGig(true)}>
                            <div>
                                <h1 className="text-sm font-bold text-white group-hover:text-primary transition-colors">{gigDetails.name}</h1>
                                <div className="flex items-center gap-2 text-xs text-zinc-500">
                                    <span>{new Date(gigDetails.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                                    <span>•</span>
                                    <span>{gigDetails.location}</span>
                                </div>
                            </div>
                            <Icons.Settings size={14} className="text-zinc-600 group-hover:text-zinc-400" />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Removed Import, Clear, Save, BandSettings */}

                        {/* Desktop Profile */}
                        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/50 border border-white/5">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[8px] font-bold text-white">
                                {user.email?.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[10px] text-zinc-400 max-w-[100px] truncate">{user.email}</span>
                        </div>

                        <button onClick={() => setShowPDFOptions(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-white hover:bg-indigo-500 transition-all shadow-lg shadow-primary/20">
                            <Icons.Download size={16} /> Export PDF
                        </button>
                    </div>
                </header>

                {/* Main Content */}
                <div className="flex flex-1 overflow-hidden">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCorners}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        dropAnimation={dropAnimation}
                    >
                        <ErrorBoundary name="SongLibrary">
                            <SongLibrary
                                songs={songs.filter(s => s.status !== 'Archived')} // Filter out archived songs
                                usedInSetsMap={usedInSetsMap}
                                onPlaySong={(song) => window.open(song.videoUrl, '_blank')}
                                onUpdateSong={handleUpdateSongWrapper}
                                onEditSong={(song) => setEditingSong(song)}
                                onAddToSet={(song) => {
                                    if (sets.length > 0) {
                                        addSongToSet(sets[0].id, song);
                                    } else {
                                        alert("Please create a set first!");
                                    }
                                }}
                            />
                        </ErrorBoundary>
                        <div className="flex-1 flex flex-col bg-[#0c0c0e] relative overflow-hidden">
                            <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 custom-scrollbar">
                                <SortableContext items={sets.map(s => s.id)} strategy={horizontalListSortingStrategy}>
                                    <div className="flex gap-6 h-full min-w-max pb-4">
                                        {sets.map((set, i) => (
                                            <ErrorBoundary key={set.id} name={`SetListColumn-${set.name}`}>
                                                <SetListColumn
                                                    key={set.id}
                                                    setList={set}
                                                    setIndex={i}
                                                    totalSets={sets.length}
                                                    bandMembers={bandSettings.members}
                                                    duplicateSongIds={duplicateSongIds}
                                                    onRemoveSet={requestRemoveSetWrapper}
                                                    onRemoveSong={(setId, songId) => removeSongFromSet(setId, songId)}
                                                    onUpdateNote={(setId, songId, note) => updateSongNote(setId, songId, note)}
                                                    onPlaySong={(song) => song.videoUrl ? window.open(song.videoUrl, '_blank') : alert("No Video URL")}
                                                    onUpdateSetDetails={updateSetDetails}
                                                    onEditSong={setEditingSong}
                                                />
                                            </ErrorBoundary>
                                        ))}

                                        {sets.length < 5 && (
                                            <div className="w-[320px] flex items-center justify-center shrink-0">
                                                <button onClick={addSet} className="group flex flex-col items-center justify-center w-full h-[200px] border-2 border-dashed border-zinc-800 hover:border-primary/50 rounded-xl transition-all bg-zinc-900/20 hover:bg-zinc-900/50">
                                                    <div className="w-12 h-12 rounded-full bg-zinc-800 group-hover:bg-primary/20 flex items-center justify-center mb-3 transition-colors">
                                                        <Icons.Plus size={24} className="text-zinc-500 group-hover:text-primary" />
                                                    </div>
                                                    <span className="text-zinc-500 font-medium group-hover:text-zinc-300">Add New Set</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </SortableContext>
                            </div>
                        </div>

                        <DragOverlay dropAnimation={dropAnimation}>
                            {activeDragItem ? (
                                activeDragItem.type === 'LIBRARY_SONG' ? (
                                    <div className="w-[300px] p-3 rounded-xl border border-primary/50 bg-[#121215]/90 shadow-2xl shadow-primary/20 cursor-grabbing backdrop-blur-md ring-1 ring-white/10">
                                        <div className="font-semibold text-white truncate">{activeDragItem.data.title}</div>
                                        <div className="text-xs text-zinc-400">{activeDragItem.data.artist}</div>
                                    </div>
                                ) : activeDragItem.type === 'SET_SONG' ? (
                                    <div className="w-[300px] p-3 rounded-xl border border-yellow-500/50 bg-[#121215]/90 shadow-2xl shadow-yellow-500/10 cursor-grabbing backdrop-blur-md ring-1 ring-white/10">
                                        <div className="flex items-center gap-2">
                                            <span className="text-zinc-500 font-mono text-xs">0.</span>
                                            <div className="font-semibold text-white truncate">{activeDragItem.data.title}</div>
                                        </div>
                                    </div>
                                ) : activeDragItem.type === 'SET_COLUMN' ? (
                                    <div className="w-[320px] h-[400px] bg-[#121215]/80 rounded-xl border border-white/10 shadow-2xl backdrop-blur-xl opacity-90 ring-1 ring-white/5">
                                        <div className="p-4 border-b border-white/5 font-bold text-white bg-white/[0.02]">{activeDragItem.data.name}</div>
                                    </div>
                                ) : null
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-black text-white selection:bg-primary/30">
            {renderContent()}

            {/* Modals - Rendered Globally */}
            <EditSongModal
                song={editingSong}
                isOpen={!!editingSong}
                onClose={() => setEditingSong(null)}
                onSave={(updatedSong) => {
                    // If ID exists in songs, update. Else add.
                    if (songs.find(s => s.id === updatedSong.id)) {
                        handleUpdateSongWrapper(updatedSong);
                    } else {
                        addSongsToLibrary([updatedSong]);
                    }
                }}
            />

            <ConfirmationModal
                isOpen={!!confirmState}
                state={confirmState}
                onClose={() => setConfirmState(null)}
                onConfirm={async () => {
                    if (confirmState?.type === 'ARCHIVE_SONG' && confirmState.data?.song) {
                        const archivedSong = { ...confirmState.data.song, status: 'Archived' };
                        await handleUpdateSongWrapper(archivedSong);
                        setConfirmState(null);
                    } else if (confirmState?.type === 'DELETE_SONG' && confirmState.data?.id) {
                        await deleteSong(confirmState.data.id);
                        setConfirmState(null);
                    } else {
                        handleConfirmAction();
                    }
                }}
            />

            <DebugDashboard
                // ... props can remain same
                songs={songs}
                sets={sets}
                onClearAllSets={clearAllSets}
                bandId={profile?.band_id || null}
            />

            {/* ... other modals ... */}
            <PDFOptionsModal
                isOpen={showPDFOptions}
                onClose={() => setShowPDFOptions(false)}
                onGenerate={(opts) => generatePDFDoc(sets, gigDetails, opts, bandSettings).then(doc => doc.save('setlist.pdf'))}
            />

            <BandSettingsModal
                isOpen={showBandSettings}
                onClose={() => setShowBandSettings(false)}
                settings={bandSettings}
                onSave={handleSaveBandSettingsLogic}
                onApplyProfile={(s) => {/*...*/ }}
                onApplyGigDetails={handleUpdateGigDetailsLogic}
            />

            {showImport && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-[#121215]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] ring-1 ring-white/5">
                        {/* ... import modal content ... */}
                        <div className="p-4 border-b border-white/5 bg-zinc-900 flex justify-between">
                            <h3 className="font-semibold text-white flex items-center gap-2"><Icons.Download size={18} /> Import Songs</h3>
                            <button onClick={() => setShowImport(false)}><Icons.Close size={20} className="text-zinc-500" /></button>
                        </div>
                        <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300">
                                <strong>Format:</strong> Paste CSV or TSV data. First row should be headers.
                            </div>
                            <textarea
                                value={importText}
                                onChange={e => setImportText(e.target.value)}
                                placeholder="Paste CSV..."
                                className="w-full flex-1 min-h-[200px] bg-[#0c0c0e] border border-zinc-700 rounded-lg p-3 text-xs font-mono text-zinc-300"
                            />
                        </div>
                        <div className="p-4 border-t border-white/5 bg-zinc-900 flex justify-end gap-3">
                            <button onClick={() => setShowImport(false)} className="px-4 py-2 text-sm text-zinc-400">Cancel</button>
                            <button onClick={() => handleImportLogic('replace')} className="px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-md">Replace All</button>
                            <button onClick={() => handleImportLogic('add')} className="px-6 py-2 text-sm font-medium bg-primary text-white rounded-md">Add Songs</button>
                        </div>
                    </div>
                </div>
            )}

            <EditSongModal
                song={editingSong}
                isOpen={!!editingSong}
                onClose={() => setEditingSong(null)}
                onSave={(updatedSong) => {
                    const exists = songs.some(s => s.id === updatedSong.id);
                    if (exists) {
                        handleUpdateSongWrapper(updatedSong);
                    } else {
                        addSongsToLibrary([updatedSong]);
                    }
                }}
                existingSongs={songs}
                mode={editingSong && !songs.find(s => s.id === editingSong.id) ? 'add' : 'edit'}
            />
            <PDFOptionsModal isOpen={showPDFOptions} onClose={() => setShowPDFOptions(false)} onGenerate={(ops) => { generatePDFDoc(sets, gigDetails, ops, bandSettings); setShowPDFOptions(false); }} />
            <BandSettingsModal isOpen={showBandSettings} onClose={() => setShowBandSettings(false)} settings={bandSettings} onSave={handleSaveBandSettingsLogic} onApplyProfile={(u) => updateBandSettings({ ...bandSettings, ...u })} onApplyGigDetails={handleUpdateGigDetailsLogic} />

        </div>
    );
}