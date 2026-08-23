import { describe, it, expect } from 'vitest';

function buildCategoryChain(currentCat: any, allCats: any[]): string {
  if (!currentCat) return "Uncategorized";

  const chain: string[] = [];
  let curr: any = currentCat;
  if (allCats && allCats.length > 0) {
    const found = allCats.find((c: any) => String(c.id) === String(curr.id));
    if (found) curr = found;
  }

  const visited = new Set<string>();
  while (curr && !visited.has(String(curr.id))) {
    visited.add(String(curr.id));
    chain.unshift(curr.title);
    if (curr.parent_id && allCats && allCats.length > 0) {
      curr = allCats.find((c: any) => String(c.id) === String(curr.parent_id));
    } else {
      curr = null;
    }
  }

  return chain.length > 0 ? chain.join(", ") : (currentCat.title || "Uncategorized");
}

describe('Category Chain Helper', () => {
  const categories = [
    { id: '1', title: 'Passives', parent_id: null },
    { id: '2', title: 'Resistors', parent_id: '1' },
    { id: '3', title: '0805', parent_id: '2' },
    { id: '4', title: 'Semiconductors', parent_id: null }
  ];

  it('should return Uncategorized when current category is null', () => {
    expect(buildCategoryChain(null, categories)).toBe('Uncategorized');
  });

  it('should return single root category name for root category', () => {
    const rootCat = { id: '4', title: 'Semiconductors', parent_id: null };
    expect(buildCategoryChain(rootCat, categories)).toBe('Semiconductors');
  });

  it('should build parent chain all the way to root as comma separated string', () => {
    const leafCat = { id: '3', title: '0805', parent_id: '2' };
    expect(buildCategoryChain(leafCat, categories)).toBe('Passives, Resistors, 0805');
  });

  it('should handle numeric IDs correctly', () => {
    const numCats = [
      { id: 10, title: 'Root', parent_id: null },
      { id: 20, title: 'Child', parent_id: 10 },
      { id: 30, title: 'Leaf', parent_id: 20 }
    ];
    const leaf = { id: 30, title: 'Leaf', parent_id: 20 };
    expect(buildCategoryChain(leaf, numCats)).toBe('Root, Child, Leaf');
  });
});
