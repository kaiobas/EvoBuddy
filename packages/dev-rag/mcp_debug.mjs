process.stderr.write("Starting test...\n");
try {
  const { Server } = await import("@modelcontextprotocol/sdk/server/index.js");
  process.stderr.write("SDK imported\n");
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  process.stderr.write("Transport imported\n");
  const { OllamaEmbedder } = await import("./dist/embedder.js");
  process.stderr.write("Embedder imported\n");
  const { RagEngine } = await import("./dist/rag.js");
  process.stderr.write("RagEngine imported - Prisma init happens here\n");
  process.stderr.write("All imports OK\n");
} catch(e) {
  process.stderr.write("IMPORT ERROR: " + e.message + "\n" + e.stack + "\n");
}
process.stderr.write("Done.\n");
