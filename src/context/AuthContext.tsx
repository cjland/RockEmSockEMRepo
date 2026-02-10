import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Helper types for our custom auth
export interface CustomUser {
    id: string;
    email: string;
    role: string;
    // We don't expose password here obviously
}

export interface UserBand {
    band_id: string;
    role: string;
    band_name?: string; // We'll fetch this
}

interface AuthContextType {
    user: CustomUser | null;
    activeBand: UserBand | null; // The currently selected band
    userBands: UserBand[]; // All bands the user belongs to
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error?: string }>;
    signUpInitiate: (email: string) => Promise<{ error?: string; code?: string }>; // Returns code for demo purposes
    signUpComplete: (email: string, code: string, password: string) => Promise<{ error?: string }>;
    signOut: () => void;
    switchBand: (bandId: string) => void;
    changePassword: (currentPassword: string, newPassword: string) => Promise<{ error?: string }>;
    resetPasswordInitiate: (email: string) => Promise<{ error?: string }>;
    resetPasswordComplete: (email: string, code: string, newPassword: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<CustomUser | null>(null);
    const [userBands, setUserBands] = useState<UserBand[]>([]);
    const [activeBand, setActiveBand] = useState<UserBand | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check local storage for session
        const storedUserId = localStorage.getItem('bandcamp_user_id');
        if (storedUserId) {
            fetchUser(storedUserId);
        } else {
            setLoading(false);
        }
    }, []);

    const fetchUser = async (userId: string) => {
        try {
            // 1. Fetch User
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id, email, role')
                .eq('id', userId)
                .single();

            if (userError || !userData) {
                console.error("User fetch error:", userError);
                signOut(); // Invalid session
                return;
            }

            setUser(userData);

            // 2. Fetch User Bands
            const { data: bandData, error: bandError } = await supabase
                .from('user_bands')
                .select('band_id, role, bands(name)')
                .eq('user_id', userId);

            if (bandData) {
                const mappedBands: UserBand[] = bandData.map(b => ({
                    band_id: b.band_id,
                    role: b.role,
                    band_name: (b.bands as any)?.name
                }));
                setUserBands(mappedBands);

                // Restore active band or default to first
                const storedBandId = localStorage.getItem('bandcamp_active_band_id');
                const active = mappedBands.find(b => b.band_id === storedBandId) || mappedBands[0] || null;
                setActiveBand(active);
                if (active) localStorage.setItem('bandcamp_active_band_id', active.band_id);
            }
        } catch (err) {
            console.error("Auth hydration error:", err);
            signOut();
        } finally {
            setLoading(false);
        }
    };

    const signIn = async (email: string, password: string) => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, email, role, password') // Selecting password to verify (Client-side plain text check per request)
                .eq('email', email)
                .single();

            if (error || !data) return { error: 'Invalid email or password' };

            // Plain text password check
            if (data.password !== password) return { error: 'Invalid email or password' };

            // Login Success
            localStorage.setItem('bandcamp_user_id', data.id);
            await fetchUser(data.id);
            return {};
        } catch (err) {
            return { error: 'An unexpected error occurred' };
        }
    };

    const signUpInitiate = async (email: string) => {
        // 1. Check if user exists
        const { data: existing } = await supabase.from('users').select('id, password').eq('email', email).single();
        if (existing && existing.password) {
            return { error: 'User already exists. Please sign in.' };
        }

        // 2. Generate generic code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        if (existing) {
            // Update existing pending user
            await supabase.from('users').update({ verification_code: code }).eq('id', existing.id);
        } else {
            // Create new pending user
            await supabase.from('users').insert({ email, verification_code: code, password: '' }); // Password empty initially
        }

        // Send Email via Edge Function
        const { data: fnData, error: fnError } = await supabase.functions.invoke('send-email', {
            body: { email, code }
        });

        if (fnError) {
            console.error("Failed to send email (Network/System):", fnError);
            alert(`Failed to send email: ${fnError.message}. Code: ${code}`);
            return { error: 'Failed to send verification email' };
        }

        if (fnData && !fnData.success) {
            console.error("Failed to send email (Logic):", fnData);
            alert(`Failed to send email: ${fnData.error || 'Unknown Error'}. \nDetails: ${JSON.stringify(fnData.details)}\nCode: ${code}`);
            return { error: fnData.error };
        }

        return {}; // Code is now secret!
    };

    const resetPasswordInitiate = async (email: string) => {
        const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
        if (!existing) return { error: 'User not found' };

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await supabase.from('users').update({ verification_code: code }).eq('id', existing.id);

        const { error: fnError } = await supabase.functions.invoke('send-email', {
            body: { email, code, type: 'reset' }
        });

        if (fnError) {
            console.error("Failed to send reset email:", fnError);
            alert(`Failed to send email. For debugging, code is: ${code}`);
            return { error: 'Failed to send reset email' };
        }
        return {};
    };

    const resetPasswordComplete = async (email: string, code: string, newPassword: string) => {
        const { data, error } = await supabase.from('users').select('*').eq('email', email).single();

        if (error || !data) return { error: 'User not found' };
        if (data.verification_code !== code) return { error: 'Invalid verification code' };

        const { error: updateError } = await supabase
            .from('users')
            .update({ password: newPassword, verification_code: null })
            .eq('id', data.id);

        if (updateError) return { error: 'Failed to reset password' };
        return {};
    };

    const signUpComplete = async (email: string, code: string, password: string) => {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !data) return { error: 'User not found' };
        if (data.verification_code !== code) return { error: 'Invalid verification code' };

        // 1. Update User with Password
        const { error: updateError } = await supabase
            .from('users')
            .update({
                password: password,
                verification_code: null, // Clear code
                role: 'admin' // First user is admin by default in this flow logic
            })
            .eq('id', data.id);

        if (updateError) return { error: 'Failed to set password' };

        // 2. Create Default Band for new user
        const { data: bandData, error: bandCreateError } = await supabase
            .from('bands')
            .insert({ name: `${email.split('@')[0]}'s Band` })
            .select()
            .single();

        if (bandCreateError || !bandData) return { error: 'Failed to create band' };

        // 3. Link User to Band
        await supabase.from('user_bands').insert({
            user_id: data.id,
            band_id: bandData.id,
            role: 'owner'
        });

        // 4. Auto Login
        localStorage.setItem('bandcamp_user_id', data.id);
        await fetchUser(data.id);
        return {};
    };

    const signOut = () => {
        localStorage.removeItem('bandcamp_user_id');
        localStorage.removeItem('bandcamp_active_band_id');
        setUser(null);
        setUserBands([]);
        setActiveBand(null);
    };

    const switchBand = (bandId: string) => {
        const band = userBands.find(b => b.band_id === bandId);
        if (band) {
            setActiveBand(band);
            localStorage.setItem('bandcamp_active_band_id', bandId);
        }
    };

    const changePassword = async (currentPassword: string, newPassword: string) => {
        if (!user) return { error: 'Not authenticated' };

        // 1. Verify old password
        const { data: userData, error: fetchError } = await supabase
            .from('users')
            .select('password')
            .eq('id', user.id)
            .single();

        if (fetchError || !userData) return { error: 'Failed to verify user' };
        if (userData.password !== currentPassword) return { error: 'Incorrect current password' };

        // 2. Update to new password
        const { error } = await supabase
            .from('users')
            .update({ password: newPassword })
            .eq('id', user.id);

        if (error) return { error: 'Failed to update password' };
        return {};
    };

    return (
        <AuthContext.Provider value={{
            user,
            activeBand,
            userBands,
            loading,
            signIn,
            signUpInitiate,
            signUpComplete,
            signOut,
            switchBand,
            changePassword,
            resetPasswordInitiate,
            resetPasswordComplete
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
