
import React from 'react';
import { StickerImage, UITheme } from '../types';

interface ImageCardProps {
  image: StickerImage;
  isActive: boolean;
  onClick: () => void;
  theme?: UITheme;
}

export const ImageCard: React.FC<ImageCardProps> = ({ 
  image, 
  isActive, 
  onClick,
  theme,
}) => {
  const borderColor = isActive ? 'border-[#007fd4] ring-1 ring-[#007fd4]/50' : 'border-[#3e3e42] hover:border-[#505050]';
  const bg = isActive ? 'bg-[#252526]' : 'bg-[#1e1e1e]';

  return (
    <div 
      onClick={onClick}
      className={`group relative w-20 h-20 shrink-0 border cursor-pointer transition-all duration-100 overflow-hidden ${borderColor} ${bg}`}
    >
      <div className="absolute inset-0 bg-checkered-dark opacity-20"></div>
      
      <img 
          src={image.url} 
          alt={image.name} 
          className="relative z-10 w-full h-full object-contain p-1" 
          loading="lazy"
      />
      
      {image.name.includes('Sheet') && (
        <div className="absolute top-0 right-0 bg-[#007fd4] text-[10px] font-bold px-1 text-white z-20">SHEET</div>
      )}
      {image.isPreview && (
        <div className="absolute top-0 left-0 bg-[#D19A66] text-[10px] font-bold px-1 text-[#1e1e1e] z-20">DRAFT</div>
      )}
    </div>
  );
};
