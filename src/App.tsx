import React, { useState, useEffect, useMemo } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  useSensor, 
  useSensors, 
  PointerSensor, 
  DragStartEvent, 
  DragEndEvent, 
  DragOverEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
  closestCorners
} from '@dnd-kit/core';
import { arrayMove, horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable';
import { v4 as uuidv4 } from 'uuid';

import { Song, SetList, SetSong, GigDetails, PDFOptions, BandSettings } from './types';
import { MOCK_SONGS, parseCSV, formatDuration, generatePDFDoc, generateTimeOptions, parseDurationToSeconds, parseBandProfileCSV, transformGoogleSheetUrl, parseGigDetailsCSV } from './utils';
import { SongLibrary } from './components/SongLibrary';
import { SetListColumn } from './components/SetListColumn';
import { Icons } from './components/ui/Icons';

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
const EditSongModal = ({ song, isOpen, onClose, onSave }: { song: Song | null, isOpen: boolean, onClose: () => void, onSave: (s: Song) => void }) => {
    const [formData, setFormData] = React.useState<Song | null>(null);
    const [durationStr, setDurationStr] = React.useState('');

    React.useEffect(() => {
        if (song) {
            setFormData({ ...song });
            setDurationStr(formatDuration(song.durationSeconds));
        }
    }, [song]);

    if (!isOpen || !formData) return null;

    const handleSave = () => {
        if (formData) {
            onSave({
                ...formData,
                durationSeconds: parseDurationToSeconds(durationStr)
            });
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#121215] border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b border-white/5 bg-zinc-900 sticky top-0 z-10">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                        <Icons.Edit size={16} className="text-primary"/>
                        Edit Song Details
                    </h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white"><Icons.Close size={20}/></button>
                </div>
                
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Basic Info</h4>
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Song Title</label>
                            <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-sm text-white focus:border-primary outline-none" />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Artist</label>
                            <input type="text" value={formData.artist} onChange={e => setFormData({...formData, artist: e.target.value})} className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-sm text-white focus:border-primary outline-none" />
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="text-xs text-zinc-400 block mb-1">Duration (m:s)</label>
                                <input type="text" value={durationStr} onChange={e => setDurationStr(e.target.value)} className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-sm text-white focus:border-primary outline-none font-mono" />
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

                            {/* Status State */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-zinc-300">Song Status</span>
                                <div className="flex bg-zinc-800 rounded-lg p-0.5">
                                    <button 
                                        onClick={() => setFormData({...formData, practiceStatus: 'Practice', playedLive: false})}
                                        className={`px-3 py-1 text-xs rounded-md transition-all ${formData.practiceStatus === 'Practice' ? 'bg-zinc-600 text-white' : 'text-zinc-500'}`}
                                    >Practice</button>
                                    <button 
                                        onClick={() => setFormData({...formData, practiceStatus: 'Ready'})}
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
                                {[1,2,3,4,5].map(star => (
                                    <button key={star} onClick={() => setFormData({...formData, rating: star})} className={`text-xl ${star <= (formData.rating || 0) ? 'text-yellow-500' : 'text-zinc-700'}`}>★</button>
                                ))}
                            </div>
                        </div>
                        
                        <div>
                             <label className="text-xs text-zinc-400 block mb-1">General Notes</label>
                             <textarea 
                                rows={4}
                                value={formData.generalNotes || ''} 
                                onChange={e => setFormData({...formData, generalNotes: e.target.value})} 
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
                                <label className="text-xs text-zinc-400 block mb-1 flex items-center gap-1"><Icons.Youtube size={12}/> Video URL</label>
                                <input type="text" value={formData.videoUrl || ''} onChange={e => setFormData({...formData, videoUrl: e.target.value})} className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-xs text-zinc-300 focus:border-primary outline-none" placeholder="https://youtube.com/..." />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1 flex items-center gap-1"><Icons.Link size={12}/> Lyrics URL</label>
                                <input type="text" value={formData.lyricsUrl || ''} onChange={e => setFormData({...formData, lyricsUrl: e.target.value})} className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-xs text-zinc-300 focus:border-primary outline-none" placeholder="https://..." />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1 flex items-center gap-1"><Icons.Guitar size={12}/> Guitar Lesson</label>
                                <input type="text" value={formData.guitarLessonUrl || ''} onChange={e => setFormData({...formData,guitarLessonUrl: e.target.value})} className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-xs text-zinc-300 focus:border-primary outline-none" placeholder="https://youtube.com/..." />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1 flex items-center gap-1"><Icons.Music size={12}/> Bass Lesson</label>
                                <input type="text" value={formData.bassLessonUrl || ''} onChange={e => setFormData({...formData, bassLessonUrl: e.target.value})} className="w-full bg-black/30 border border-zinc-700 rounded p-2 text-xs text-zinc-300 focus:border-primary outline-none" placeholder="https://youtube.com/..." />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-white/5 flex justify-end gap-2 bg-zinc-900 sticky bottom-0">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">Cancel</button>
                    <button onClick={handleSave} className="px-6 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-indigo-500 transition-colors shadow-lg shadow-primary/20">Save Changes</button>
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
             <div className="bg-surface border border-white/10 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="p-4 border-b border-white/5 bg-zinc-900 flex justify-between">
                    <h3 className="font-semibold text-white">Print Settings</h3>
                    <button onClick={onClose}><Icons.Close size={20} className="text-zinc-500"/></button>
                </div>
                <div className="p-4 space-y-3">
                    <label className="flex items-center justify-between p-2 rounded hover:bg-zinc-800 cursor-pointer">
                        <span className="text-sm text-zinc-300">Include Notes</span>
                        <input type="checkbox" checked={options.includeNotes} onChange={e => setOptions({...options, includeNotes: e.target.checked})} className="rounded bg-zinc-700 text-primary" />
                    </label>
                    <label className="flex items-center justify-between p-2 rounded hover:bg-zinc-800 cursor-pointer">
                        <span className="text-sm text-zinc-300">One Set Per Page</span>
                        <input type="checkbox" checked={options.oneSetPerPage} onChange={e => setOptions({...options, oneSetPerPage: e.target.checked})} className="rounded bg-zinc-700 text-primary" />
                    </label>
                    <label className="flex items-center justify-between p-2 rounded hover:bg-zinc-800 cursor-pointer">
                        <span className="text-sm text-zinc-300">Extra Large Type</span>
                        <input type="checkbox" checked={options.largeType} onChange={e => setOptions({...options, largeType: e.target.checked})} className="rounded bg-zinc-700 text-primary" />
                    </label>
                    <label className="flex items-center justify-between p-2 rounded hover:bg-zinc-800 cursor-pointer">
                        <span className="text-sm text-zinc-300">Include Band Logo</span>
                        <input type="checkbox" checked={options.includeLogo} onChange={e => setOptions({...options, includeLogo: e.target.checked})} className="rounded bg-zinc-700 text-primary" />
                    </label>
                    <label className="flex items-center justify-between p-2 rounded hover:bg-zinc-800 cursor-pointer">
                        <span className="text-sm text-zinc-300">Include Venue/Time</span>
                        <input type="checkbox" checked={options.includeGigInfo} onChange={e => setOptions({...options, includeGigInfo: e.target.checked})} className="rounded bg-zinc-700 text-primary" />
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
    const [status, setStatus] = useState<{msg: string, isError: boolean} | null>(null);
    const [gigStatus, setGigStatus] = useState<{msg: string, isError: boolean} | null>(null);
    
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
             <div className="bg-surface border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-4 border-b border-white/5 bg-zinc-900 flex justify-between items-center">
                    <h3 className="font-semibold text-white flex items-center gap-2"><Icons.Globe size={16}/> Global Band Settings</h3>
                    <button onClick={onClose}><Icons.Close size={20} className="text-zinc-500"/></button>
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
                                onChange={e => setData({...data, bandProfileUrl: e.target.value})}
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
                                onChange={e => setData({...data, name: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">Band Logo URL</label>
                            <div className="flex gap-2">
                                 <input 
                                    type="text" 
                                    className="flex-1 bg-background border border-zinc-700 rounded p-2 text-sm text-white focus:border-primary outline-none"
                                    value={data.logoUrl}
                                    onChange={e => setData({...data, logoUrl: e.target.value})}
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
                            onChange={e => setData({...data, defaultLibraryUrl: e.target.value})}
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
                                onChange={e => setData({...data, gigDetailsUrl: e.target.value})}
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
    type: 'REMOVE_SET' | 'REPLACE_LIBRARY' | 'CLEAR_LIBRARY';
    title: string;
    message: string;
    confirmLabel: string;
    confirmVariant?: 'danger' | 'primary';
    data?: any;
}

const ConfirmationModal = ({ isOpen, state, onClose, onConfirm }: { isOpen: boolean, state: ConfirmationState | null, onClose: () => void, onConfirm: () => void }) => {
    if (!isOpen || !state) return null;
    
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-surface border border-white/10 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
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

const DEFAULT_LIBRARY_URL = 'https://docs.google.com/spreadsheets/d/1m8sg7CRO4-ZpYp4UYatVHak7lqgRpRydc9pKGz9t7DY/edit?usp=sharing';
const DEFAULT_PROFILE_URL = 'https://docs.google.com/spreadsheets/d/1m8sg7CRO4-ZpYp4UYatVHak7lqgRpRydc9pKGz9t7DY/edit?gid=1234320810';
const DEFAULT_GIG_DETAILS_URL = 'https://docs.google.com/spreadsheets/d/1m8sg7CRO4-ZpYp4UYatVHak7lqgRpRydc9pKGz9t7DY/edit?gid=1936545164';

export default function App() {
  // State
  const [songs, setSongs] = useState<Song[]>(MOCK_SONGS);
  const [sets, setSets] = useState<SetList[]>([
    { id: 'set-1', name: 'Set 1', songs: [], status: 'Draft' },
  ]);
  const [gigDetails, setGigDetails] = useState<GigDetails>({
    name: '',
    location: '',
    date: '',
    startTime: '20:00',
    arriveTime: '18:00',
    notes: '' // Initialize notes
  });
  const [bandSettings, setBandSettings] = useState<BandSettings>({
      name: 'My Band',
      logoUrl: '',
      members: ['Drummer', 'Bassist', 'Guitarist', 'Singer'],
      defaultLibraryUrl: DEFAULT_LIBRARY_URL,
      bandProfileUrl: DEFAULT_PROFILE_URL,
      gigDetailsUrl: DEFAULT_GIG_DETAILS_URL
  });
  
  const [activeDragItem, setActiveDragItem] = useState<any>(null);
  const [showImport, setShowImport] = useState(false);
  const [showGigDetails, setShowGigDetails] = useState(false);
  const [showBandSettings, setShowBandSettings] = useState(false);
  const [showPDFOptions, setShowPDFOptions] = useState(false);
  const [importText, setImportText] = useState('');
  
  // Edit Song State (Moved from SongLibrary)
  const [editingSong, setEditingSong] = useState<Song | null>(null);

  // Unified Confirmation State
  const [confirmState, setConfirmState] = useState<ConfirmationState | null>(null);

  // Save State
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  // Load from static file, local storage, or bootstrap
  useEffect(() => {
    const bootstrap = async () => {
         // 1. Fetch Band Profile
         const profileUrl = transformGoogleSheetUrl(DEFAULT_PROFILE_URL);
         try {
             const res = await fetch(profileUrl);
             if (res.ok) {
                 const text = await res.text();
                 const profile = parseBandProfileCSV(text);
                 if (Object.keys(profile).length > 0) {
                     setBandSettings(prev => ({...prev, ...profile}));
                 }
             }
         } catch(e) { console.error("Bootstrap profile failed", e); }

         // 2. Fetch Default Library
         const libUrl = transformGoogleSheetUrl(DEFAULT_LIBRARY_URL);
         try {
             const res = await fetch(libUrl);
             if (res.ok) {
                 const text = await res.text();
                 const newSongs = parseCSV(text);
                 if (newSongs.length > 0) {
                     setSongs(newSongs);
                 }
             }
         } catch(e) { console.error("Bootstrap library failed", e); }

         // 3. Fetch Gig Details
         const gigUrl = transformGoogleSheetUrl(DEFAULT_GIG_DETAILS_URL);
         try {
             const res = await fetch(gigUrl);
             if (res.ok) {
                 const text = await res.text();
                 const details = parseGigDetailsCSV(text);
                 if (Object.keys(details).length > 0) {
                     setGigDetails(prev => ({...prev, ...details}));
                 }
             }
         } catch(e) { console.error("Bootstrap gig details failed", e); }
    };

    const loadData = async () => {
        // 1. Try Shared Static File (setlist.json)
        try {
            const res = await fetch('./setlist.json?nocache=' + Date.now());
            if (res.ok) {
                const data = await res.json();
                if (data.sets) setSets(data.sets);
                if (data.songs) setSongs(data.songs);
                if (data.gigDetails) setGigDetails(data.gigDetails);
                if (data.bandSettings) setBandSettings(data.bandSettings);
                return; // Prioritize file if found
            }
        } catch(e) {
            // Ignore error, file might not exist yet
        }

        // 2. Try Local Storage
        const saved = localStorage.getItem('setlist-flow-data');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.sets) setSets(parsed.sets);
                if (parsed.songs) setSongs(parsed.songs);
                if (parsed.gigDetails) setGigDetails(parsed.gigDetails);
                if (parsed.bandSettings) setBandSettings(parsed.bandSettings);
                return;
            } catch (e) {
                console.error("Failed to load saved data");
            }
        } 

        // 3. Fallback to Bootstrap logic
        bootstrap();
    };

    loadData();
  }, []);

  // Compute used map and duplicate songs
  const { usedInSetsMap, duplicateSongIds } = useMemo(() => {
    // Map stores array of { name, index }
    const map: Record<string, {name: string, index: number}[]> = {};
    const counts: Record<string, number> = {};
    const dupes: string[] = [];

    sets.forEach((set, setIndex) => {
        set.songs.forEach(song => {
            if (!map[song.id]) map[song.id] = [];
            
            // Check if this set is already recorded for this song
            const exists = map[song.id].some(item => item.name === set.name && item.index === setIndex);
            
            if (!exists) {
                map[song.id].push({ name: set.name, index: setIndex });
            }

            counts[song.id] = (counts[song.id] || 0) + 1;
        });
    });

    Object.keys(counts).forEach(id => {
        if (counts[id] > 1) dupes.push(id);
    });

    return { usedInSetsMap: map, duplicateSongIds: dupes };
  }, [sets]);

  const sensors = useSensors(
    useSensor(SafePointerSensor, {
      activationConstraint: {
        distance: 8, 
      },
    })
  );

  const timeOptions = useMemo(() => generateTimeOptions(), []);

  // --- Actions ---

  const saveData = () => {
    const data = {
        sets,
        songs,
        gigDetails,
        bandSettings
    };
    
    // 1. Save to Local Storage (Backup)
    localStorage.setItem('setlist-flow-data', JSON.stringify(data));

    // 2. Download as File (Shared Source of Truth)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'setlist.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSaveStatus('saved');
    setTimeout(() => {
        setSaveStatus('idle');
    }, 2000);
  };

  const handleGeneratePDF = (options: PDFOptions) => {
      generatePDFDoc(sets, gigDetails, options, bandSettings);
      setShowPDFOptions(false);
  };

  const playSong = (song: Song) => {
      if (song.videoUrl) {
          window.open(song.videoUrl, '_blank');
      } else {
          alert('No valid YouTube URL found for this song.');
      }
  };
  
  const handleUpdateSong = (updatedSong: Song) => {
      setSongs(songs.map(s => s.id === updatedSong.id ? updatedSong : s));
      
      setSets(sets.map(set => ({
          ...set,
          songs: set.songs.map(s => {
              if (s.id === updatedSong.id) {
                  return {
                      ...s,
                      title: updatedSong.title,
                      artist: updatedSong.artist,
                      durationSeconds: updatedSong.durationSeconds,
                      videoUrl: updatedSong.videoUrl,
                      // Sync other meta if needed
                      rating: updatedSong.rating,
                      playedLive: updatedSong.playedLive,
                      generalNotes: updatedSong.generalNotes,
                      practiceStatus: updatedSong.practiceStatus
                  };
              }
              return s;
          })
      })));
  };

  const addSet = () => {
    if (sets.length >= 5) return;
    const newId = `set-${Date.now()}`;
    setSets([...sets, { id: newId, name: `Set ${sets.length + 1}`, songs: [], status: 'Draft' }]);
  };

  const requestRemoveSet = (id: string) => {
    const setToRemove = sets.find(s => s.id === id);
    if (!setToRemove) return;

    const count = setToRemove.songs.length;

    if (count > 0) {
        setConfirmState({
            type: 'REMOVE_SET',
            title: 'Remove Set',
            message: `Are you sure you want to remove "${setToRemove.name}"? ${count} song${count === 1 ? '' : 's'} will be removed from this set but remain in your library.`,
            confirmLabel: 'Remove Set',
            confirmVariant: 'danger',
            data: { id }
        });
    } else {
        // no songs: remove immediately
        setSets(prev => prev.filter(s => s.id !== id));
    }
  };

  const removeSongFromSet = (setId: string, songInstanceId: string) => {
    setSets(sets.map(set => {
      if (set.id !== setId) return set;
      return { ...set, songs: set.songs.filter(s => s.instanceId !== songInstanceId) };
    }));
  };

  const updateSongNote = (setId: string, songInstanceId: string, note: string) => {
    setSets(sets.map(set => {
        if (set.id !== setId) return set;
        return {
            ...set,
            songs: set.songs.map(s => s.instanceId === songInstanceId ? { ...s, notes: note } : s)
        };
    }));
  };

  const updateSetDetails = (setId: string, updates: Partial<SetList>) => {
      setSets(sets.map(s => s.id === setId ? { ...s, ...updates } : s));
  };

  const handleFetchFromUrl = async () => {
        if (!bandSettings.defaultLibraryUrl) return;
        
        // Use the robust utility
        const url = transformGoogleSheetUrl(bandSettings.defaultLibraryUrl);

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('Network response was not ok');
            const text = await res.text();
            setImportText(text);
        } catch (error) {
            console.error("Failed to fetch library", error);
            alert("Failed to load library from URL. Ensure the Google Sheet is 'Anyone with the link' accessible.");
        }
  };

  const handleImport = (mode: 'add' | 'replace') => {
    const newSongs = parseCSV(importText);
    
    if (newSongs.length === 0) {
        alert("No valid songs found in the pasted text. Please check the format.");
        return;
    }

    if (mode === 'replace') {
         setConfirmState({
            type: 'REPLACE_LIBRARY',
            title: 'Replace Library?',
            message: `This will delete ALL existing songs and replace them with the ${newSongs.length} songs from your import. This cannot be undone.`,
            confirmLabel: 'Replace All',
            confirmVariant: 'danger',
            data: { newSongs }
         });
    } else {
        setSongs([...songs, ...newSongs]);
        setShowImport(false);
        setImportText('');
    }
  };
  
  const requestClearLibrary = () => {
      if (songs.length === 0) return;
      setConfirmState({
          type: 'CLEAR_LIBRARY',
          title: 'Clear Library?',
          message: 'Are you sure you want to delete ALL songs from the library? This cannot be undone.',
          confirmLabel: 'Clear Library',
          confirmVariant: 'danger'
      });
  };

  const handleConfirmAction = () => {
      if (!confirmState) return;

      if (confirmState.type === 'REMOVE_SET') {
          const id = confirmState.data?.id;
          if (id) setSets(prev => prev.filter(s => s.id !== id));
      } 
      else if (confirmState.type === 'REPLACE_LIBRARY') {
          const newSongs = confirmState.data?.newSongs;
          if (newSongs) {
              setSongs(newSongs);
              setShowImport(false);
              setImportText('');
          }
      }
      else if (confirmState.type === 'CLEAR_LIBRARY') {
          setSongs([]);
      }

      setConfirmState(null);
  };
  
  const handleRefreshGigDetails = async () => {
    if (!bandSettings.gigDetailsUrl) {
        alert("No Gig Details URL configured in Band Settings.");
        return;
    }
    
    const url = transformGoogleSheetUrl(bandSettings.gigDetailsUrl);
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Network response was not ok");
        const text = await res.text();
        
        // Check for HTML
        if (text.trim().startsWith("<!DOCTYPE html") || text.trim().startsWith("<html")) {
             throw new Error("Google returned HTML. Make sure the sheet is Public.");
        }

        const details = parseGigDetailsCSV(text);
        if (Object.keys(details).length > 0) {
            setGigDetails(prev => ({...prev, ...details}));
            alert("Gig details updated from spreadsheet!");
        } else {
            alert("No valid gig details found in the spreadsheet.");
        }
    } catch (e) {
        console.error("Failed to refresh gig details", e);
        alert("Failed to refresh gig details. Check console for errors.");
    }
  };

  // --- DND Handlers ---

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const type = active.data.current?.type;
    const data = active.data.current?.data;
    setActiveDragItem({ type, data });
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    // Moving a Set Song to another Set (or within same)
    if (activeType === 'SET_SONG') {
        const activeInstanceId = active.id;
        // Find which set contains the active item
        const activeSetIndex = sets.findIndex(set => set.songs.some(s => s.instanceId === activeInstanceId));
        
        let overSetIndex = -1;

        if (overType === 'SET_SONG') {
             overSetIndex = sets.findIndex(set => set.songs.some(s => s.instanceId === over.id));
        } else if (overType === 'SET' || overType === 'SET_COLUMN') {
             overSetIndex = sets.findIndex(set => set.id === over.id);
        }

        if (activeSetIndex !== -1 && overSetIndex !== -1 && activeSetIndex !== overSetIndex) {
            setSets(prevSets => {
                const activeSet = prevSets[activeSetIndex];
                const overSet = prevSets[overSetIndex];
                const activeSongIndex = activeSet.songs.findIndex(s => s.instanceId === activeInstanceId);
                const activeSong = activeSet.songs[activeSongIndex];

                // Remove from old set
                const newActiveSetSongs = [...activeSet.songs];
                newActiveSetSongs.splice(activeSongIndex, 1);

                // Add to new set (at end or near over index)
                const newOverSetSongs = [...overSet.songs];
                
                let overIndex = newOverSetSongs.length;
                if (overType === 'SET_SONG') {
                     const idx = newOverSetSongs.findIndex(s => s.instanceId === over.id);
                     if (idx !== -1) overIndex = idx;
                }
                
                newOverSetSongs.splice(overIndex, 0, activeSong);

                const newSets = [...prevSets];
                newSets[activeSetIndex] = { ...activeSet, songs: newActiveSetSongs };
                newSets[overSetIndex] = { ...overSet, songs: newOverSetSongs };
                
                return newSets;
            });
        }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragItem(null);

      if (!over) return;

      // 1. Column Reordering
      if (active.data.current?.type === 'SET_COLUMN' && over.data.current?.type === 'SET_COLUMN') {
          if (active.id !== over.id) {
              setSets((items) => {
                  const oldIndex = items.findIndex((i) => i.id === active.id);
                  const newIndex = items.findIndex((i) => i.id === over.id);
                  return arrayMove(items, oldIndex, newIndex);
              });
          }
          return;
      }

      // 2. Song Reordering (Same Set)
      if (active.data.current?.type === 'SET_SONG' && over.data.current?.type === 'SET_SONG') {
           const activeSetId = active.data.current.originSetId;
           // We can find the set by looking for the song if originSetId isn't reliable due to cross-drag
           const setIndex = sets.findIndex(s => s.songs.some(song => song.instanceId === active.id));
           if (setIndex !== -1) {
               const set = sets[setIndex];
               const oldIndex = set.songs.findIndex(s => s.instanceId === active.id);
               const newIndex = set.songs.findIndex(s => s.instanceId === over.id);
               
               if (oldIndex !== newIndex) {
                   const newSongs = arrayMove(set.songs, oldIndex, newIndex);
                   const newSets = [...sets];
                   newSets[setIndex] = { ...set, songs: newSongs };
                   setSets(newSets);
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
              // Add to end
          } else if (over.data.current?.type === 'SET_SONG') {
              // Find which set this song is in
              const overSongId = over.id;
              const set = sets.find(s => s.songs.some(so => so.instanceId === overSongId));
              if (set) {
                  targetSetId = set.id;
                  const idx = set.songs.findIndex(s => s.instanceId === overSongId);
                  insertIndex = idx;
              }
          }

          if (targetSetId) {
              // Check if already exists? (We allow duplicates but maybe warn? No, user can add multiple times).
              // Create instance
              const newSong: SetSong = {
                  ...songData,
                  instanceId: uuidv4(),
                  notes: ''
              };

              setSets(prev => prev.map(s => {
                  if (s.id === targetSetId) {
                      const newSongs = [...s.songs];
                      if (insertIndex === -1) {
                          newSongs.push(newSong);
                      } else {
                          newSongs.splice(insertIndex, 0, newSong);
                      }
                      return { ...s, songs: newSongs };
                  }
                  return s;
              }));
          }
      }
  };

  return (
    <div className="flex flex-col h-screen bg-[#09090b] text-zinc-100 font-sans overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-white/5 bg-zinc-900/50 flex items-center justify-between px-4 shrink-0">
             <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2">
                     <div className="w-8 h-8 rounded bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-primary/20">
                         SL
                     </div>
                     <div className="flex flex-col">
                        <span className="font-bold tracking-tight text-white leading-tight">{bandSettings.name || 'SetList Flow'}</span>
                        <span className="text-[10px] text-zinc-500 font-medium tracking-wider uppercase">Set List Manager</span>
                     </div>
                 </div>
                 
                 <div className="h-8 w-px bg-white/10 mx-2"></div>
                 
                 {/* Gig Quick Info Editor */}
                 <div 
                    onClick={() => setShowGigDetails(true)}
                    className="flex flex-col cursor-pointer hover:bg-white/5 px-2 py-1 rounded transition-colors group"
                 >
                     <div className="text-xs font-semibold text-zinc-300 group-hover:text-primary transition-colors flex items-center gap-1">
                        {gigDetails.name || 'Untitled Gig'} <Icons.Edit size={10} className="opacity-0 group-hover:opacity-100"/>
                     </div>
                     <div className="text-[10px] text-zinc-500 flex items-center gap-2">
                         <span>{gigDetails.date || 'No Date'}</span>
                         <span>•</span>
                         <span>{gigDetails.location || 'No Location'}</span>
                     </div>
                 </div>
             </div>

             <div className="flex items-center gap-2">
                 {/* Refresh Gig Details Button */}
                 <button 
                    onClick={handleRefreshGigDetails}
                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
                    title="Refresh Gig Details"
                 >
                     <Icons.Refresh size={18} />
                 </button>

                 <button 
                    onClick={() => setShowBandSettings(true)}
                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
                    title="Band Settings"
                 >
                     <Icons.Settings size={20} />
                 </button>
                 
                 <div className="h-6 w-px bg-white/10 mx-1"></div>

                 <button 
                    onClick={saveData}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${saveStatus === 'saved' ? 'bg-green-500 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'}`}
                 >
                     {saveStatus === 'saved' ? <Icons.Check size={16}/> : <Icons.Save size={16} />}
                     {saveStatus === 'saved' ? 'Saved' : 'Save'}
                 </button>

                 <button 
                    onClick={() => setShowPDFOptions(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-white hover:bg-indigo-500 transition-all shadow-lg shadow-primary/20"
                 >
                     <Icons.Download size={16} />
                     Export PDF
                 </button>
             </div>
        </header>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
            {/* Left Library Sidebar */}
            <SongLibrary 
                songs={songs} 
                usedInSetsMap={usedInSetsMap}
                onImportClick={() => { setImportText(''); setShowImport(true); }}
                onPlaySong={playSong}
                onUpdateSong={handleUpdateSong}
                onClearLibrary={requestClearLibrary}
                onEditSong={setEditingSong}
            />

            {/* Right Set List Area */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                dropAnimation={dropAnimation}
            >
                <div className="flex-1 flex flex-col bg-[#0c0c0e] relative overflow-hidden">
                     {/* Horizontal Scroll Area */}
                     <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 custom-scrollbar">
                        <SortableContext 
                            items={sets.map(s => s.id)} 
                            strategy={horizontalListSortingStrategy}
                        >
                            <div className="flex gap-6 h-full min-w-max pb-4">
                                {sets.map((set, i) => (
                                    <SetListColumn 
                                        key={set.id} 
                                        setList={set} 
                                        setIndex={i}
                                        totalSets={sets.length}
                                        bandMembers={bandSettings.members}
                                        duplicateSongIds={duplicateSongIds}
                                        onRemoveSet={requestRemoveSet}
                                        onRemoveSong={removeSongFromSet}
                                        onUpdateNote={updateSongNote}
                                        onPlaySong={playSong}
                                        onUpdateSetDetails={updateSetDetails}
                                        onEditSong={setEditingSong}
                                    />
                                ))}

                                {/* Add Set Button Area */}
                                {sets.length < 5 && (
                                    <div className="w-[320px] flex items-center justify-center shrink-0">
                                        <button 
                                            onClick={addSet}
                                            className="group flex flex-col items-center justify-center w-full h-[200px] border-2 border-dashed border-zinc-800 hover:border-primary/50 rounded-xl transition-all bg-zinc-900/20 hover:bg-zinc-900/50"
                                        >
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

                <DragOverlay>
                    {activeDragItem ? (
                        activeDragItem.type === 'LIBRARY_SONG' ? (
                           <div className="w-[300px] p-3 rounded-lg border border-primary/50 bg-zinc-900 shadow-2xl opacity-90 cursor-grabbing">
                               <div className="font-semibold text-white truncate">{activeDragItem.data.title}</div>
                               <div className="text-xs text-zinc-400">{activeDragItem.data.artist}</div>
                           </div>
                        ) : activeDragItem.type === 'SET_SONG' ? (
                            <div className="w-[300px] p-3 rounded-lg border border-yellow-500/50 bg-zinc-900 shadow-2xl opacity-90 cursor-grabbing">
                                <div className="flex items-center gap-2">
                                     <span className="text-zinc-500 font-mono text-xs">0.</span>
                                     <div className="font-semibold text-white truncate">{activeDragItem.data.title}</div>
                                </div>
                            </div>
                        ) : activeDragItem.type === 'SET_COLUMN' ? (
                            <div className="w-[320px] h-[400px] bg-zinc-900 rounded-xl border border-primary/30 shadow-2xl opacity-80">
                                <div className="p-4 border-b border-white/5 font-bold text-white">
                                    {activeDragItem.data.name}
                                </div>
                            </div>
                        ) : null
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>

        {/* Import Modal */}
        {showImport && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                 <div className="bg-surface border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="p-4 border-b border-white/5 bg-zinc-900 flex justify-between">
                        <h3 className="font-semibold text-white flex items-center gap-2"><Icons.Download size={18}/> Import Songs</h3>
                        <button onClick={() => setShowImport(false)}><Icons.Close size={20} className="text-zinc-500"/></button>
                    </div>
                    
                    <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300">
                            <strong>Format:</strong> Paste CSV or TSV data. First row should be headers. 
                            Supported headers: <em>Title, Artist, Duration, Video URL, Rating, Played Live, Notes, Guitar Lesson, Bass Lesson, Lyrics</em>.
                        </div>

                        {bandSettings.defaultLibraryUrl && (
                             <div className="flex items-center justify-between bg-zinc-800 p-3 rounded-lg border border-white/5">
                                 <span className="text-xs text-zinc-400">Load from configured Google Sheet?</span>
                                 <button 
                                    onClick={handleFetchFromUrl}
                                    className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded transition-colors"
                                 >
                                     Fetch from Sheet
                                 </button>
                             </div>
                        )}
                        
                        <textarea 
                            value={importText}
                            onChange={(e) => setImportText(e.target.value)}
                            placeholder="Paste your spreadsheet data here..."
                            className="w-full flex-1 min-h-[200px] bg-[#0c0c0e] border border-zinc-700 rounded-lg p-3 text-xs font-mono text-zinc-300 focus:border-primary outline-none resize-none"
                        />
                    </div>

                    <div className="p-4 border-t border-white/5 bg-zinc-900 flex justify-end gap-3">
                         <button 
                            onClick={() => setShowImport(false)}
                            className="px-4 py-2 text-sm text-zinc-400 hover:text-white"
                         >
                             Cancel
                         </button>
                         <button 
                            onClick={() => handleImport('replace')}
                            disabled={!importText.trim()}
                            className="px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-md disabled:opacity-50"
                         >
                             Replace Library
                         </button>
                         <button 
                            onClick={() => handleImport('add')}
                            disabled={!importText.trim()}
                            className="px-6 py-2 text-sm font-medium bg-primary text-white hover:bg-indigo-500 rounded-md shadow-lg shadow-primary/20 disabled:opacity-50"
                         >
                             Add to Library
                         </button>
                    </div>
                 </div>
            </div>
        )}

        {/* Gig Details Modal */}
        {showGigDetails && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                 <div className="bg-surface border border-white/10 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                    <div className="p-4 border-b border-white/5 bg-zinc-900 flex justify-between">
                        <h3 className="font-semibold text-white">Gig Details</h3>
                        <button onClick={() => setShowGigDetails(false)}><Icons.Close size={20} className="text-zinc-500"/></button>
                    </div>
                    
                    <div className="p-6 space-y-4">
                        <div>
                             <label className="block text-xs text-zinc-500 mb-1">Gig Name / Venue</label>
                             <input type="text" value={gigDetails.name} onChange={e => setGigDetails({...gigDetails, name: e.target.value})} className="w-full bg-background border border-zinc-700 rounded p-2 text-sm text-white focus:border-primary outline-none" />
                        </div>
                        <div>
                             <label className="block text-xs text-zinc-500 mb-1">Location Address</label>
                             <input type="text" value={gigDetails.location} onChange={e => setGigDetails({...gigDetails, location: e.target.value})} className="w-full bg-background border border-zinc-700 rounded p-2 text-sm text-white focus:border-primary outline-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Date</label>
                                <input type="date" value={gigDetails.date} onChange={e => setGigDetails({...gigDetails, date: e.target.value})} className="w-full bg-background border border-zinc-700 rounded p-2 text-sm text-white focus:border-primary outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Start Time</label>
                                <input type="time" value={gigDetails.startTime} onChange={e => setGigDetails({...gigDetails, startTime: e.target.value})} className="w-full bg-background border border-zinc-700 rounded p-2 text-sm text-white focus:border-primary outline-none" />
                            </div>
                        </div>
                         <div>
                             <label className="block text-xs text-zinc-500 mb-1">Arrive By</label>
                             <input type="time" value={gigDetails.arriveTime} onChange={e => setGigDetails({...gigDetails, arriveTime: e.target.value})} className="w-full bg-background border border-zinc-700 rounded p-2 text-sm text-white focus:border-primary outline-none" />
                        </div>
                        <div>
                             <label className="block text-xs text-zinc-500 mb-1">Gig Notes</label>
                             <textarea 
                                rows={3}
                                value={gigDetails.notes || ''} 
                                onChange={e => setGigDetails({...gigDetails, notes: e.target.value})}
                                className="w-full bg-background border border-zinc-700 rounded p-2 text-sm text-white focus:border-primary outline-none resize-none"
                                placeholder="Parking info, load-in details, etc."
                             />
                        </div>

                        <button 
                            onClick={() => setShowGigDetails(false)}
                            className="w-full mt-2 py-2 bg-primary text-white rounded-md font-medium hover:bg-indigo-500 transition-colors"
                        >
                            Done
                        </button>
                    </div>
                 </div>
            </div>
        )}

        <EditSongModal 
            song={editingSong} 
            isOpen={!!editingSong} 
            onClose={() => setEditingSong(null)} 
            onSave={handleUpdateSong}
        />
        
        <PDFOptionsModal 
            isOpen={showPDFOptions} 
            onClose={() => setShowPDFOptions(false)} 
            onGenerate={handleGeneratePDF}
        />

        <BandSettingsModal 
            isOpen={showBandSettings}
            onClose={() => setShowBandSettings(false)}
            settings={bandSettings}
            onSave={setBandSettings}
            onApplyProfile={(updates) => setBandSettings(prev => ({...prev, ...updates}))}
            onApplyGigDetails={(updates) => setGigDetails(prev => ({...prev, ...updates}))}
        />

        <ConfirmationModal 
            isOpen={!!confirmState}
            state={confirmState}
            onClose={() => setConfirmState(null)}
            onConfirm={handleConfirmAction}
        />

    </div>
  );
}