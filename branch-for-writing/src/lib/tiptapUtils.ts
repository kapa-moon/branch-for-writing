export const filterTiptapContentForSupporter = (doc: any): any => {
  if (!doc || !doc.content) {
    return doc; // Return original if it's not a valid Tiptap doc structure
  }

  const filterNodes = (nodes: any[]): any[] => {
    if (!Array.isArray(nodes)) {
      return [];
    }
    return nodes.reduce((acc: any[], node: any) => {
      // Check if the node itself is shared (default to true if attribute is missing)
      const isNodeShared = node.attrs?.isShared !== false;

      if (isNodeShared) {
        // If node is shared, keep it and recursively filter its children if it has content
        const newNode = { ...node };
        if (node.content) {
          newNode.content = filterNodes(node.content);
        }
        acc.push(newNode);
      }
      // If node is not shared, it's excluded, along with its children
      return acc;
    }, []);
  };

  return {
    ...doc,
    content: filterNodes(doc.content),
  };
}; 