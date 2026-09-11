import React from 'react';
import { Heart, MessageCircle, Share2, Bookmark, Flag } from 'lucide-react';
import { formatNumber } from '../lib/formatting';
import { Video } from '../types';

interface VideoCardProps {
  video: Video;
  onPlay?: () => void;
  showCreator?: boolean;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, onPlay, showCreator = true }) => {
  return (
    <div
      onClick={onPlay}
      className="card-interactive group overflow-hidden"
    >
      {/* Thumbnail */}
      <div className="relative w-full aspect-video bg-black">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center">
            <svg className="w-8 h-8 text-dark ml-1" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-white line-clamp-2 mb-2 group-hover:text-primary transition-colors">
          {video.title}
        </h3>
        
        {showCreator && (
          <p className="text-sm text-gray-400 mb-3">
            Creator • {formatNumber(video.views)} views
          </p>
        )}

        <div className="flex items-center gap-4 text-gray-400 text-sm border-t border-border pt-3">
          <div className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer">
            <Heart size={16} />
            <span>{formatNumber(video.likes)}</span>
          </div>
          <div className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer">
            <MessageCircle size={16} />
            <span>{formatNumber(video.comments)}</span>
          </div>
          <div className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer">
            <Share2 size={16} />
          </div>
          <Bookmark size={16} className="ml-auto hover:text-primary transition-colors cursor-pointer" />
        </div>
      </div>
    </div>
  );
};
