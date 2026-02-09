import React, { useState, useEffect } from 'react';
import { GigDetails } from '../types';
import { Icons } from './ui/Icons';

interface EditGigModalProps {
    isOpen: boolean;
    onClose: () => void;
    gigDetails: GigDetails;
    onSave: (updates: Partial<GigDetails>) => Promise<void>;
}

export const EditGigModal: React.FC<EditGigModalProps> = ({ isOpen, onClose, gigDetails, onSave }) => {
    const [formData, setFormData] = useState<GigDetails>({ ...gigDetails });

    useEffect(() => {
        if (isOpen) {
            setFormData({ ...gigDetails });
        }
    }, [isOpen, gigDetails]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSave(formData);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[#121215]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl w-full max-w-md ring-1 ring-white/5">
                <div className="flex items-center justify-between p-4 border-b border-white/5 bg-zinc-900 sticky top-0 z-10">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                        <Icons.Edit size={16} className="text-primary" />
                        Edit Gig Details
                    </h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white"><Icons.Close size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="text-xs text-zinc-400 block mb-1">Gig Name</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-black/30 border border-zinc-700 rounded p-2.5 text-sm text-white focus:border-primary outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-zinc-400 block mb-1">Date</label>
                        <input
                            type="date"
                            required
                            value={formData.date}
                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                            className="w-full bg-black/30 border border-zinc-700 rounded p-2.5 text-sm text-white focus:border-primary outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-zinc-400 block mb-1">Location</label>
                        <input
                            type="text"
                            required
                            value={formData.location}
                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                            className="w-full bg-black/30 border border-zinc-700 rounded p-2.5 text-sm text-white focus:border-primary outline-none"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Start Time</label>
                            <input
                                type="time"
                                value={formData.startTime || ''}
                                onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                className="w-full bg-black/30 border border-zinc-700 rounded p-2.5 text-sm text-white focus:border-primary outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Arrive Time</label>
                            <input
                                type="time"
                                value={formData.arriveTime || ''}
                                onChange={e => setFormData({ ...formData, arriveTime: e.target.value })}
                                className="w-full bg-black/30 border border-zinc-700 rounded p-2.5 text-sm text-white focus:border-primary outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-zinc-400 block mb-1">Notes</label>
                        <textarea
                            rows={3}
                            value={formData.notes || ''}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full bg-black/30 border border-zinc-700 rounded p-2.5 text-sm text-white focus:border-primary outline-none resize-none"
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
