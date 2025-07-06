'use client';

import React from 'react';
import { TiptapDocument } from '@/types/tiptap';
import TiptapEditor from '@/components/TiptapEditor';
import './diff-editor.css';

interface DiffTiptapEditorProps {
  originalContent: TiptapDocument;
  comparisonContent: TiptapDocument;
  onMergeSegments: (selectedSegmentIds: string[]) => void;
  onHighlightText?: (text: string) => void;
  mainDocId?: string;
  refDocId?: string;
}

const DiffTiptapEditor: React.FC<DiffTiptapEditorProps> = ({ 
  originalContent, 
  comparisonContent, 
  onMergeSegments,
  onHighlightText,
  mainDocId,
  refDocId
}) => {
  return (
    <div className="reference-document-container">
      <div className="document-content">
        <TiptapEditor 
          initialContent={comparisonContent}
          onContentChange={() => {}} // Read-only
          isEditable={false}
        />
      </div>
    </div>
  );
};

export default DiffTiptapEditor; 