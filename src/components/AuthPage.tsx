import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Icons } from './ui/Icons';

export const AuthPage = () => {
    const { signIn, signUpInitiate, signUpComplete, resetPasswordInitiate, resetPasswordComplete } = useAuth();
    const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form States
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [signUpStep, setSignUpStep] = useState<1 | 2>(1);

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const { error } = await signIn(email, password);
        if (error) setError(error);
        setLoading(false);
    };

    const handleSignUpStep1 = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const { error } = await signUpInitiate(email);
        if (error) {
            setError(error);
        } else {
            setSignUpStep(2);
        }
        setLoading(false);
    };

    const handleSignUpStep2 = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const { error } = await signUpComplete(email, code, password);
        if (error) {
            setError(error);
        }
        setLoading(false);
    };

    const handleResetStep1 = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const { error } = await resetPasswordInitiate(email);
        if (error) {
            setError(error);
        } else {
            setSignUpStep(2);
        }
        setLoading(false);
    };

    const handleResetStep2 = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const { error } = await resetPasswordComplete(email, code, password);
        if (error) {
            setError(error);
        } else {
            setMode('signin');
            setError('Password reset successfully. Please sign in with your new password.');
            setPassword('');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#18181b] border border-white/10 rounded-2xl p-8 shadow-2xl">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/20">
                        <Icons.Music size={32} className="text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                        Band Setlist Manager
                    </h1>
                    <p className="text-zinc-500 mt-2 text-sm">
                        {mode === 'signin' ? 'Welcome back! Please sign in.' : mode === 'signup' ? 'Create an account to get started.' : 'Reset your password.'}
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
                        <Icons.Warning size={16} />
                        {error}
                    </div>
                )}

                {mode === 'signin' ? (
                    <form onSubmit={handleSignIn} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Email</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full bg-[#09090b] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                                placeholder="name@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Password</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-[#09090b] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="text-right">
                            <button
                                type="button"
                                onClick={() => {
                                    setMode('reset');
                                    setError(null);
                                    setSignUpStep(1);
                                    setEmail('');
                                    setCode('');
                                    setPassword('');
                                }}
                                className="text-xs text-primary hover:text-primary/80 transition-colors"
                            >
                                Forgot Password?
                            </button>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>
                ) : mode === 'signup' ? (
                    <div className="space-y-4">
                        {signUpStep === 1 ? (
                            <form onSubmit={handleSignUpStep1} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="w-full bg-[#09090b] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                                        placeholder="name@example.com"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Sending Code...' : 'Send Verification Code'}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleSignUpStep2} className="space-y-4">
                                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-xs mb-4">
                                    We sent a verification code to <strong>{email}</strong>.
                                    <br />(Please check your inbox and spam folder)
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Verification Code</label>
                                    <input
                                        type="text"
                                        required
                                        value={code}
                                        onChange={e => setCode(e.target.value)}
                                        className="w-full bg-[#09090b] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors font-mono tracking-widest text-center"
                                        placeholder="123456"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Set Password</label>
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full bg-[#09090b] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                                        placeholder="New Password"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-green-600 hover:bg-green-500 text-white font-medium py-3 rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Creating Account...' : 'Create Account'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSignUpStep(1)}
                                    className="w-full text-zinc-500 hover:text-white text-sm py-2 transition-colors"
                                >
                                    Back to Email
                                </button>
                            </form>
                        )}
                    </div>
                ) : (
                    // RESET PASSWORD MODE
                    <div className="space-y-4">
                        {signUpStep === 1 ? (
                            <form onSubmit={handleResetStep1} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="w-full bg-[#09090b] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                                        placeholder="name@example.com"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-orange-600 hover:bg-orange-500 text-white font-medium py-3 rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Sending Code...' : 'Send Reset Code'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('signin')}
                                    className="w-full text-zinc-500 hover:text-white text-sm py-2 transition-colors"
                                >
                                    Back to Sign In
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleResetStep2} className="space-y-4">
                                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-xs mb-4">
                                    We sent a reset code to <strong>{email}</strong>.
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Reset Code</label>
                                    <input
                                        type="text"
                                        required
                                        value={code}
                                        onChange={e => setCode(e.target.value)}
                                        className="w-full bg-[#09090b] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors font-mono tracking-widest text-center"
                                        placeholder="123456"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">New Password</label>
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full bg-[#09090b] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                                        placeholder="New Password"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-orange-600 hover:bg-orange-500 text-white font-medium py-3 rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Resetting...' : 'Reset Password'}
                                </button>
                            </form>
                        )}
                    </div>
                )}

                <div className="mt-6 pt-6 border-t border-white/10 text-center">
                    <p className="text-zinc-500 text-sm">
                        {mode === 'signin' ? "Don't have an account?" : "Already have an account?"}
                        <button
                            onClick={() => {
                                setMode(mode === 'signin' ? 'signup' : 'signin');
                                setError(null);
                                setSignUpStep(1);
                                setEmail('');
                                setPassword('');
                                setCode('');
                            }}
                            className="ml-2 text-primary hover:text-primary/80 font-medium transition-colors"
                        >
                            {mode === 'signin' ? 'Sign Up' : 'Sign In'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};
