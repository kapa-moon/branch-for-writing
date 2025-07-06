'use client';

import React from 'react';

interface CommentTooltipProps {
  position: { x: number; y: number } | null;
  onAddComment: () => void;
  onClose: () => void;
}

const CommentTooltip: React.FC<CommentTooltipProps> = ({
  position,
  onAddComment,
  onClose
}) => {
  if (!position) return null;

  return (
    <div 
      className="comment-tooltip"
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y - 40, // Position above the selection
        zIndex: 1000,
        background: '#2d3748',
        color: 'white',
        padding: '6px 8px',
        borderRadius: '4px',
        fontSize: '0.75rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        whiteSpace: 'nowrap'
      }}
    >
      <button
        onClick={onAddComment}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          fontSize: '0.75rem',
          padding: '2px 4px',
          borderRadius: '2px',
          transition: 'background 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        💬 Add comment
      </button>
      
      {/* Arrow pointing down */}
      <div
        style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: '6px solid #2d3748'
        }}
      />
    </div>
  );
};

export default CommentTooltip; 