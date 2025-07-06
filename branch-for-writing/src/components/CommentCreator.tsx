'use client';

import React, { useState, useRef, useEffect } from 'react';
import { UserComment } from '@/types/comments';

interface CommentCreatorProps {
  selectedText: string;
  onCreateComment: (commentText: string) => void;
  onCancel: () => void;
  position: { x: number; y: number } | null;
  authorName: string;
  authorEmail: string;
}

const CommentCreator: React.FC<CommentCreatorProps> = ({
  selectedText,
  onCreateComment,
  onCancel,
  position,
  authorName,
  authorEmail
}) => {
  const [commentText, setCommentText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current && position) {
      textareaRef.current.focus();
    }
  }, [position]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (commentText.trim()) {
      onCreateComment(commentText.trim());
      setCommentText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (!position) return null;

  return (
    <div 
      className="comment-creator-popup"
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: 1000,
        background: 'white',
        border: '1px solid #e9ecef',
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        minWidth: '300px',
        maxWidth: '400px'
      }}
    >
      <div style={{ fontSize: '0.7rem', color: '#666', marginBottom: '8px' }}>
        Commenting on: "<em>{selectedText.length > 50 ? selectedText.substring(0, 50) + '...' : selectedText}</em>"
      </div>
      
      <form onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment..."
          style={{
            width: '100%',
            minHeight: '60px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: '8px',
            fontSize: '0.8rem',
            fontFamily: 'Atkinson Hyperlegible, serif',
            resize: 'vertical',
            outline: 'none'
          }}
        />
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginTop: '8px' 
        }}>
          <div style={{ fontSize: '0.65rem', color: '#999' }}>
            {authorName} • Cmd+Enter to post
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '4px 12px',
                fontSize: '0.7rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                background: 'white',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!commentText.trim()}
              style={{
                padding: '4px 12px',
                fontSize: '0.7rem',
                border: '1px solid #007bff',
                borderRadius: '4px',
                background: commentText.trim() ? '#007bff' : '#ccc',
                color: 'white',
                cursor: commentText.trim() ? 'pointer' : 'not-allowed'
              }}
            >
              Comment
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CommentCreator; 