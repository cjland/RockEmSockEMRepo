import React, { useState } from 'react';
import { Icons } from './ui/Icons';
import { Gig } from '../types';
import { formatTime12Hour, formatDurationHuman } from '../utils';
import { SongMetrics } from './SongMetrics';

interface GigSelectorProps {
    gigs: Gig[];
    onCreateGig: (name: string, date: string, location: string) => Promise<void> | void;
    onSelectGig: (gigId: string) => void;
    onManageSongs: () => void;
    onSignOut: () => void;
    onBandSettings: () => void;
    onEditGig: (gig: Gig) => void;
    onDeleteGig: (gig: Gig) => void;
    onChangePassword: () => void;
    userEmail?: string;
    logoUrl?: string;
    bandName?: string;
    bandId?: string;
    totalSongs?: number;
    onImportSampleData?: (type: 'MINI' | 'FULL') => void;
}

export const GigSelector: React.FC<GigSelectorProps> = ({ gigs, onCreateGig, onSelectGig, onManageSongs, onSignOut, onChangePassword, onBandSettings, onEditGig, onDeleteGig, userEmail, logoUrl, bandName, bandId, totalSongs = 0, onImportSampleData }) => {
    const [showCreate, setShowCreate] = useState(false);
    const [newGigName, setNewGigName] = useState('');
    const [newGigDate, setNewGigDate] = useState('');
    const [newGigLocation, setNewGigLocation] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newGigName && newGigDate && newGigLocation && !isSubmitting) {
            setIsSubmitting(true);
            try {
                await onCreateGig(newGigName, newGigDate, newGigLocation);
                setShowCreate(false);
                setNewGigName('');
                setNewGigDate('');
                setNewGigLocation('');
            } catch (error) {
                console.error("Failed to create gig:", error);
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const parseLocalDate = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    const getDaysUntil = (dateStr: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const gigDate = parseLocalDate(dateStr);

        const diffTime = gigDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
        if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
        return `in ${diffDays} days`;
    };

    const upcomingGigs = gigs.filter(g => g.status === 'upcoming').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const pastGigs = gigs.filter(g => g.status === 'past').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const renderGigCard = (gig: Gig, isPast: boolean) => (
        <div
            key={gig.id}
            className={`group relative flex flex-col rounded-xl border transition-all backdrop-blur-md overflow-hidden 
                ${isPast
                    ? 'border-white/5 bg-zinc-900/40 hover:bg-zinc-900/60 hover:border-white/10 grayscale hover:grayscale-0 opacity-70 hover:opacity-100'
                    : 'border-white/10 bg-[#121215]/80 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/10'
                }`}
        >
            {!isPast && (
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
            )}

            {/* Actions - Top Right */}
            <div className="absolute top-3 right-3 z-20 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onEditGig(gig);
                    }}
                    className="p-2 text-zinc-500 hover:text-white bg-black/40 hover:bg-black/60 rounded-full transition-colors"
                    title="Edit Gig Details"
                >
                    <Icons.Settings size={16} />
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDeleteGig(gig);
                    }}
                    className="p-2 text-red-500/80 hover:text-red-400 bg-black/40 hover:bg-black/60 rounded-full transition-colors"
                    title="Delete Gig"
                >
                    <Icons.Trash size={16} />
                </button>
            </div>

            {/* Main Click Area */}
            <div
                className="flex-1 p-6 cursor-pointer"
                onClick={() => onSelectGig(gig.id)}
            >
                <div className="flex justify-between items-start mb-4 pr-10">
                    {isPast ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-700/50 text-zinc-500 border border-zinc-700/50">PAST</span>
                    ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20">UPCOMING</span>
                    )}
                    <span className={`text-xs font-bold px-2 py-1 rounded border ${isPast ? 'text-zinc-500 border-zinc-700/50' : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'}`}>
                        {getDaysUntil(gig.date)}
                    </span>
                </div>

                <h3 className={`text-2xl font-bold mb-2 transition-colors truncate ${isPast ? 'text-zinc-400 group-hover:text-white' : 'text-white group-hover:text-primary'}`}>
                    {gig.name}
                </h3>

                <div className="space-y-3 mb-4">
                    {/* Date & Location */}
                    <div className="text-sm text-zinc-400 space-y-1">
                        <div className="flex items-center gap-2">
                            <Icons.Calendar size={14} className="text-zinc-500" />
                            <span className="font-medium text-white">{parseLocalDate(gig.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Icons.Sort size={14} className="text-zinc-500" />
                            <span>{gig.location}</span>
                        </div>
                    </div>

                    {/* Line 1: Times */}
                    {(gig.settings?.arriveTime || gig.settings?.startTime) && (
                        <div className={`flex items-center gap-2 text-xs font-mono ${isPast ? 'text-zinc-600' : 'text-indigo-300'}`}>
                            {gig.settings?.arriveTime && <span>Arrive: {formatTime12Hour(gig.settings.arriveTime)}</span>}
                            {gig.settings?.arriveTime && gig.settings?.startTime && <span className="text-zinc-600">|</span>}
                            {gig.settings?.startTime && <span>Start: {formatTime12Hour(gig.settings.startTime)}</span>}
                        </div>
                    )}

                    {/* Line 2: Notes */}
                    {gig.settings?.notes && (
                        <div className="text-xs text-zinc-500 italic line-clamp-2">
                            "{gig.settings.notes}"
                        </div>
                    )}

                    {/* Line 3: Set Summaries */}
                    {gig.setSummaries && gig.setSummaries.length > 0 && (
                        <div className={`flex flex-wrap gap-2 mt-2 ${isPast ? 'opacity-70' : ''}`}>
                            {gig.setSummaries.map((s, idx) => {
                                // Cycle through colors: Indigo -> Violet -> Fuchsia -> Pink -> Rose
                                const colorStyles = [
                                    "text-indigo-300 bg-indigo-500/10 border-indigo-500/20",
                                    "text-violet-300 bg-violet-500/10 border-violet-500/20",
                                    "text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/20",
                                    "text-pink-300 bg-pink-500/10 border-pink-500/20",
                                    "text-rose-300 bg-rose-500/10 border-rose-500/20"
                                ];
                                const style = isPast
                                    ? "text-zinc-500 bg-zinc-800/50 border-zinc-700/50"
                                    : colorStyles[idx % colorStyles.length];

                                return (
                                    <span key={idx} className={`text-[10px] font-bold px-2 py-0.5 rounded border ${style} flex items-center`}>
                                        <span className="uppercase mr-1.5 opacity-75">Set {idx + 1}</span>
                                        <span>{s.songCount} Songs / {formatDurationHuman(s.durationSeconds)}</span>
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
            <div className="px-6 pb-6 mt-auto flex justify-end pointer-events-none">
                <span className={`text-xs font-medium group-hover:translate-x-1 transition-transform flex items-center gap-1 ${isPast ? 'text-zinc-600 group-hover:text-zinc-400' : 'text-primary'}`}>
                    {isPast ? 'View Setlist' : 'Manage Setlist'} <Icons.ArrowRight size={12} />
                </span>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col items-center min-h-screen bg-black text-white p-6 relative overflow-x-hidden">
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-[#09090b] to-[#09090b] z-0 pointer-events-none"></div>

            <div className="z-10 w-full max-w-[1400px] flex flex-col gap-10 animate-fade-in relative">

                {/* Header Section */}
                <div className="flex flex-col items-center gap-4 text-center mt-8">
                    {logoUrl && (
                        <div className="w-32 h-32 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center p-2 shadow-2xl overflow-hidden backdrop-blur-sm">
                            <img src={logoUrl} alt="Band Logo" className="w-full h-full object-contain" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                        </div>
                    )}
                    <div>
                        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent tracking-tight">
                            {bandName || 'Band Dashboard'}
                        </h1>
                        <p className="text-zinc-400 mt-2">Welcome back, {userEmail}</p>
                    </div>
                    <div className="absolute top-0 right-0 flex items-center gap-2">
                        <button onClick={onChangePassword} className="text-sm text-zinc-500 hover:text-white transition-colors bg-zinc-900/50 px-3 py-1.5 rounded-full border border-white/5 flex items-center gap-2">
                            <Icons.Key size={14} /> Password
                        </button>
                        <button onClick={onSignOut} className="text-sm text-zinc-500 hover:text-white transition-colors bg-zinc-900/50 px-3 py-1.5 rounded-full border border-white/5">
                            Sign Out
                        </button>
                    </div>
                </div>

                {/* Welcome / Empty State Section */}
                {totalSongs === 0 && (
                    <div className="w-full max-w-3xl mx-auto">
                        <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-8 text-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-32 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                            <Icons.Music size={48} className="text-indigo-400 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold text-white mb-2">Build Your Setlist</h2>
                            <p className="text-zinc-400 mb-8 max-w-lg mx-auto">
                                Your song library is empty. Import sample data to quickly see how setlist management works, or start adding your own songs.
                            </p>
                            <div className="flex flex-wrap justify-center gap-4 relative z-10">
                                <button
                                    onClick={() => onImportSampleData?.('MINI')}
                                    className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-all border border-white/10 flex items-center gap-2 group"
                                >
                                    <Icons.Plus size={18} className="text-zinc-400 group-hover:text-white transition-colors" />
                                    Import 5 Sample Songs
                                </button>
                                <button
                                    onClick={() => onImportSampleData?.('FULL')}
                                    className="px-6 py-3 bg-primary hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                                >
                                    <Icons.Download size={18} />
                                    Import Full Rock Set (50+ Songs)
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="h-px bg-white/5 w-full"></div>

                {/* Gig Management Section */}
                <section className="space-y-6">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            Gig Management
                            <span className="text-xs font-normal text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded-full">{gigs.length} Total</span>
                        </h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => document.getElementById('song-metrics')?.scrollIntoView({ behavior: 'smooth' })}
                                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg border border-white/10 transition-all text-sm font-bold"
                            >
                                <Icons.BarChart size={16} /> Song Metrics
                            </button>
                            <button
                                onClick={() => setShowCreate(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg border border-primary/20 transition-all text-sm font-bold"
                            >
                                <Icons.Plus size={16} /> Create New Gig
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                        {upcomingGigs.length === 0 && pastGigs.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-zinc-600">
                                <Icons.Calendar size={48} className="mb-4 opacity-50" />
                                <p className="text-lg">No gigs found. Create one to get started!</p>
                            </div>
                        )}

                        {/* Upcoming Gigs */}
                        {upcomingGigs.map(gig => renderGigCard(gig, false))}

                        {/* Past Gigs */}
                        {pastGigs.length > 0 && (
                            <div className="col-span-full pt-8 pb-4 border-t border-white/5 mt-8">
                                <h3 className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Past Gigs</h3>
                            </div>
                        )}

                        {pastGigs.map(gig => renderGigCard(gig, true))}
                    </div>
                </section>

                <div className="h-px bg-white/5 w-full"></div>

                {/* Master Controls Section - Moved to Bottom */}
                <section className="space-y-4 pb-20">
                    <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-wider border-b border-white/5 pb-2">Master Controls</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Master Song Library */}
                        <button
                            onClick={onManageSongs}
                            className="group relative flex items-center p-6 rounded-xl border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/40 transition-all text-left"
                        >
                            <div className="w-16 h-16 rounded-full bg-indigo-500/10 group-hover:bg-indigo-500/20 flex items-center justify-center mr-6 transition-colors shrink-0">
                                <Icons.Music size={32} className="text-indigo-400 group-hover:text-indigo-300 transition-colors" />
                            </div>
                            <div>
                                <span className="block text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">Master Song Library</span>
                                <span className="text-sm text-indigo-400/60">Manage your entire repertoire</span>
                            </div>
                            <div className="absolute right-6 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400">
                                <Icons.ArrowRight size={20} />
                            </div>
                        </button>

                        {/* Master Band Settings */}
                        <button
                            onClick={onBandSettings}
                            className="group relative flex items-center p-6 rounded-xl border border-zinc-700/30 bg-zinc-800/20 hover:bg-zinc-800/40 hover:border-zinc-500/40 transition-all text-left"
                        >
                            <div className="w-16 h-16 rounded-full bg-zinc-700/20 group-hover:bg-zinc-600/30 flex items-center justify-center mr-6 transition-colors shrink-0">
                                <Icons.Settings size={32} className="text-zinc-400 group-hover:text-zinc-200 transition-colors" />
                            </div>
                            <div>
                                <span className="block text-lg font-bold text-white group-hover:text-zinc-200 transition-colors">Master Band Settings</span>
                                <span className="text-sm text-zinc-500">Configure profile, members, and defaults</span>
                            </div>
                            <div className="absolute right-6 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400">
                                <Icons.ArrowRight size={20} />
                            </div>
                        </button>
                    </div>
                </section>

                {/* Song Metrics Dashboard (Embedded) */}
                {bandId && (
                    <section>
                        <SongMetrics
                            activeBand={{ id: bandId, name: bandName || 'Band' }}
                            embedded={true}
                        />
                    </section>
                )}
            </div>

            {/* Create Gig Modal */}
            {
                showCreate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                        <div className="bg-[#121215] border border-white/10 rounded-xl shadow-2xl w-full max-w-md p-6 ring-1 ring-white/5">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-white">Create New Gig</h2>
                                <button onClick={() => setShowCreate(false)} className="text-zinc-500 hover:text-white"><Icons.Close size={20} /></button>
                            </div>

                            <form onSubmit={handleCreate} className="space-y-4">
                                <div>
                                    <label className="block text-xs text-zinc-400 mb-1">Gig Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={newGigName}
                                        onChange={e => setNewGigName(e.target.value)}
                                        className="w-full bg-black/30 border border-zinc-700 rounded p-2.5 text-sm text-white focus:border-primary outline-none"
                                        placeholder="e.g. Summer Festival 2024"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-400 mb-1">Date</label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            required
                                            value={newGigDate}
                                            onChange={e => setNewGigDate(e.target.value)}
                                            className="w-full bg-black/30 border border-zinc-700 rounded p-2.5 pl-10 text-sm text-white focus:border-primary outline-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                            onClick={(e) => (e.target as HTMLInputElement).showPicker()}
                                        />
                                        <Icons.Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-400 mb-1">Location</label>
                                    <input
                                        type="text"
                                        required
                                        value={newGigLocation}
                                        onChange={e => setNewGigLocation(e.target.value)}
                                        className="w-full bg-black/30 border border-zinc-700 rounded p-2.5 text-sm text-white focus:border-primary outline-none"
                                        placeholder="e.g. The Downtown Club"
                                    />
                                </div>

                                <div className="pt-4 flex justify-end gap-3">
                                    <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white" disabled={isSubmitting}>Cancel</button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-md hover:bg-indigo-500 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Icons.Loader className="animate-spin" size={16} /> Creating...
                                            </>
                                        ) : (
                                            "Create Gig"
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
