export interface TiptapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TiptapNode[];
  text?: string;
  marks?: any[]; // You can define a more specific mark type if needed
}

export interface TiptapDocument {
  type: 'doc';
  content: TiptapNode[];
} 