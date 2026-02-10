import React from 'react';
import { Song } from '../types';
import { EditSongModal } from './EditSongModal';
import { useSongMetrics, SongMetric, ArtistMetric } from '../hooks/useSongMetrics';
import { Icons } from './ui/Icons';
import { formatDuration } from '../utils';

interface SongMetricsProps {
    activeBand: { id: string, name: string };
    onBack?: () => void;
    embedded?: boolean;
}

const COLORS = {
    indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20', bar: 'bg-indigo-500', shadow: 'shadow-indigo-500/50' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', bar: 'bg-purple-500', shadow: 'shadow-purple-500/50' },
    yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20', bar: 'bg-yellow-500', shadow: 'shadow-yellow-500/50' },
    green: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20', bar: 'bg-green-500', shadow: 'shadow-green-500/50' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20', bar: 'bg-cyan-500', shadow: 'shadow-cyan-500/50' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', bar: 'bg-blue-500', shadow: 'shadow-blue-500/50' },
    orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', bar: 'bg-orange-500', shadow: 'shadow-orange-500/50' },
    rose: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', bar: 'bg-rose-500', shadow: 'shadow-rose-500/50' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', bar: 'bg-emerald-500', shadow: 'shadow-emerald-500/50' },
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', bar: 'bg-violet-500', shadow: 'shadow-violet-500/50' },
};

type ColorKey = keyof typeof COLORS;

const MetricCard = ({ title, value, icon: Icon, color }: { title: string, value: number, icon: any, color: ColorKey }) => {
    const styles = COLORS[color];
    return (
        <div className="bg-[#121215]/60 backdrop-blur-md border border-white/5 rounded-xl p-4 flex items-center justify-between shadow-lg">
            <div>
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
                <p className="text-2xl font-bold text-white">{value}</p>
            </div>
            <div className={`p-3 rounded-full ${styles.bg} ${styles.text} ${styles.border}`}>
                <Icon size={24} />
            </div>
        </div>
    );
};

const SongListCard = ({ title, songs, maxCount, color, emptyMessage, onViewSong }: { title: string, songs: SongMetric[], maxCount: number, color: ColorKey, emptyMessage: string, onViewSong: (song: Song) => void }) => {
    const styles = COLORS[color];
    return (
        <div className="bg-[#121215]/60 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden shadow-lg flex flex-col h-full">
            <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <span className={`w-2 h-6 rounded-full ${styles.bar}`}></span>
                    {title}
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {songs.length === 0 ? (
                    <div className="h-40 flex flex-col items-center justify-center text-zinc-600 italic text-sm">
                        {emptyMessage}
                    </div>
                ) : (
                    songs.map((metric, index) => {
                        const percentage = maxCount > 0 ? (metric.playCount / maxCount) * 100 : 0;
                        return (
                            <div key={metric.song.id} className="relative group p-2 rounded-lg hover:bg-white/5 transition-colors">
                                <div className="flex items-center justify-between relative z-10 mb-1">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className={`text-xs font-mono font-bold w-6 text-center ${index < 3 ? styles.text : 'text-zinc-600'}`}>
                                            #{index + 1}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                                                {metric.song.title}
                                            </p>
                                            <p className="text-xs text-zinc-500 truncate">
                                                {metric.song.artist}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right pl-4">
                                        <span className={`text-sm font-bold ${styles.text}`}>{metric.playCount}</span>
                                        <span className="text-[10px] text-zinc-600 uppercase ml-1">Plays</span>
                                    </div>
                                </div>

                                {/* Progress Bar Background */}
                                <div className="absolute bottom-1 left-10 right-2 h-0.5 bg-zinc-800 rounded-full overflow-hidden opacity-30 group-hover:opacity-50 transition-all">
                                    <div
                                        className={`h-full ${styles.bar} shadow-[0_0_10px_rgba(255,255,255,0.2)]`}
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

const ArtistListCard = ({ title, artists, maxCount, color, emptyMessage }: { title: string, artists: ArtistMetric[], maxCount: number, color: ColorKey, emptyMessage: string }) => {
    const styles = COLORS[color];
    return (
        <div className="bg-[#121215]/60 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden shadow-lg flex flex-col h-full">
            <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <span className={`w-2 h-6 rounded-full ${styles.bar}`}></span>
                    {title}
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {artists.length === 0 ? (
                    <div className="h-40 flex flex-col items-center justify-center text-zinc-600 italic text-sm">
                        {emptyMessage}
                    </div>
                ) : (
                    artists.map((metric, index) => {
                        const percentage = maxCount > 0 ? (metric.playCount / maxCount) * 100 : 0;
                        return (
                            <div key={metric.artist} className="relative group p-2 rounded-lg hover:bg-white/5 transition-colors">
                                <div className="flex items-center justify-between relative z-10 mb-1">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className={`text-xs font-mono font-bold w-6 text-center ${index < 3 ? styles.text : 'text-zinc-600'}`}>
                                            #{index + 1}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                                                {metric.artist}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right pl-4">
                                        <span className={`text-sm font-bold ${styles.text}`}>{metric.playCount}</span>
                                        <span className="text-[10px] text-zinc-600 uppercase ml-1">Plays</span>
                                    </div>
                                </div>

                                {/* Progress Bar Background */}
                                <div className="absolute bottom-1 left-10 right-2 h-0.5 bg-zinc-800 rounded-full overflow-hidden opacity-30 group-hover:opacity-50 transition-all">
                                    <div
                                        className={`h-full ${styles.bar} shadow-[0_0_10px_rgba(255,255,255,0.2)]`}
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export const SongMetrics: React.FC<SongMetricsProps> = ({ activeBand, onBack, embedded = false }) => {
    const {
        topSongsAllTime,
        topSongs12Months,
        topSongs6Months,
        leastPlayedSongs,
        topArtistsAllTime,
        topArtists12Months,
        topArtists6Months,
        totalGigs,
        totalSongsTracker,
        loading,
        error
    } = useSongMetrics(activeBand.id);

    const [viewingSong, setViewingSong] = React.useState<Song | null>(null);

    if (loading) {
        return (
            <div id="song-metrics" className="flex items-center justify-center h-full text-zinc-500 animate-pulse flex-col gap-4 py-12">
                <Icons.BarChart size={48} className="opacity-50" />
                <p>Analyzing Performance Data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full text-red-400 flex-col gap-4">
                <Icons.Warning size={48} />
                <p>Error loading metrics: {error}</p>
                <button onClick={onBack} className="text-sm underline hover:text-white">Go Back</button>
            </div>
        );
    }

    const maxAllTime = topSongsAllTime[0]?.playCount || 0;
    const max12M = topSongs12Months[0]?.playCount || 0;
    const max6M = topSongs6Months[0]?.playCount || 0;
    const maxLeast = leastPlayedSongs[0]?.playCount || 0; // Likely 0 or low

    // Artist Max Counts
    const maxArtistAllTime = topArtistsAllTime[0]?.playCount || 0;
    const maxArtist12M = topArtists12Months[0]?.playCount || 0;
    const maxArtist6M = topArtists6Months[0]?.playCount || 0;

    return (
        <div
            id="song-metrics"
            className={`flex flex-col bg-black/95 text-white animate-fade-in relative ${embedded ? 'rounded-2xl border border-white/5 overflow-hidden' : 'h-full overflow-hidden'}`}
        >
            {/* Background Texture */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?auto=format&fit=crop&q=80')] opacity-5 bg-cover bg-center pointer-events-none"></div>

            {/* Header */}
            {!embedded ? (
                <header className="flex-none p-6 border-b border-white/5 bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-black backdrop-blur-xl z-20 flex justify-between items-center relative">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-all group"
                        >
                            <Icons.ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                                Song Analytics
                            </h1>
                            <p className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                Live Data for {activeBand.name}
                            </p>
                        </div>
                    </div>
                </header>
            ) : (
                <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                    <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 flex items-center gap-2">
                        <Icons.BarChart size={24} className="text-indigo-400" />
                        Song Metrics
                    </h2>
                </div>
            )}

            {/* Content */}
            <div className={`flex-1 overflow-y-auto w-full custom-scrollbar z-10 ${embedded ? 'p-0' : 'p-6'}`}>
                <div className="max-w-7xl mx-auto space-y-8 p-6">

                    {/* Stats Overview */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <MetricCard title="Total Gigs" value={totalGigs} icon={Icons.Mic} color="indigo" />
                        <MetricCard title="Unique Songs Played" value={totalSongsTracker} icon={Icons.Music} color="purple" />
                        <MetricCard title="Most Played (All Time)" value={maxAllTime} icon={Icons.Star} color="yellow" />
                        <MetricCard title="Active Songs" value={totalSongsTracker} icon={Icons.Check} color="green" /> {/* Fallback metric */}
                    </div>

                    {/* Top Songs Charts Grid */}
                    <div>
                        <h3 className="text-lg font-bold text-zinc-400 mb-4 flex items-center gap-2">
                            <Icons.Music size={18} /> Top Songs
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[500px]">
                            <SongListCard
                                title="Top 10 Songs (Last 6 Months)"
                                songs={topSongs6Months}
                                maxCount={max6M}
                                color="cyan"
                                emptyMessage="No gigs found in the last 6 months."
                                onViewSong={setViewingSong}
                            />
                            <SongListCard
                                title="Top 10 Songs (Last 12 Months)"
                                songs={topSongs12Months}
                                maxCount={max12M}
                                color="blue"
                                emptyMessage="No gigs found in the last 12 months."
                                onViewSong={setViewingSong}
                            />
                            <SongListCard
                                title="Top 10 Songs (All Time)"
                                songs={topSongsAllTime}
                                maxCount={maxAllTime}
                                color="indigo"
                                emptyMessage="No gigs found."
                                onViewSong={setViewingSong}
                            />
                        </div>
                    </div>

                    {/* Top Artists Charts Grid */}
                    <div>
                        <h3 className="text-lg font-bold text-zinc-400 mb-4 flex items-center gap-2">
                            <Icons.Users size={18} /> Top Bands
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[500px]">
                            <ArtistListCard
                                title="Top 10 Bands (Last 6 Months)"
                                artists={topArtists6Months}
                                maxCount={maxArtist6M}
                                color="rose"
                                emptyMessage="No data found."
                            />
                            <ArtistListCard
                                title="Top 10 Bands (Last 12 Months)"
                                artists={topArtists12Months}
                                maxCount={maxArtist12M}
                                color="violet"
                                emptyMessage="No data found."
                            />
                            <ArtistListCard
                                title="Top 10 Bands (All Time)"
                                artists={topArtistsAllTime}
                                maxCount={maxArtistAllTime}
                                color="emerald"
                                emptyMessage="No data found."
                            />
                        </div>
                    </div>


                    {/* Least Played Row */}
                    <div className="min-h-[400px]">
                        <h3 className="text-lg font-bold text-zinc-400 mb-4 flex items-center gap-2">
                            <Icons.TrendingDown size={18} /> Cold Cuts
                        </h3>
                        <SongListCard
                            title="Least Played Songs (Bottom 10)"
                            songs={leastPlayedSongs}
                            maxCount={maxLeast || 5}
                            color="orange"
                            emptyMessage="All songs have been played!"
                            onViewSong={setViewingSong}
                        />
                    </div>
                </div>
            </div>

            {/* View Only Modal */}
            {viewingSong && (
                <EditSongModal
                    song={viewingSong}
                    isOpen={!!viewingSong}
                    mode="view"
                    onClose={() => setViewingSong(null)}
                    onSave={() => { }} // No-op for view mode
                    bandId={activeBand.id}
                />
            )}
        </div>
    );
};
