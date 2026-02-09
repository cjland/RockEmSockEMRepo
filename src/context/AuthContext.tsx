
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';

interface Profile {
    id: string;
    full_name: string | null;
    role: 'admin' | 'member';
    band_id: string | null;
}

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) fetchProfile(session.user);
            else setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) fetchProfile(session.user);
            else {
                setProfile(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchProfile = async (currentUser: User) => {
        const userId = currentUser.id;
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error && error.code === 'PGRST116') {
                // Profile not found - Create new Band and Profile
                console.log("No profile found. Creating new band and profile...");

                // 1. Create Band
                const { data: bandData, error: bandError } = await supabase
                    .from('bands')
                    .insert([{ name: 'My Band' }])
                    .select()
                    .single();

                if (bandError) {
                    console.error("Error creating band:", bandError);
                    return;
                }

                // 2. Create Profile
                if (bandData) {
                    const { data: profileData, error: profileError } = await supabase
                        .from('profiles')
                        .insert([{
                            id: userId,
                            full_name: currentUser.user_metadata.full_name || currentUser.email?.split('@')[0] || 'Musician',
                            band_id: bandData.id,
                            role: 'admin'
                        }])
                        .select()
                        .single();

                    if (profileError) {
                        console.error("Error creating profile:", profileError);
                    } else {
                        setProfile(profileData);
                    }
                }

            } else if (error) {
                console.error('Error fetching profile:', error);
            } else {
                setProfile(data);
            }
        } catch (error) {
            console.error('Error in fetchProfile:', error);
        } finally {
            setLoading(false);
        }
    };

    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        if (error) console.error('Error signing in:', error);
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) console.error('Error signing out:', error);
    };

    const value = {
        session,
        user,
        profile,
        loading,
        signInWithGoogle,
        signOut,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
