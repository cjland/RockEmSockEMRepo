import React, { useState, useMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Song, SetList } from '../types';
import { Icons } from './ui/Icons';
import { formatDuration, generateCSV } from '../utils';

interface SongLibraryProps {
  songs: Song[];
  sets: SetList[]; // Add sets to props interface
  usedInSetsMap: Record<string, { name: string, index: number }[]>;
  onPlaySong: (song: Song) => void;
  onUpdateSong: (song: Song) => void;
  onEditSong: (song: Song) => void;
  onAddToSet: (song: Song, targetSetId?: string) => void;
  onManageSongs: () => void;
  viewOptions: { showRatings: boolean, showLiveBadges: boolean };
}

const RatingStars = ({ count }: { count?: number }) => (
  <div className="flex text-yellow-500">
    {[1, 2, 3, 4, 5].map((i) => (
      <Icons.Star
        key={i}
        size={10}
        className={i <= (count || 0) ? 'fill-current drop-shadow-sm' : 'text-zinc-700 fill-zinc-800'}
      />
    ))}
  </div>
);

interface DraggableLibrarySongProps {
  song: Song;
  sets: SetList[];
  usedInSets: { name: string, index: number }[];
  viewOptions: { showRatings: boolean, showLiveBadges: boolean };
  onAddToSet: (song: Song, setId?: string) => void;
  onPlaySong: (song: Song) => void;
  onEditSong: (song: Song) => void;
}

const DraggableLibrarySong: React.FC<DraggableLibrarySongProps> = ({
  song,
  sets = [],
  usedInSets = [],
  viewOptions,
  onAddToSet,
  onPlaySong,
  onEditSong
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib-${song.id}`,
    data: { type: 'LIBRARY_SONG', data: song },
  });

  const isUsed = usedInSets && usedInSets.length > 0;
  // Use practice status for stripe
  const isPractice = song.practiceStatus === 'Practice';

  return (
    <div
      ref={setNodeRef}
      className={`group relative p-3 rounded-lg border transition-all mb-2 overflow-hidden backdrop-blur-sm
        ${isUsed
          ? 'bg-black/60 border-white/5 opacity-70 grayscale-[0.5]'
          : 'bg-zinc-800/40 border-white/5 hover:border-primary/40 hover:bg-zinc-800/60 shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5'
        }
        ${isDragging ? 'opacity-50 grayscale scale-95' : ''}
      `}
    >
      <div className="flex items-start justify-between mt-1">
        <div className="flex-1 min-w-0 pr-2">
          {/* Title & Grip */}
          <div className="flex items-center gap-2 mb-1">
            <div
              {...listeners}
              {...attributes}
              className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300 transition-colors"
            >
              <Icons.Grip size={14} />
            </div>
            <div className={`font-semibold text-sm truncate flex items-center gap-2 ${isUsed ? 'text-zinc-500' : 'text-zinc-200 group-hover:text-white transition-colors'}`}>
              {song.title}
              {song.practiceStatus === 'Ready' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" title="Ready"></span>}
            </div>
          </div>

          {/* Artist */}
          <div className="text-xs text-zinc-500 truncate pl-6 mb-1 group-hover:text-zinc-400 transition-colors">{song.artist}</div>

          {/* Song Notes */}
          {song.generalNotes && (
            <div className="text-[10px] text-yellow-500/80 italic pl-6 mb-2 truncate group-hover:text-yellow-400 transition-colors">
              <span className="opacity-50 mr-1">📝</span>{song.generalNotes}
            </div>
          )}

          {!song.generalNotes && <div className="mb-2"></div>}

          {/* Badges/Metadata */}
          <div className="pl-6 flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-mono bg-black/40 px-1.5 py-0.5 rounded text-zinc-400 border border-white/5">
              {formatDuration(song.durationSeconds)}
            </span>

            {viewOptions.showRatings && (
              <div className="flex items-center gap-1 bg-black/20 px-1.5 py-0.5 rounded border border-white/5" title="Rating">
                <RatingStars count={song.rating} />
              </div>
            )}

            {isPractice && (
              <span className="text-[10px] font-bold text-red-500 flex items-center gap-1 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 animate-pulse">
                <Icons.Warning size={10} /> Practice
              </span>
            )}

            {viewOptions.showLiveBadges && song.playedLive && (
              <span className="text-[10px] font-bold text-green-500 flex items-center gap-1 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]">
                <Icons.Check size={8} /> Live
              </span>
            )}
          </div>

          {/* Used In Sets Badges */}
          {isUsed && (
            <div className="pl-6 mt-2 flex flex-wrap gap-1">
              {usedInSets.map((setInfo, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/20 text-indigo-400 border border-primary/20">
                  Set {setInfo.index + 1}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions Column */}
        <div className="flex flex-col gap-1 shrink-0 transition-opacity duration-200 w-[68px] items-end">
          {/* Add Buttons Grid */}
          <div className="grid grid-cols-2 gap-1 w-full justify-items-end">
            {sets.length > 0 ? (
              sets.map((set, index) => (
                <button
                  key={set.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToSet(song, set.id);
                  }}
                  className="px-1 py-1 rounded-md text-[9px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 hover:border-green-500/30 transition-all hover:scale-105 flex items-center justify-between w-full whitespace-nowrap gap-1 shadow-[0_0_10px_rgba(34,197,94,0.1)]"
                  title={`Add to ${set.name}`}
                  style={{ color: set.color }}
                >
                  <span>S{index + 1}</span>
                  <Icons.Plus size={10} className="text-green-400" />
                </button>
              ))
            ) : (
              <div className="col-span-2 flex justify-end">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToSet(song);
                  }}
                  className="p-1 rounded-md hover:bg-white/10 text-zinc-500 hover:text-primary transition-all hover:scale-110"
                  title="Add to New Set"
                >
                  <Icons.Plus size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Action Icons Row */}
          <div className="flex gap-1 justify-end mt-0.5">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPlaySong(song); }}
              className="p-1 rounded-md hover:bg-white/10 text-zinc-500 hover:text-red-400 transition-all hover:scale-110"
              title="Play Video"
            >
              <Icons.Play size={14} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEditSong(song); }}
              className="p-1 rounded-md hover:bg-white/10 text-zinc-500 hover:text-blue-400 transition-all hover:scale-110"
              title="Details & Edit"
            >
              <Icons.Info size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SongLibrary: React.FC<SongLibraryProps> = ({
  songs = [],
  sets = [],
  usedInSetsMap = {},
  onPlaySong,
  onUpdateSong,
  onEditSong,
  onAddToSet,
  onManageSongs,
  viewOptions
}) => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'title-asc' | 'title-desc' | 'artist-asc' | 'artist-desc' | 'duration-asc' | 'duration-desc' | 'rating-asc' | 'rating-desc'>('title-asc');

  // New Filters
  const [hideUsed, setHideUsed] = useState(false);
  const [hidePractice, setHidePractice] = useState(false);

  // Counters
  const totalSongs = songs.length;
  // Calculate used based on if it exists in usedInSetsMap
  const usedSongsCount = songs.filter(s => usedInSetsMap[s.id] && usedInSetsMap[s.id].length > 0).length;


  const filteredSongs = useMemo(() => {
    let result = songs.filter(s => {
      const searchLower = search.toLowerCase();
      const matchesSearch = s.title.toLowerCase().includes(searchLower) || s.artist.toLowerCase().includes(searchLower);

      const isUsed = usedInSetsMap[s.id] && usedInSetsMap[s.id].length > 0;
      if (hideUsed && isUsed) return false;

      const isPractice = s.practiceStatus === 'Practice';
      if (hidePractice && isPractice) return false;

      return matchesSearch;
    });

    return result.sort((a, b) => {
      switch (sortBy) {
        case 'title-asc': return a.title.localeCompare(b.title);
        case 'title-desc': return b.title.localeCompare(a.title);
        case 'artist-asc': return a.artist.localeCompare(b.artist);
        case 'artist-desc': return b.artist.localeCompare(a.artist);
        case 'rating-desc': return (b.rating || 0) - (a.rating || 0);
        case 'rating-asc': return (a.rating || 0) - (b.rating || 0);
        case 'duration-asc': return a.durationSeconds - b.durationSeconds;
        case 'duration-desc': return b.durationSeconds - a.durationSeconds;
        default: return 0;
      }
    });
  }, [songs, search, sortBy, hideUsed, hidePractice, usedInSetsMap]);

  const handleExport = () => {
    const csvContent = generateCSV(songs);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "library_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/40 border-r border-white/5 w-[380px] shrink-0 backdrop-blur-md">
      <div className="p-4 border-b border-white/5 space-y-4 bg-zinc-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 tracking-tight">Library</h2>
            <span className="text-[10px] font-bold bg-zinc-800/80 text-zinc-400 px-2 py-0.5 rounded-full border border-white/5" title="Used / Total">
              {usedSongsCount}/{totalSongs} Used
            </span>
          </div>

          <div className="flex items-center gap-2 relative">
            <button
              onClick={handleExport}
              className="p-2 text-zinc-500 hover:text-green-500 transition-colors hover:bg-white/5 rounded-full"
              title="Export to CSV"
            >
              <Icons.Sheet size={16} />
            </button>
            {/* Gear Menu removed - controlled globally */}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <button
            onClick={() => setHideUsed(!hideUsed)}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-all ${hideUsed ? 'bg-primary/20 border-primary/50 text-indigo-300' : 'bg-black/20 border-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}
          >
            {hideUsed ? 'Hide Added: ON' : 'Hide Added'}
          </button>
          <button
            onClick={() => setHidePractice(!hidePractice)}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-all ${hidePractice ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300' : 'bg-black/20 border-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}
          >
            {hidePractice ? 'Hide Practice: ON' : 'Hide Practice'}
          </button>
        </div>

        {/* Search & Filter Inputs */}
        <div className="grid grid-cols-2 gap-2">
          <div className="relative col-span-2">
            <Icons.Music className="absolute left-3 top-2.5 text-zinc-500" size={14} />
            <input
              type="text"
              placeholder="Search Title or Artist..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-primary/50 focus:bg-black/40 transition-all font-medium"
            />
          </div>

          <div className="relative col-span-1">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-zinc-800 border border-white/10 rounded-lg py-2 px-2 text-xs text-zinc-300 focus:outline-none focus:border-primary/50 focus:bg-black/40 appearance-none transition-all cursor-pointer"
            >
              <option value="title-asc">Title (A-Z)</option>
              <option value="title-desc">Title (Z-A)</option>
              <option value="artist-asc">Artist (A-Z)</option>
              <option value="artist-desc">Artist (Z-A)</option>
              <option value="rating-desc">Rating (High to Low)</option>
              <option value="rating-asc">Rating (Low to High)</option>
              <option value="duration-asc">Time (Shortest)</option>
              <option value="duration-desc">Time (Longest)</option>
            </select>
            <Icons.Sort className="absolute right-2 top-2.5 text-zinc-500 pointer-events-none" size={12} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        {filteredSongs.length === 0 ? (
          <div className="text-center p-8 text-zinc-600 flex flex-col items-center animate-fade-in">
            <Icons.Music size={32} className="opacity-20 mb-3" />
            <p className="text-sm font-medium mb-1">No songs found.</p>
            {songs.length === 0 ? (
              <div className="mt-4 flex flex-col items-center">
                <p className="text-xs text-zinc-500 mb-3 max-w-[200px] leading-relaxed">
                  Your library is empty. Add songs to your Master Library to start building sets.
                </p>
                <button
                  onClick={onManageSongs}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold transition-all border border-white/5 hover:border-white/10"
                >
                  <Icons.Music size={12} />
                  Go to Master Library
                </button>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 mt-2">Try adjusting your search or filters.</p>
            )}
          </div>
        ) : (
          filteredSongs.map(song => (
            <DraggableLibrarySong
              key={song.id}
              song={song}
              sets={sets}
              usedInSets={usedInSetsMap[song.id] || []}
              isUsed={!!usedInSetsMap[song.id]}
              viewOptions={viewOptions}
              onAddToSet={onAddToSet}
              onPlaySong={onPlaySong}
              onEditSong={onEditSong}
            />
          ))
        )}
      </div>
    </div>
  );
};
