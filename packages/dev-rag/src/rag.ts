import type { Embedder } from "./embedder.js";
import { searchVectors, type ScoredItem } from "./vector.js";
import { PrismaClient } from "@prisma/client";

export interface RagOptions {
  embedder: Embedder;
  prisma?: PrismaClient;
  dbUrl?: string;
}

export interface AddInteractionParams {
  sessionTitle: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  snippets?: Array<{
    filePath: string;
    content: string;
    tags?: string[];
  }>;
}

export interface AddMessagesParams {
  sessionId: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
}

export interface AddSnippetParams {
  filePath: string;
  content: string;
  tags?: string[];
  sessionId?: string;
}

export interface QueryParams {
  text: string;
  topK?: number;
  threshold?: number;
  includeMessages?: boolean;
  includeSnippets?: boolean;
}

export interface QueryResult {
  messages: Array<{ content: string; sessionTitle: string; score: number }>;
  snippets: Array<{
    content: string;
    filePath: string | null;
    score: number;
  }>;
}

export interface AugmentResult {
  augmented: string;
  sources: Array<{
    type: "message" | "snippet";
    content: string;
    score: number;
  }>;
}

export class RagEngine {
  private embedder: Embedder;
  private prisma: PrismaClient;

  constructor(options: RagOptions) {
    this.embedder = options.embedder;
    this.prisma =
      options.prisma ??
      new PrismaClient({
        datasources: options.dbUrl
          ? { db: { url: options.dbUrl } }
          : undefined,
      });
  }

  async addInteraction(params: AddInteractionParams): Promise<{
    sessionId: string;
  }> {
    const session = await this.prisma.session.create({
      data: { title: params.sessionTitle },
    });

    const msgEmbeddings = await this.embedder.embedMany(
      params.messages.map((m) => m.content),
    );

    await this.prisma.message.createMany({
      data: params.messages.map((m, i) => ({
        role: m.role,
        content: m.content,
        embedding: JSON.stringify(msgEmbeddings[i]),
        sessionId: session.id,
      })),
    });

    if (params.snippets?.length) {
      const snippetTexts = params.snippets.map((s) => s.content);
      const snipEmbeddings = await this.embedder.embedMany(snippetTexts);

      await this.prisma.contextSnippet.createMany({
        data: params.snippets.map((s, i) => ({
          filePath: s.filePath,
          content: s.content,
          embedding: JSON.stringify(snipEmbeddings[i]),
          tags: JSON.stringify(s.tags ?? []),
          sessionId: session.id,
        })),
      });
    }

    return { sessionId: session.id };
  }

  async addMessages(params: AddMessagesParams): Promise<{ count: number }> {
    const msgEmbeddings = await this.embedder.embedMany(
      params.messages.map((m) => m.content),
    );

    await this.prisma.message.createMany({
      data: params.messages.map((m, i) => ({
        role: m.role,
        content: m.content,
        embedding: JSON.stringify(msgEmbeddings[i]),
        sessionId: params.sessionId,
      })),
    });

    return { count: params.messages.length };
  }

  async addSnippet(params: AddSnippetParams): Promise<{ id: string }> {
    const embedding = await this.embedder.embed(params.content);

    const snippet = await this.prisma.contextSnippet.create({
      data: {
        filePath: params.filePath,
        content: params.content,
        embedding: JSON.stringify(embedding),
        tags: JSON.stringify(params.tags ?? []),
        sessionId: params.sessionId,
      },
    });

    return { id: snippet.id };
  }

  async query(params: QueryParams): Promise<QueryResult> {
    const queryEmbedding = await this.embedder.embed(params.text);
    const topK = params.topK ?? 5;
    const threshold = params.threshold ?? 0.75;

    const result: QueryResult = { messages: [], snippets: [] };

    if (params.includeMessages !== false) {
      const messages = await this.prisma.message.findMany({
        include: { session: true },
      });

      const scored = searchVectors(
        queryEmbedding,
        messages
          .filter((m) => m.embedding)
          .map((m) => ({
            vector: JSON.parse(m.embedding!) as number[],
            data: {
              content: m.content,
              sessionTitle: m.session.title,
            },
          })),
        { topK, threshold },
      );

      result.messages = scored.map((s) => ({ ...s.item, score: s.score }));
    }

    if (params.includeSnippets !== false) {
      const snippets = await this.prisma.contextSnippet.findMany();

      const scored = searchVectors(
        queryEmbedding,
        snippets
          .filter((s) => s.embedding)
          .map((s) => ({
            vector: JSON.parse(s.embedding!) as number[],
            data: {
              content: s.content,
              filePath: s.filePath,
            },
          })),
        { topK, threshold },
      );

      result.snippets = scored.map((s) => ({ ...s.item, score: s.score }));
    }

    return result;
  }

  async augmentPrompt(prompt: string): Promise<AugmentResult> {
    const queryResult = await this.query({ text: prompt });

    const sources: AugmentResult["sources"] = [
      ...queryResult.messages.map((m) => ({
        type: "message" as const,
        content: m.content,
        score: m.score,
      })),
      ...queryResult.snippets.map((s) => ({
        type: "snippet" as const,
        content: s.content,
        score: s.score,
      })),
    ];

    const context = sources
      .map((s) => `<context type="${s.type}" score="${s.score.toFixed(3)}">\n${s.content}\n</context>`)
      .join("\n\n");

    const augmented = [
      "Relevant context from previous sessions:",
      context,
      "---",
      prompt,
    ].join("\n\n");

    return { augmented, sources };
  }

  async listSessions(): Promise<
    Array<{ id: string; title: string; createdAt: Date; messageCount: number }>
  > {
    const sessions = await this.prisma.session.findMany({
      include: { _count: { select: { messages: true } } },
      orderBy: { createdAt: "desc" },
    });

    return sessions.map((s) => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt,
      messageCount: s._count.messages,
    }));
  }

  async deleteSession(id: string): Promise<void> {
    await this.prisma.session.delete({ where: { id } });
  }

  async destroy(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
