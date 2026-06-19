export { RagEngine } from "./rag.js";
export { OllamaEmbedder, type Embedder, type OllamaEmbedderOptions } from "./embedder.js";
export { cosineSimilarity, searchVectors } from "./vector.js";
export { finishTask, type FinishTaskOptions } from "./finish-task.js";

export type {
  AddInteractionParams,
  AddMessagesParams,
  AddSnippetParams,
  QueryParams,
  QueryResult,
  AugmentResult,
} from "./rag.js";
