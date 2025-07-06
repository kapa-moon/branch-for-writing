import { Mark } from '@tiptap/core';
import { Plugin } from 'prosemirror-state';

export interface CommentHighlightOptions {
  HTMLAttributes: Record<string, any>;
  onCommentClick?: (commentId: string) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commentHighlight: {
      setCommentHighlight: (attributes: { commentId: string }) => ReturnType;
      unsetCommentHighlight: () => ReturnType;
    };
  }
}

export const CommentHighlight = Mark.create<CommentHighlightOptions>({
  name: 'commentHighlight',

  addOptions() {
    return {
      HTMLAttributes: {},
      onCommentClick: undefined,
    };
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: element => element.getAttribute('data-comment-id'),
        renderHTML: attributes => {
          if (!attributes.commentId) {
            return {};
          }
          return {
            'data-comment-id': attributes.commentId,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-comment-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        ...this.options.HTMLAttributes,
        ...HTMLAttributes,
        class: 'comment-highlight',
        style: 'background-color: #e6f3ff; border-bottom: 2px solid #007bff; cursor: pointer; padding: 1px 2px; border-radius: 2px;',
      },
      0,
    ];
  },

  addCommands() {
    return {
      setCommentHighlight:
        attributes =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      unsetCommentHighlight:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: 'commentHighlightClick',
        props: {
          handleClick: (view, pos, event) => {
            try {
              const target = event.target as HTMLElement;
              const commentId = target.getAttribute('data-comment-id');
              
              if (commentId && this.options.onCommentClick) {
                this.options.onCommentClick(commentId);
                return true;
              }
              
              return false;
            } catch (error) {
              console.warn('Error in comment highlight click handler:', error);
              return false;
            }
          },
        },
      }),
    ];
  },
});

export default CommentHighlight; 