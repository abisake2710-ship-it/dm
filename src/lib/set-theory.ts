export function union<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a, ...b]);
}

export function intersection<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a].filter((value) => b.has(value)));
}

export function difference<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a].filter((value) => !b.has(value)));
}

export function symmetricDifference<T>(a: Set<T>, b: Set<T>): Set<T> {
  return union(difference(a, b), difference(b, a));
}

export function complement<T>(universe: Set<T>, subset: Set<T>): Set<T> {
  return difference(universe, subset);
}

export function cardinality<T>(set: Set<T>): number {
  return set.size;
}

export function isSubset<T>(subset: Set<T>, universe: Set<T>): boolean {
  return [...subset].every((value) => universe.has(value));
}
