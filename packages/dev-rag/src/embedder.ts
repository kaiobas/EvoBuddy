export interface Embedder {
  embed(text: string): Promise<number[]>;
  embedMany(texts: string[]): Promise<number[][]>;
}

export interface OllamaEmbedderOptions {
  baseUrl?: string;
  model?: string;
}

export class OllamaEmbedder implements Embedder {
  private baseUrl: string;
  private model: string;

  constructor(options: OllamaEmbedderOptions = {}) {
    this.baseUrl = options.baseUrl ?? "http://localhost:11434";
    this.model = options.model ?? "llama3.2";
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, prompt: text }),
    });

    if (!res.ok) {
      throw new Error(
        `Ollama embed failed: ${res.status} ${res.statusText}`,
      );
    }

    const data = (await res.json()) as { embedding: number[] };
    return data.embedding;
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }
}
