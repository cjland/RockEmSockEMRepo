
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
    closestCenter
} from '@dnd-kit/core';
import { horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable';

import { Song, SetList, GigDetails, PDFOptions, BandSettings } from './types'; // Removed SetSong as mostly internal or implicit
import { parseCSV, formatDuration, formatTime12Hour, generatePDFDoc, parseDurationToSeconds, parseBandProfileCSV, transformGoogleSheetUrl, parseGigDetailsCSV } from './utils';
import { SongLibrary } from './components/SongLibrary';
import { SetListColumn } from './components/SetListColumn';
import { Icons } from './components/ui/Icons';
import { useAuth } from './context/AuthContext';
import { useBand } from './hooks/useBand';
import { useSongs } from './hooks/useSongs';
import { useSets } from './hooks/useSets';
import { GigSelector } from './components/GigSelector';
import { SongManager } from './components/SongManager';
import { SongMetrics } from './components/SongMetrics';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useDebugLogger } from './hooks/useDebugLogger';
import { DebugDashboard } from './components/DebugDashboard';
import { EditGigModal } from './components/EditGigModal';
import { AuthPage } from './components/AuthPage';
import { ChangePasswordModal } from './components/ChangePasswordModal';

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

import { EditSongModal } from './components/EditSongModal';

// PDF Options Modal Component
const PDFOptionsModal = ({ isOpen, onClose, onGenerate }: { isOpen: boolean, onClose: () => void, onGenerate: (opts: PDFOptions) => void }) => {
    const [options, setOptions] = useState<PDFOptions>({
        includeNotes: true,
        oneSetPerPage: false,
        largeType: true,
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

                    {/* Moved to bottom as requested */}
                    <label className="flex items-center justify-between p-2 rounded hover:bg-zinc-800 cursor-pointer border-t border-white/5 pt-3 mt-2">
                        <span className="text-sm text-zinc-300">One Set Per Page</span>
                        <input type="checkbox" checked={options.oneSetPerPage} onChange={e => setOptions({ ...options, oneSetPerPage: e.target.checked })} className="rounded bg-zinc-700 text-primary" />
                    </label>
                </div>

                <div className="p-4 border-t border-white/5 bg-zinc-900">

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
// Band Settings Modal (Refactored)

const BandSettingsModal = ({ isOpen, onClose, settings, onSave, onApplyProfile, onApplyGigDetails }: { isOpen: boolean, onClose: () => void, settings: BandSettings, onSave: (s: BandSettings) => void, onApplyProfile: (u: Partial<BandSettings>) => void, onApplyGigDetails: (u: Partial<GigDetails>) => void }) => {
    const [localSettings, setLocalSettings] = React.useState<BandSettings>(settings);

    React.useEffect(() => {
        setLocalSettings(settings);
    }, [settings, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(localSettings);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[#121215] border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden ring-1 ring-white/5 flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-white/5 bg-zinc-900 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Icons.Settings size={20} className="text-primary" />
                        Band Settings
                    </h2>
                    <button onClick={onClose}><Icons.Close size={20} className="text-zinc-500 hover:text-white" /></button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                    {/* Identity Section */}
                    <section className="space-y-4">
                        <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider border-b border-white/5 pb-2">Identity</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">Band Name</label>
                                <input
                                    type="text"
                                    value={localSettings.name}
                                    onChange={e => setLocalSettings({ ...localSettings, name: e.target.value })}
                                    className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-sm text-white focus:border-primary outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">Website URL</label>
                                <input
                                    type="text"
                                    value={localSettings.website || ''}
                                    onChange={e => setLocalSettings({ ...localSettings, website: e.target.value })}
                                    className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-sm text-white focus:border-primary outline-none"
                                    placeholder="https://www.myband.com"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs text-zinc-400 mb-1">Logo URL</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={localSettings.logoUrl}
                                        onChange={e => setLocalSettings({ ...localSettings, logoUrl: e.target.value })}
                                        className="flex-1 bg-black/30 border border-zinc-700 rounded p-2 text-sm text-white focus:border-primary outline-none"
                                        placeholder="https://..."
                                    />
                                    {localSettings.logoUrl && (
                                        <div className="w-10 h-10 rounded bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                            <img src={localSettings.logoUrl} alt="Logo Preview" className="w-full h-full object-contain" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                <div className="p-4 border-t border-white/5 bg-zinc-900 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-white">Cancel</button>
                    <button onClick={handleSave} className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-md hover:bg-indigo-500 transition-colors shadow-lg shadow-primary/20">Save Settings</button>
                </div>
            </div>
        </div>
    );
};

// Generic Confirmation Modal
interface ConfirmationState {
    type: 'REMOVE_SET' | 'REPLACE_LIBRARY' | 'CLEAR_LIBRARY' | 'ARCHIVE_SONG' | 'DELETE_SONG' | 'DELETE_GIG' | 'ALERT';
    title: string;
    message: string;
    confirmLabel: string;
    confirmVariant?: 'danger' | 'primary' | 'neutral';
    requireTyping?: string;
    data?: any;
    hideCancel?: boolean;
}

const ConfirmationModal = ({ isOpen, state, onClose, onConfirm }: { isOpen: boolean, state: ConfirmationState | null, onClose: () => void, onConfirm: () => void }) => {
    const [inputValue, setInputValue] = React.useState('');

    React.useEffect(() => {
        if (isOpen) setInputValue('');
    }, [isOpen]);

    if (!isOpen || !state) return null;

    const isConfirmDisabled = state.requireTyping ? inputValue !== state.requireTyping : false;

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

                    {state.requireTyping && (
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
                                Type <span className="text-red-400 select-all">"{state.requireTyping}"</span> to confirm
                            </label>
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-sm text-white focus:border-red-500 outline-none"
                                placeholder={state.requireTyping}
                                autoFocus
                            />
                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        {!state.hideCancel && (
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm text-zinc-400 hover:text-white"
                            >
                                Cancel
                            </button>
                        )}

                        <button
                            onClick={() => { onConfirm(); onClose(); }}
                            disabled={isConfirmDisabled}
                            className={`px-4 py-2 rounded-md text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed 
                                ${state.confirmVariant === 'danger' ? 'bg-red-600 hover:bg-red-500' :
                                    state.confirmVariant === 'neutral' ? 'bg-zinc-700 hover:bg-zinc-600' :
                                        'bg-primary hover:bg-indigo-500'}`}
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
    if (!sets) return ids;
    sets.forEach(set => {
        if (set && set.songs) {
            set.songs.forEach(s => ids.add(s.id));
        }
    });
    return ids;
};


export default function App() {
    // Auth & Hooks
    const { user, activeBand, signOut, loading: authLoading } = useAuth();
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
        updateGig,
        deleteGig,
        refreshGigDetailsFromUrl,
        refreshBandData
    } = useBand(activeBand);

    // Dashboard Edit State
    const [dashboardEditGig, setDashboardEditGig] = useState<any>(null); // Type as any or Gig to avoid complex casts if types mismatch slightly

    const {
        songs,
        loading: songsLoading,
        upsertSongs,
        replaceLibrary,
        updateSong,
        deleteSong,
        clearLibrary
    } = useSongs(activeBand);

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
        clearAllSets,
        duplicateSet
    } = useSets(activeBand, currentGigId);

    // Dnd Sensors
    const sensors = useSensors(
        useSensor(SafePointerSensor)
    );

    // Local UI State
    const [activeDragItem, setActiveDragItem] = useState<{ type: string; data: any } | null>(null);
    const [view, setView] = useState<'GIG_SELECT' | 'APP' | 'SONG_MANAGER' | 'METRICS'>('GIG_SELECT');
    const [showImport, setShowImport] = useState(false);
    const [importText, setImportText] = useState('');
    const [showGigDetails, setShowGigDetails] = useState(false);
    const [showBandSettings, setShowBandSettings] = useState(false);
    const [showEditingGig, setShowEditingGig] = useState(false); // Add this line
    const [showPDFOptions, setShowPDFOptions] = useState(false);
    const [showChangePassword, setShowChangePassword] = useState(false);

    // View Options State
    const [viewOptions, setViewOptions] = useState({
        showLibraryRatings: true,
        showLibraryLiveBadges: true,
        showSetRatings: true,
        showSetLiveBadges: true
    });
    const [showViewOptions, setShowViewOptions] = useState(false);

    const [editingSong, setEditingSong] = useState<Song | null>(null);
    const [confirmState, setConfirmState] = useState<ConfirmationState | null>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    // Effect to switch view if currentGigId changes (e.g. from sign in with existing state)
    // REMOVED: navigation is now explicit to prevent valid views (like SongManager) from being overridden.
    /*
    const prevGigId = React.useRef(currentGigId);
    useEffect(() => {
        if (currentGigId) {
            setView('APP');
        } else if (prevGigId.current) {
            // Only switch to GIG_SELECT if we just exited a gig (prev was set, now null)
            setView('GIG_SELECT');
        }
        prevGigId.current = currentGigId;
    }, [currentGigId]);
    */

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

    const handleImportSampleData = async (type: 'MINI' | 'FULL') => {
        const { SAMPLE_SONGS_MINI, SAMPLE_SONGS_FULL } = await import('./data/sampleData');
        const data = type === 'MINI' ? SAMPLE_SONGS_MINI : SAMPLE_SONGS_FULL;

        // Add current date to all
        const datedData = data.map(s => ({
            ...s,
            dateAdded: new Date().toISOString()
        }));

        await upsertSongs(datedData as Song[]);

        setConfirmState({
            type: 'ALERT',
            title: 'Import Successful',
            message: `Successfully imported ${datedData.length} sample songs!`,
            confirmLabel: 'Great',
            confirmVariant: 'primary',
            hideCancel: true
        });
    };

    const handleImportLogic = async (mode: 'add' | 'replace') => {
        const newSongs = parseCSV(importText);
        if (newSongs.length === 0) {

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
            await upsertSongs(newSongs);
            // NEW: Automatically add imported songs to the first set if available
            // Note: For upsert, this might add existing songs again to the set if logic allows duplicates.
            // But user requested Upsert DATA, not necessarily add to set.
            // Keeping for new songs behavior, but ideally should check if new.
            // For now, let's keep it but maybe we should only add if they are NEWLY created?
            // Parsing doesn't tell us.
            // Let's keep existing behavior for now.
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
            setConfirmState({
                type: 'ALERT',
                title: 'No Sets',
                message: "No sets available. Create a set first.",
                confirmLabel: 'OK',
                confirmVariant: 'neutral',
                hideCancel: true
            });
        }
    };




    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveDragItem({ type: active.data.current?.type, data: active.data.current?.data });
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        // console.log("Drag End:", { active: active.data.current, over: over?.data.current, overId: over?.id });
        setActiveDragItem(null);
        if (!over) return;

        // 1. Column Reorder
        if (active.data.current?.type === 'SET_COLUMN') {
            const activeSetId = active.id;
            let overSetId = over.id;

            // Resolve overSetId if we dropped on the inner droppable or a song
            if (over.data.current?.type === 'SET' || over.data.current?.type === 'SET_SONG') {
                // Try to get from data first (if we added it), or infer
                // We will add 'setId' to the droppable data in SetListColumn
                overSetId = over.data.current.setId || over.data.current.originSetId;
            }

            if (overSetId && activeSetId !== overSetId) {
                const oldIndex = sets.findIndex(s => s.id === activeSetId);
                const newIndex = sets.findIndex(s => s.id === overSetId);

                if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                    reorderSets(oldIndex, newIndex);
                }
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
                // Check data.setId for 'SET', or id for 'SET_COLUMN'
                targetSetId = over.data.current.setId || over.id;
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
                targetSetId = over.data.current.setId || over.id;
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
        return <AuthPage />;
    }

    const renderContent = () => {
        if (view === 'METRICS') {
            return (
                <SongMetrics
                    activeBand={{ id: activeBand.id, name: bandSettings.name }}
                    onBack={() => setView('SONG_MANAGER')}
                />
            );
        }

        if (view === 'SONG_MANAGER') {
            return (
                <ErrorBoundary name="SongManager">
                    <SongManager
                        key={songs?.length || 0} // Force re-render on count change
                        songs={songs || []}
                        usedSongIds={getUsedSongIds(sets || [])}
                        onBack={() => {
                            console.log('[App] SongManager onBack clicked. Current Gig ID:', currentGigId);
                            if (currentGigId) {
                                setView('APP');
                            } else {
                                setView('GIG_SELECT');
                            }
                        }}
                        onAddSong={() => {
                            setEditingSong({ id: crypto.randomUUID(), title: '', artist: '', durationSeconds: 0, practiceStatus: 'Ready', status: 'Active' } as Song);
                        }}
                        onUpdateSong={(song) => setEditingSong(song)}
                        onDeleteSong={(id) => {
                            const song = songs.find(s => s.id === id);
                            if (song) {
                                const isUsed = getUsedSongIds(sets || []).has(id);
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
                        onViewMetrics={() => setView('METRICS')}
                        onClearLibrary={() => {
                            setConfirmState({
                                type: 'CLEAR_LIBRARY',
                                title: 'Wipe Song Library?',
                                message: 'WARNING: This will permanently delete ALL songs in your library. This action cannot be undone. All songs will be removed from all setlists.',
                                confirmLabel: 'Wipe Everything',
                                confirmVariant: 'danger',
                                requireTyping: 'PROCEED'
                            });
                        }}
                    />
                </ErrorBoundary>
            );
        }

        if (view === 'GIG_SELECT') {
            return (
                <GigSelector
                    gigs={gigs}
                    onCreateGig={createGig}
                    onSelectGig={(id) => {
                        const success = selectGig(id);
                        if (id && success) {
                            setView('APP');
                        } else if (id) {
                            console.error('[App] Failed to select gig. View not changed.');
                            // Optional: Show toast/alert
                        }
                    }}
                    onManageSongs={() => setView('SONG_MANAGER')}
                    onSignOut={signOut}
                    onChangePassword={() => setShowChangePassword(true)}
                    onBandSettings={(() => setShowBandSettings(true))}
                    onEditGig={(gig) => setDashboardEditGig(gig)}
                    onDeleteGig={(gig) => {
                        setConfirmState({
                            type: 'DELETE_GIG',
                            title: 'Delete Gig?',
                            message: `Are you sure you want to delete "${gig.name}"? This will permanently remove the gig and all its associated setlists. This action cannot be undone.`,
                            confirmLabel: 'Delete Gig',
                            confirmVariant: 'danger',
                            requireTyping: 'CONFIRM',
                            data: { gig }
                        });
                    }}
                    userEmail={user?.email}
                    logoUrl={bandSettings.logoUrl}
                    bandName={bandSettings.name}
                    bandId={activeBand?.band_id}
                    totalSongs={songs.length}
                    onImportSampleData={handleImportSampleData}
                />
            );
        }

        return (
            <div className="flex flex-col h-screen bg-[#09090b] text-zinc-100 font-sans overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#09090b] to-[#09090b]">
                {/* Header */}
                <header className="h-[60px] bg-black/40 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 shrink-0 z-40 sticky top-0 custom-glass">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => {
                                console.log('[App] Back to Dashboard clicked');
                                try {
                                    refreshBandData(); // Refresh dashboard data when returning
                                } catch (e) {
                                    console.error('[App] refreshBandData failed', e);
                                }
                                selectGig(null); // Clear gig selection
                                setView('GIG_SELECT'); // Explicitly switch view
                            }}
                            className="p-2 -ml-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-full transition-colors group"
                            title="Back to Gig Selection"
                        >
                            <Icons.ArrowLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
                        </button>

                        {/* Set Manager Title */}
                        <div className="hidden md:flex items-center">
                            <span className="font-black text-xl tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mr-2 select-none">
                                SET MANAGER
                            </span>
                            <div className="h-6 w-px bg-white/10 mx-2"></div>
                        </div>

                        <div className="flex flex-col max-w-[600px]">
                            {/* Line 1: Gig Name | Date | Arrive | Start */}
                            <div className="flex items-center gap-2 flex-wrap text-sm">
                                <h1 className="font-bold text-white transition-colors whitespace-nowrap">{gigDetails.name}</h1>

                                <span className="text-zinc-600">|</span>
                                <span className="text-zinc-300">
                                    {new Date(gigDetails.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                                </span>

                                {(gigDetails.arriveTime || gigDetails.startTime) && (
                                    <>
                                        <span className="text-zinc-600">|</span>
                                        <div className="flex items-center gap-2 text-indigo-400 font-mono">
                                            {gigDetails.arriveTime && <span><span className="text-zinc-500 mr-1 hidden sm:inline">Arrive:</span>{formatTime12Hour(gigDetails.arriveTime)}</span>}
                                            {gigDetails.arriveTime && gigDetails.startTime && <span className="text-zinc-600">•</span>}
                                            {gigDetails.startTime && <span><span className="text-zinc-500 mr-1 hidden sm:inline">Start:</span>{formatTime12Hour(gigDetails.startTime)}</span>}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Line 2: Notes & Location */}
                            <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                                {gigDetails.notes ? (
                                    <span className="text-zinc-400 italic">"{gigDetails.notes}"</span>
                                ) : (
                                    <span className="opacity-50 italic">No notes</span>
                                )}
                                {gigDetails.location && (
                                    <>
                                        <span className="text-zinc-700">•</span>
                                        <span className="text-zinc-500 flex items-center gap-1">
                                            {gigDetails.location}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* View Options Toggle */}
                        <div className="relative">
                            <button
                                onClick={() => setShowViewOptions(!showViewOptions)}
                                className={`p-2 rounded-md transition-all shadow-lg border ${showViewOptions ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50' : 'text-zinc-400 hover:text-white hover:bg-white/5 border-transparent hover:border-white/10'}`}
                                title="View Options"
                            >
                                <Icons.Eye size={18} />
                            </button>

                            {/* Dropdown */}
                            {showViewOptions && (
                                <div className="absolute top-full right-0 mt-2 w-56 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl p-2 z-50 animate-fade-in ring-1 ring-black/50">
                                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-2 py-1 mb-1">Library View</h4>
                                    <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={viewOptions.showLibraryRatings}
                                            onChange={(e) => setViewOptions(prev => ({ ...prev, showLibraryRatings: e.target.checked }))}
                                            className="accent-primary"
                                        />
                                        <span className="text-xs text-zinc-300 group-hover:text-white">Show Ratings</span>
                                    </label>
                                    <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded cursor-pointer group mb-2">
                                        <input
                                            type="checkbox"
                                            checked={viewOptions.showLibraryLiveBadges}
                                            onChange={(e) => setViewOptions(prev => ({ ...prev, showLibraryLiveBadges: e.target.checked }))}
                                            className="accent-primary"
                                        />
                                        <span className="text-xs text-zinc-300 group-hover:text-white">Show Live Badges</span>
                                    </label>

                                    <div className="h-px bg-white/5 my-1"></div>

                                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-2 py-1 mb-1">Set List View</h4>
                                    <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={viewOptions.showSetRatings}
                                            onChange={(e) => setViewOptions(prev => ({ ...prev, showSetRatings: e.target.checked }))}
                                            className="accent-primary"
                                        />
                                        <span className="text-xs text-zinc-300 group-hover:text-white">Show Ratings</span>
                                    </label>
                                    <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={viewOptions.showSetLiveBadges}
                                            onChange={(e) => setViewOptions(prev => ({ ...prev, showSetLiveBadges: e.target.checked }))}
                                            className="accent-primary"
                                        />
                                        <span className="text-xs text-zinc-300 group-hover:text-white">Show Live Badges</span>
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* Desktop Profile */}
                        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/50 border border-white/5">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[8px] font-bold text-white">
                                {user.email?.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[10px] text-zinc-400 max-w-[100px] truncate">{user.email}</span>
                        </div>

                        {/* Edit Gig Details Button */}
                        <button
                            onClick={() => setShowEditingGig(true)}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-md transition-all shadow-lg border border-transparent hover:border-white/10"
                            title="Edit Gig Details"
                        >
                            <Icons.Settings size={18} />
                        </button>

                        {view !== 'APP' && (
                            <button
                                onClick={() => setShowChangePassword(true)}
                                className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-md transition-all shadow-lg border border-transparent hover:border-white/10"
                                title="Change Password"
                            >
                                <Icons.Key size={18} />
                            </button>
                        )}

                        <button onClick={() => setShowPDFOptions(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-white hover:bg-indigo-500 transition-all shadow-lg shadow-primary/20">
                            <Icons.Download size={16} /> Export PDF
                        </button>
                    </div>
                </header>

                {/* Main Content */}
                <div className="flex flex-1 overflow-hidden">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        dropAnimation={dropAnimation}
                    >
                        <ErrorBoundary name="SongLibrary">
                            <SongLibrary
                                songs={songs.filter(s => s.status !== 'Archived')} // Filter out archived songs
                                sets={sets}
                                usedInSetsMap={usedInSetsMap}
                                onPlaySong={(song) => window.open(song.videoUrl, '_blank')}
                                onUpdateSong={handleUpdateSongWrapper}
                                onEditSong={(song) => setEditingSong(song)}
                                onManageSongs={() => setView('SONG_MANAGER')}
                                onAddToSet={(song, targetSetId) => {
                                    if (targetSetId) {
                                        // Explicit set target
                                        addSongToSet(targetSetId, song);
                                    } else if (sets.length > 0) {
                                        // Default to first set if no target specified
                                        addSongToSet(sets[0].id, song);
                                    } else {
                                        setConfirmState({
                                            type: 'ALERT',
                                            title: 'No Sets',
                                            message: "Please create a set first!",
                                            confirmLabel: 'OK',
                                            confirmVariant: 'neutral',
                                            hideCancel: true
                                        });
                                    }
                                }}
                                viewOptions={{
                                    showRatings: viewOptions.showLibraryRatings,
                                    showLiveBadges: viewOptions.showLibraryLiveBadges
                                }}
                            />
                        </ErrorBoundary>
                        <div className="flex-1 flex flex-col bg-[#0c0c0e] relative overflow-hidden">
                            <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 custom-scrollbar w-full">
                                <SortableContext items={sets.map(s => s.id)} strategy={horizontalListSortingStrategy}>
                                    <div className="flex gap-6 h-full w-max pb-4">
                                        {sets.length === 0 && (
                                            <div className="flex flex-col items-center justify-center w-[320px] h-[400px] border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/10 text-center p-6 animate-fade-in">
                                                <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
                                                    <Icons.List size={32} className="text-zinc-600" />
                                                </div>
                                                <h3 className="text-xl font-bold text-zinc-300 mb-2">Build Your Setlist</h3>
                                                <p className="text-sm text-zinc-500 mb-6 max-w-[200px]">
                                                    Create your first set to start organizing songs for this gig.
                                                </p>
                                                <button
                                                    onClick={() => {
                                                        console.log('[App] Create Set 1 clicked');
                                                        addSet();
                                                    }}
                                                    className="px-6 py-2 bg-primary text-white rounded-lg font-bold hover:bg-indigo-500 transition-all shadow-lg hover:shadow-primary/20 flex items-center gap-2"
                                                >
                                                    <Icons.Plus size={18} />
                                                    Create Set 1
                                                </button>
                                            </div>
                                        )}
                                        {sets.map((set, i) => (
                                            <SetListColumn
                                                key={set.id}
                                                setList={set}
                                                setIndex={i}
                                                totalSets={sets.length}
                                                bandMembers={bandSettings.members}
                                                duplicateSongIds={duplicateSongIds}
                                                onRemoveSet={requestRemoveSetWrapper}
                                                onDuplicateSet={duplicateSet}
                                                onRemoveSong={(setId, songId) => removeSongFromSet(setId, songId)}
                                                onUpdateNote={(setId, songId, note) => updateSongNote(setId, songId, note)}
                                                onPlaySong={(song) => song.videoUrl ? window.open(song.videoUrl, '_blank') : alert("No Video URL")}
                                                onUpdateSetDetails={updateSetDetails}
                                                onEditSong={setEditingSong}
                                                viewOptions={{
                                                    showRatings: viewOptions.showSetRatings,
                                                    showLiveBadges: viewOptions.showSetLiveBadges
                                                }}
                                            />
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
                        upsertSongs([updatedSong]);
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
                    } else if (confirmState?.type === 'DELETE_GIG' && confirmState.data?.gig) {
                        await deleteGig(confirmState.data.gig.id);
                        setConfirmState(null);
                    } else if (confirmState?.type === 'CLEAR_LIBRARY') {
                        await clearLibrary();
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
                bandId={activeBand?.band_id || null}
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

            <ChangePasswordModal
                isOpen={showChangePassword}
                onClose={() => setShowChangePassword(false)}
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
                        upsertSongs([updatedSong]);
                    }
                }}
                existingSongs={songs}
                mode={editingSong && !songs.find(s => s.id === editingSong.id) ? 'add' : 'edit'}
                bandId={activeBand?.band_id}
            />


            <EditGigModal
                isOpen={showEditingGig}
                onClose={() => setShowEditingGig(false)}
                gigDetails={gigDetails}
                onSave={async (details) => {
                    await updateGigDetails(details);
                    setShowEditingGig(false);
                }}
            />

            {/* Dashboard Edit Gig Modal */}
            <EditGigModal
                isOpen={!!dashboardEditGig}
                onClose={() => setDashboardEditGig(null)}
                gigDetails={dashboardEditGig ? {
                    ...dashboardEditGig,
                    startTime: dashboardEditGig.settings?.startTime,
                    arriveTime: dashboardEditGig.settings?.arriveTime,
                    notes: dashboardEditGig.settings?.notes,
                    settings: dashboardEditGig.settings
                } : {} as any}
                onSave={async (details) => {
                    if (dashboardEditGig) {
                        await updateGig(dashboardEditGig.id, details);
                        setDashboardEditGig(null);
                    }
                }}
            />

            <BandSettingsModal isOpen={showBandSettings} onClose={() => setShowBandSettings(false)} settings={bandSettings} onSave={handleSaveBandSettingsLogic} onApplyProfile={(u) => updateBandSettings({ ...bandSettings, ...u })} onApplyGigDetails={handleUpdateGigDetailsLogic} />

        </div>
    );
}