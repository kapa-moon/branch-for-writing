'use client';

import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import { Editor } from '@tiptap/core';
import { TiptapDocument } from '@/types/tiptap';

interface TiptapEditorProps {
  initialContent: TiptapDocument | null;
  onContentChange: (content: TiptapDocument) => void;
  onTextSelection?: (selectedText: string) => void;
  isEditable?: boolean;
  editorRef?: React.MutableRefObject<Editor | null>;
}

const TiptapEditor = ({ initialContent, onContentChange, onTextSelection, isEditable = true, editorRef }: TiptapEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({
        multicolor: true,
      }),
      Placeholder.configure({
        placeholder: isEditable ? 'please start writing here' : 'Reviewing version...',
      }),
    ],
    content: initialContent,
    editable: isEditable,
    onUpdate: ({ editor: currentEditor }) => {
      if (isEditable) {
        onContentChange(currentEditor.getJSON() as TiptapDocument);
      }
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      if (onTextSelection && isEditable) {
        const { from, to } = currentEditor.state.selection;
        
        if (from !== to) {
          const selectedText = currentEditor.state.doc.textBetween(from, to, ' ');
          
          if (selectedText.trim().length > 3) {
            onTextSelection(selectedText.trim());
          }
        }
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none p-4 border border-gray-300 rounded-md min-h-[200px]',
      },
    },
  });

  // Expose editor instance to parent via ref
  useEffect(() => {
    if (editorRef) {
      editorRef.current = editor;
    }
  }, [editor, editorRef]);

  return (
    <EditorContent editor={editor} />
  );
};

export default TiptapEditor;
