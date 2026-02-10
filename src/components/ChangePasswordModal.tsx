
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Icons } from './ui/Icons';

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
    const { user, changePassword, resetPasswordInitiate, resetPasswordComplete } = useAuth();
    const [mode, setMode] = useState<'change' | 'reset_init' | 'reset_verify'>('change');

    // Change Mode State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');

    // Reset Mode State
    const [resetCode, setResetCode] = useState('');
    const [resetNewPassword, setResetNewPassword] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    if (!isOpen) return null;

    const resetState = () => {
        setMode('change');
        setCurrentPassword('');
        setNewPassword('');
        setResetCode('');
        setResetNewPassword('');
        setError(null);
        setSuccess(false);
        setLoading(false);
    }

    const handleClose = () => {
        resetState();
        onClose();
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const { error } = await changePassword(currentPassword, newPassword);
        if (error) {
            setError(error);
            setLoading(false);
        } else {
            setSuccess(true);
            setLoading(false);
            setTimeout(handleClose, 1500);
        }
    };

    const handleResetInitiate = async () => {
        if (!user?.email) return;
        setLoading(true);
        setError(null);
        const { error } = await resetPasswordInitiate(user.email);
        if (error) {
            setError(error);
        } else {
            setMode('reset_verify');
        }
        setLoading(false);
    };

    const handleResetComplete = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.email) return;
        setLoading(true);
        setError(null);

        const { error } = await resetPasswordComplete(user.email, resetCode, resetNewPassword);
        if (error) {
            setError(error);
            setLoading(false);
        } else {
            setSuccess(true);
            setLoading(false);
            setTimeout(handleClose, 1500);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[#121215]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl w-full max-w-md ring-1 ring-white/5">
                <div className="p-4 border-b border-white/5 bg-zinc-900 flex justify-between items-center">
                    <h3 className="font-semibold text-white">
                        {mode === 'change' ? 'Change Password' : 'Reset Password'}
                    </h3>
                    <button onClick={handleClose}><Icons.Close size={20} className="text-zinc-500 hover:text-white" /></button>
                </div>

                <div className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
                            Password updated successfully!
                        </div>
                    )}

                    {!success && (
                        <>
                            {mode === 'change' && (
                                <form onSubmit={handleChangePassword} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Current Password</label>
                                        <input
                                            type="password"
                                            required
                                            value={currentPassword}
                                            onChange={e => setCurrentPassword(e.target.value)}
                                            className="w-full bg-[#09090b] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors text-white"
                                            placeholder="Current Password"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">New Password</label>
                                        <input
                                            type="password"
                                            required
                                            minLength={6}
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            className="w-full bg-[#09090b] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors text-white"
                                            placeholder="New Password"
                                        />
                                    </div>

                                    <div className="flex justify-between items-center pt-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMode('reset_init');
                                                setError(null);
                                            }}
                                            className="text-xs text-primary hover:text-primary/80 transition-colors"
                                        >
                                            Forgot Password?
                                        </button>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={handleClose}
                                                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg transition-all disabled:opacity-50"
                                            >
                                                {loading ? 'Updating...' : 'Update'}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            )}

                            {mode === 'reset_init' && (
                                <div className="space-y-4">
                                    <p className="text-sm text-zinc-400">
                                        We can send a verification code to your email <strong>{user?.email}</strong> to reset your password.
                                    </p>
                                    <div className="flex justify-end gap-2 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setMode('change')}
                                            className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                                        >
                                            Back
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleResetInitiate}
                                            disabled={loading}
                                            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
                                        >
                                            {loading ? 'Sending...' : 'Send Reset Code'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {mode === 'reset_verify' && (
                                <form onSubmit={handleResetComplete} className="space-y-4">
                                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-xs mb-4">
                                        Code sent to <strong>{user?.email}</strong>.
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Reset Code</label>
                                        <input
                                            type="text"
                                            required
                                            value={resetCode}
                                            onChange={e => setResetCode(e.target.value)}
                                            className="w-full bg-[#09090b] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors font-mono tracking-widest text-center"
                                            placeholder="123456"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">New Password</label>
                                        <input
                                            type="password"
                                            required
                                            minLength={6}
                                            value={resetNewPassword}
                                            onChange={e => setResetNewPassword(e.target.value)}
                                            className="w-full bg-[#09090b] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors text-white"
                                            placeholder="New Password"
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setMode('change')}
                                            className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
                                        >
                                            {loading ? 'Resetting...' : 'Reset Password'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
