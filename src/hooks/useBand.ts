
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BandSettings, GigDetails, Gig } from '../types';
import { DEFAULT_LIBRARY_URL, DEFAULT_PROFILE_URL, DEFAULT_GIG_DETAILS_URL, parseGigDetailsCSV, transformGoogleSheetUrl } from '../utils';

export function useBand(profile: any) {
    const [bandSettings, setBandSettings] = useState<BandSettings>({
        name: 'My Band',
        logoUrl: '',
        members: ['Drummer', 'Bassist', 'Guitarist', 'Singer'],
        defaultLibraryUrl: DEFAULT_LIBRARY_URL,
        bandProfileUrl: DEFAULT_PROFILE_URL,
        gigDetailsUrl: DEFAULT_GIG_DETAILS_URL
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

    useEffect(() => {
        if (!profile?.band_id) return;

        const fetchBandData = async () => {
            setLoading(true);
            try {
                // Fetch Band Settings
                const { data: bandData } = await supabase.from('bands').select('*').eq('id', profile.band_id).single();
                if (bandData) {
                    setBandSettings({
                        name: bandData.name,
                        logoUrl: bandData.logo_url || '',
                        members: bandData.settings?.members || ['Drummer', 'Bassist', 'Guitarist', 'Singer'],
                        defaultLibraryUrl: bandData.settings?.defaultLibraryUrl || DEFAULT_LIBRARY_URL,
                        bandProfileUrl: bandData.settings?.bandProfileUrl || DEFAULT_PROFILE_URL,
                        gigDetailsUrl: bandData.settings?.gigDetailsUrl || DEFAULT_GIG_DETAILS_URL
                    });
                }

                // Fetch All Gigs
                const { data: gigData } = await supabase.from('gigs').select('*').eq('band_id', profile.band_id).order('date', { ascending: false });
                if (gigData) {
                    setGigs(gigData.map(g => ({
                        id: g.id,
                        band_id: g.band_id,
                        name: g.name,
                        date: g.date,
                        location: g.location,
                        status: new Date(g.date) >= new Date() ? 'upcoming' : 'past',
                        settings: g.settings
                    })));
                }
            } catch (error) {
                console.error("Error fetching band data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchBandData();
    }, [profile]);

    const selectGig = (gigId: string | null) => {
        if (!gigId) {
            setCurrentGigId(null);
            return;
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
        }
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
            const createdGig: Gig = {
                id: data.id,
                band_id: data.band_id,
                name: data.name,
                date: data.date,
                location: data.location,
                status: 'upcoming',
                settings: data.settings
            };
            setGigs(prev => [createdGig, ...prev]);
            selectGig(createdGig.id);
        }
    };

    const updateBandSettings = async (newSettings: BandSettings) => {
        setBandSettings(newSettings);
        if (profile?.band_id) {
            const updates = {
                name: newSettings.name,
                logo_url: newSettings.logoUrl,
                settings: {
                    members: newSettings.members,
                    defaultLibraryUrl: newSettings.defaultLibraryUrl,
                    bandProfileUrl: newSettings.bandProfileUrl,
                    gigDetailsUrl: newSettings.gigDetailsUrl
                }
            };
            await supabase.from('bands').update(updates).eq('id', profile.band_id);
        }
    };

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
        refreshGigDetailsFromUrl
    };
}
