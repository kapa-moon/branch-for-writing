'use client';

import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
// @ts-ignore - type declarations may be missing but runtime is available
import Underline from '@tiptap/extension-underline';
import { Editor } from '@tiptap/core';
import { TiptapDocument } from '@/types/tiptap';
import './tiptap-editor.css';

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
      Underline,
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
    <div className="tiptap-editor-wrapper">
      {isEditable && editor && (
        <div className="editor-menu-bar">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive('bold') ? 'active' : ''}
            title="Bold"
          >
            <strong>B</strong>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive('italic') ? 'active' : ''}
            title="Italic"
          >
            <em>I</em>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={editor.isActive('strike') ? 'active' : ''}
            title="Strike"
          >
            <span style={{ textDecoration: 'line-through' }}>S</span>
          </button>
          <button
            // @ts-ignore - toggleUnderline provided by Underline extension
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={editor.isActive('underline') ? 'active' : ''}
            title="Underline"
          >
            <span style={{ textDecoration: 'underline' }}>U</span>
          </button>
          <button
            onClick={() => editor.chain().focus().setHighlight({ color: '#ffffcc' }).run()}
            title="Highlight Yellow"
            className={editor.isActive('highlight', { color: '#ffffcc' }) ? 'active' : ''}
            style={{ backgroundColor: '#ffffcc' }}
          >
            Y
          </button>
          <button
            onClick={() => editor.chain().focus().setHighlight({ color: '#ffe6ff' }).run()}
            title="Highlight Pink"
            className={editor.isActive('highlight', { color: '#ffe6ff' }) ? 'active' : ''}
            style={{ backgroundColor: '#ffe6ff' }}
          >
            P
          </button>
          <button
            onClick={() => editor.chain().focus().unsetHighlight().run()}
            title="Clear Highlight"
          >
            Clear
          </button>
        </div>
      )}
      <div className="editor-content-wrapper">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default TiptapEditor;
