export interface TiptapMark {
  type: string;
  attrs?: Record<string, any>; // Tiptap's internal type uses 'any' here
  [key: string]: any; // To match Tiptap's expectation of { [key: string]: any; ... }
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: TiptapMark[];
}

export interface TiptapDocument {
  type: 'doc';
  content: TiptapNode[];
} 