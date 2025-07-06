export interface UserComment {
  id: string;
  text: string;
  selectedText: string;
  authorName: string;
  authorEmail: string;
  createdAt: Date;
  resolved: boolean;
  position: {
    from: number;
    to: number;
  };
}

export interface CommentThread {
  id: string;
  comments: UserComment[];
  selectedText: string;
  position: {
    from: number;
    to: number;
  };
  resolved: boolean;
} 