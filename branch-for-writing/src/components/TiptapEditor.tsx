'use client';

import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

interface TiptapEditorProps {
  initialContent: any;
  onContentChange: (content: any) => void;
  isEditable?: boolean;
}

const TiptapEditor = ({ initialContent, onContentChange, isEditable = true }: TiptapEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: isEditable ? 'please start writing here' : 'Reviewing version...',
      }),
    ],
    content: initialContent,
    editable: isEditable,
    onUpdate: ({ editor: currentEditor }) => {
      if (isEditable) {
        onContentChange(currentEditor.getJSON());
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none p-4 border border-gray-300 rounded-md min-h-[200px]',
      },
    },
  });

  return (
    <EditorContent editor={editor} />
  );
};

export default TiptapEditor;
