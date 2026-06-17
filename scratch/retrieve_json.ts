import * as path from 'path';
import { Pipeline } from '../src/pipeline.js';
import { JsonSemanticModelStorage } from '../src/storage/semantic-model-storage.js';
import { RetrievalEngine } from '../src/retrieval/api.js';

async function run() {
  const projectPath = process.argv[2];
  const query = process.argv[3];

  if (!projectPath || !query) {
    console.error(JSON.stringify({ error: "Missing project_path or query arguments" }));
    process.exit(1);
  }

  const storage = new JsonSemanticModelStorage();
  let model;
  try {
    model = await storage.load(projectPath);
  } catch (err: any) {
    console.error(JSON.stringify({ error: `Failed to load semantic model: ${err.message}` }));
    process.exit(1);
  }

  const pipeline = new Pipeline();
  const graph = pipeline.deriveGraph(model);
  const engine = new RetrievalEngine(graph, projectPath);

  const context = await engine.retrieveContext(query);
  
  const files = context.relevantFiles || [];
  
  const symbols = (context.relevantSymbols || []).map(s => ({
    id: s.id,
    kind: s.kind,
    name: s.name,
    qualifiedName: s.qualifiedName,
    filePath: s.filePath,
    range: s.range
  }));
  
  const flow = context.executionFlows && context.executionFlows.length > 0 ? context.executionFlows[0] : [];

  const snippets = (context.codeSnippets || []).map(snip => ({
    filePath: snip.filePath,
    symbolName: snip.symbolName,
    startLine: snip.startLine,
    endLine: snip.endLine,
    content: snip.content
  }));

  console.log(JSON.stringify({
    files,
    symbols,
    flow,
    snippets
  }));
}

run().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
