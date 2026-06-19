export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export interface ScoredItem<T> {
  item: T;
  score: number;
}

export function searchVectors<T>(
  query: number[],
  items: Array<{ vector: number[]; data: T }>,
  options: { topK?: number; threshold?: number } = {},
): ScoredItem<T>[] {
  const { topK = 5, threshold = 0 } = options;

  const scored = items
    .map((item) => ({
      item: item.data,
      score: cosineSimilarity(query, item.vector),
    }))
    .filter((s) => s.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}
