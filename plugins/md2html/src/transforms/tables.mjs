// Every <table> is framed in <div class="tbl"> (rounded border, horizontal scroll on phones).
export function tables(tree) {
  const walk = (parent) => {
    if (!parent.children) return;
    parent.children = parent.children.map((node) => {
      walk(node);
      return node.type === 'element' && node.tagName === 'table'
        ? { type: 'element', tagName: 'div', properties: { className: ['tbl'] }, children: [node] }
        : node;
    });
  };
  walk(tree);
  return tree;
}
