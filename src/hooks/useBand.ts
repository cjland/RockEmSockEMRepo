
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BandSettings, GigDetails, Gig } from '../types';
import { DEFAULT_LIBRARY_URL, DEFAULT_PROFILE_URL, DEFAULT_GIG_DETAILS_URL, parseGigDetailsCSV, transformGoogleSheetUrl } from '../utils';

export function useBand(profile: any) {
    const [bandSettings, setBandSettings] = useState<BandSettings>({
        name: 'My Band',
        logoUrl: '',
        members: ['Drummer', 'Bassist', 'Guitarist', 'Singer'],
        accessCode: '',
        adminPassword: ''
    });

    const [gigs, setGigs] = useState<Gig[]>([]);
    const [gigDetails, setGigDetails] = useState<GigDetails>({
        name: '',
        location: '',
        date: '',
        startTime: '20:00',
        arriveTime: '18:00',
        notes: ''
    });

    const [currentGigId, setCurrentGigId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const refreshBandData = async () => {
        if (!profile?.band_id) return;
        setLoading(true);
        try {
            // Fetch Band Settings
            const { data: bandData } = await supabase.from('bands').select('*').eq('id', profile.band_id).single();
            if (bandData) {
                setBandSettings({
                    name: bandData.name,
                    website: bandData.website,
                    logoUrl: bandData.logo_url || '',
                    members: bandData.settings?.members || ['Drummer', 'Bassist', 'Guitarist', 'Singer'],
                    accessCode: bandData.settings?.accessCode || '',
                    adminPassword: bandData.settings?.adminPassword || ''
                });
            }

            // Fetch All Gigs with Set Summaries
            const { data: gigData } = await supabase.from('gigs').select('*').eq('band_id', profile.band_id).order('date', { ascending: false });

            // Fetch All Setlists for this Band to summarize
            const { data: setlistData } = await supabase
                .from('setlists')
                .select(`
                    id,
                    gig_id,
                    name,
                    order_index,
                    setlist_songs (
                        songs:song_id (
                            duration_seconds
                        )
                    )
                `)
                .eq('band_id', profile.band_id)
                .order('order_index');

            if (gigData) {
                const gigsWithSets = gigData.map(g => {
                    const gigSets = setlistData?.filter((s: any) => s.gig_id === g.id) || [];
                    const setSummaries = gigSets.map((s: any) => {
                        const songs = s.setlist_songs?.map((ss: any) => ss.songs) || [];
                        return {
                            name: s.name,
                            songCount: songs.length,
                            durationSeconds: songs.reduce((acc: number, song: any) => acc + (song?.duration_seconds || 0), 0)
                        };
                    });

                    return {
                        id: g.id,
                        band_id: g.band_id,
                        name: g.name,
                        date: g.date,
                        location: g.location,
                        status: new Date(g.date) >= new Date() ? 'upcoming' : 'past',
                        settings: g.settings,
                        setSummaries
                    };
                });
                setGigs(gigsWithSets);
            }
        } catch (error) {
            console.error("Error fetching band data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshBandData();
    }, [profile]);

    const selectGig = (gigId: string | null): boolean => {
        if (!gigId) {
            setCurrentGigId(null);
            setGigDetails({
                name: '',
                location: '',
                date: '',
                startTime: '20:00',
                arriveTime: '18:00',
                notes: ''
            });
            return true;
        }
        const gig = gigs.find(g => g.id === gigId);
        if (gig) {
            setCurrentGigId(gig.id);
            setGigDetails({
                name: gig.name,
                location: gig.location,
                date: gig.date,
                startTime: gig.settings?.startTime || '20:00',
                arriveTime: gig.settings?.arriveTime || '18:00',
                notes: gig.settings?.notes || '',
                settings: gig.settings || {} // Store full settings object
            });
            return true;
        }
        console.error(`[useBand] selectGig failed: Gig not found for ID ${gigId}`);
        return false;
    };

    const createGig = async (name: string, date: string, location: string) => {
        if (!profile?.band_id) return;
        const newGig = {
            band_id: profile.band_id,
            name,
            date,
            location,
            settings: { startTime: '20:00', arriveTime: '18:00', notes: '' }
        };

        const { data, error } = await supabase.from('gigs').insert([newGig]).select().single();
        if (error) {
            console.error('Error creating gig:', error);
            return;
        }

        if (data) {
            const gigDate = new Date(data.date);
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Normalize today to start of day
            // If gig date is today or future -> upcoming. Else -> past.
            const status = gigDate >= today ? 'upcoming' : 'past';

            const createdGig: Gig = {
                id: data.id,
                band_id: data.band_id,
                name: data.name,
                date: data.date,
                location: data.location,
                status: status,
                settings: data.settings,
                setSummaries: []
            };
            setGigs(prev => [createdGig, ...prev]);

            // Manually select since 'gigs' state won't be updated in this closure yet
            setCurrentGigId(createdGig.id);
            setGigDetails({
                name: createdGig.name,
                location: createdGig.location,
                date: createdGig.date,
                startTime: createdGig.settings?.startTime || '20:00',
                arriveTime: createdGig.settings?.arriveTime || '18:00',
                notes: createdGig.settings?.notes || '',
                settings: createdGig.settings || {}
            });
        }
    };

    const updateBandSettings = async (newSettings: BandSettings) => {
        setBandSettings(newSettings);
        if (profile?.band_id) {
            const updates = {
                name: newSettings.name,
                website: newSettings.website,
                logo_url: newSettings.logoUrl,
                settings: {
                    members: newSettings.members,
                    accessCode: newSettings.accessCode,
                    adminPassword: newSettings.adminPassword
                }
            };
            await supabase.from('bands').update(updates).eq('id', profile.band_id);
        }
    };

    // Update specific gig (for Dashboard usage)
    const updateGig = async (gigId: string, updates: Partial<GigDetails>) => {
        // 1. Update State
        setGigs(prev => prev.map(g => {
            if (g.id === gigId) {
                const currentSettings = g.settings || {};
                // If updates.settings exists, merge it. If updates has top-levels (name, location, date), use those.
                // Also merge flattened fields (startTime, etc) back into settings if needed for persistence
                const newSettings = {
                    ...currentSettings,
                    ...(updates.settings || {}),
                };
                if (updates.startTime) newSettings.startTime = updates.startTime;
                if (updates.arriveTime) newSettings.arriveTime = updates.arriveTime;
                if (updates.notes !== undefined) newSettings.notes = updates.notes;

                return {
                    ...g,
                    ...updates,
                    settings: newSettings
                };
            }
            return g;
        }));

        // 2. Update DB
        if (gigId) {
            const gigToUpdate = gigs.find(g => g.id === gigId);
            if (!gigToUpdate) return; // Should allow state update to propagate first? No, use provided updates.

            const currentSettings = gigToUpdate.settings || {};
            const newSettings = {
                ...currentSettings,
                ...(updates.settings || {}),
            };
            if (updates.startTime) newSettings.startTime = updates.startTime;
            if (updates.arriveTime) newSettings.arriveTime = updates.arriveTime;
            if (updates.notes !== undefined) newSettings.notes = updates.notes;

            const dbUpdates: any = {};
            if (updates.name) dbUpdates.name = updates.name;
            if (updates.date) dbUpdates.date = updates.date;
            if (updates.location) dbUpdates.location = updates.location;
            dbUpdates.settings = newSettings;

            await supabase.from('gigs').update(dbUpdates).eq('id', gigId);
        }
    }

    const updateGigDetails = async (updates: Partial<GigDetails>) => {
        setGigDetails(prev => ({ ...prev, ...updates }));

        if (currentGigId) {
            // Construct merged settings
            const currentSettings = gigDetails.settings || {};
            const newSettings = {
                ...currentSettings,
                ...(updates.settings || {}),
                startTime: updates.startTime !== undefined ? updates.startTime : (currentSettings.startTime || '20:00'),
                arriveTime: updates.arriveTime !== undefined ? updates.arriveTime : (currentSettings.arriveTime || '18:00'),
                notes: updates.notes !== undefined ? updates.notes : (currentSettings.notes || '')
            };

            const { error } = await supabase.from('gigs').update({
                name: updates.name !== undefined ? updates.name : gigDetails.name,
                location: updates.location !== undefined ? updates.location : gigDetails.location,
                date: updates.date !== undefined ? updates.date : gigDetails.date,
                settings: newSettings
            }).eq('id', currentGigId);

            if (error) console.error("Failed to update gig", error);

            // Update local gigs list to reflect name/date changes immediately in selector if we were to go back
            setGigs(prev => prev.map(g => g.id === currentGigId ? { ...g, name: updates.name || g.name, date: updates.date || g.date, location: updates.location || g.location } : g));
        }
    };

    const refreshGigDetailsFromUrl = async () => {
        if (!bandSettings.gigDetailsUrl) {
            alert("No Gig Details URL configured in Band Settings.");
            return;
        }

        const url = transformGoogleSheetUrl(bandSettings.gigDetailsUrl);
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error("Network response was not ok");
            const text = await res.text();

            if (text.trim().startsWith("<!DOCTYPE html") || text.trim().startsWith("<html")) {
                throw new Error("Google returned HTML. Make sure the sheet is Public.");
            }

            const details = parseGigDetailsCSV(text);
            if (Object.keys(details).length > 0) {
                await updateGigDetails(details);
                alert("Gig details updated from spreadsheet!");
            } else {
                alert("No valid gig details found in the spreadsheet.");
            }
        } catch (e) {
            console.error("Failed to refresh gig details", e);
            alert("Failed to refresh gig details. Check console for errors.");
        }
    };

    const deleteGig = async (gigId: string) => {
        // Optimistic update
        setGigs(prev => prev.filter(g => g.id !== gigId));
        if (currentGigId === gigId) {
            setCurrentGigId(null);
        }

        // Delete from DB (Assuming cascade or manual cleanup needed)
        // Ideally we delete setlists first to be safe if no cascade
        await supabase.from('setlists').delete().eq('gig_id', gigId);
        const { error } = await supabase.from('gigs').delete().eq('id', gigId);

        if (error) {
            console.error("Error deleting gig:", error);
            // Revert if verified failure, but for now simple alert
            alert("Failed to delete gig from server.");
            refreshBandData(); // Re-sync
        }
    };

    return {
        bandSettings,
        gigs,
        gigDetails,
        currentGigId,
        loading,
        selectGig,
        createGig,
        updateBandSettings,
        updateGigDetails,
        updateGig,
        deleteGig,
        refreshGigDetailsFromUrl,
        refreshBandData
    };
}
