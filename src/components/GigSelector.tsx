import React, { useState } from 'react';
import { Icons } from './ui/Icons';
import { Gig } from '../types';

interface GigSelectorProps {
    gigs: Gig[];
    onCreateGig: (name: string, date: string, location: string) => void;
    onSelectGig: (gigId: string) => void;
    onManageSongs: () => void;
    onSignOut: () => void;
    onBandSettings: () => void;
    userEmail?: string;
}

export const GigSelector: React.FC<GigSelectorProps> = ({ gigs, onCreateGig, onSelectGig, onManageSongs, onSignOut, onBandSettings, userEmail }) => {
    const [showCreate, setShowCreate] = useState(false);
    const [newGigName, setNewGigName] = useState('');
    const [newGigDate, setNewGigDate] = useState('');
    const [newGigLocation, setNewGigLocation] = useState('');

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (newGigName && newGigDate && newGigLocation) {
            onCreateGig(newGigName, newGigDate, newGigLocation);
            setShowCreate(false);
            setNewGigName('');
            setNewGigDate('');
            setNewGigLocation('');
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4 relative overflow-hidden">
            {/* Background Atmosphere */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-[#09090b] to-[#09090b] z-0"></div>

            <div className="z-10 w-full max-w-4xl flex flex-col items-center gap-8 animate-fade-in">

                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent tracking-tight">Select a Gig</h1>
                    <p className="text-zinc-400">Choose a gig to manage your setlist or create a new one.</p>
                </div>

                {/* User Info & Logout (Top Right) */}
                <div className="absolute top-4 right-4 flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/50 border border-white/5 backdrop-blur-sm">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-bold">
                            {userEmail?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs text-zinc-300">{userEmail}</span>
                    </div>
                    <button onClick={onBandSettings} className="p-2 text-zinc-500 hover:text-white transition-colors" title="Band Settings">
                        <Icons.Settings size={18} />
                    </button>
                    <button onClick={onSignOut} className="text-sm text-zinc-500 hover:text-white transition-colors">Sign Out</button>
                </div>

                {/* Main Content Area */}
                <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* Master Song Library Card */}
                    <button
                        onClick={onManageSongs}
                        className="group relative flex flex-col items-center justify-center h-[200px] rounded-xl border-2 border-dashed border-indigo-500/30 hover:border-indigo-500 bg-indigo-500/5 hover:bg-indigo-500/10 transition-all"
                    >
                        <div className="w-16 h-16 rounded-full bg-indigo-500/10 group-hover:bg-indigo-500/20 flex items-center justify-center mb-4 transition-colors">
                            <Icons.Music size={32} className="text-indigo-400 group-hover:text-indigo-300 transition-colors" />
                        </div>
                        <span className="font-semibold text-indigo-400 group-hover:text-indigo-300 transition-colors">Master Song Library</span>
                        <span className="text-xs text-indigo-500/60 mt-1">Manage all {gigs.length > 0 ? '' : 'your'} songs</span>
                    </button>

                    {/* Create New Card */}
                    <button
                        onClick={() => setShowCreate(true)}
                        className="group relative flex flex-col items-center justify-center h-[200px] rounded-xl border-2 border-dashed border-zinc-800 hover:border-primary/50 bg-white/5 hover:bg-white/10 transition-all"
                    >
                        <div className="w-16 h-16 rounded-full bg-zinc-800 group-hover:bg-primary/20 flex items-center justify-center mb-4 transition-colors">
                            <Icons.Plus size={32} className="text-zinc-500 group-hover:text-primary transition-colors" />
                        </div>
                        <span className="font-semibold text-zinc-400 group-hover:text-white transition-colors">Create New Gig</span>
                    </button>

                    {/* Pending Gigs (Upcoming) */}
                    {gigs.filter(g => g.status === 'upcoming').map(gig => (
                        <div
                            key={gig.id}
                            onClick={() => onSelectGig(gig.id)}
                            className="group relative flex flex-col p-6 h-[200px] rounded-xl border border-white/10 bg-[#121215]/80 hover:bg-[#18181b] hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/10 transition-all cursor-pointer backdrop-blur-md overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

                            <div className="flex-1">
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 mb-3">UPCOMING</span>
                                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-primary transition-colors truncate">{gig.name}</h3>
                                <div className="flex items-center gap-2 text-sm text-zinc-400 mb-1">
                                    <Icons.Calendar size={14} />
                                    <span>{new Date(gig.date).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-zinc-500">
                                    <Icons.Sort size={14} />
                                    <span>{gig.location}</span>
                                </div>
                            </div>
                            <div className="mt-4 flex justify-end">
                                <span className="text-xs font-medium text-primary group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                    Manage <Icons.ArrowRight size={12} />
                                </span>
                            </div>
                        </div>
                    ))}

                    {/* Past Gigs */}
                    {gigs.filter(g => g.status === 'past').map(gig => (
                        <div
                            key={gig.id}
                            onClick={() => onSelectGig(gig.id)}
                            className="group relative flex flex-col p-6 h-[200px] rounded-xl border border-white/5 bg-zinc-900/40 hover:bg-zinc-900/60 hover:border-white/10 transition-all cursor-pointer backdrop-blur-sm grayscale hover:grayscale-0"
                        >
                            <div className="flex-1">
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-700/50 text-zinc-500 border border-zinc-700/50 mb-3">PAST</span>
                                <h3 className="text-xl font-bold text-zinc-400 mb-1 group-hover:text-white transition-colors truncate">{gig.name}</h3>
                                <div className="flex items-center gap-2 text-sm text-zinc-600 mb-1">
                                    <Icons.Calendar size={14} />
                                    <span>{new Date(gig.date).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Create Gig Modal */}
            {showCreate && (
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
                                <input
                                    type="date"
                                    required
                                    value={newGigDate}
                                    onChange={e => setNewGigDate(e.target.value)}
                                    className="w-full bg-black/30 border border-zinc-700 rounded p-2.5 text-sm text-white focus:border-primary outline-none"
                                />
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
                                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-md hover:bg-indigo-500 transition-colors shadow-lg shadow-primary/20">Create Gig</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
