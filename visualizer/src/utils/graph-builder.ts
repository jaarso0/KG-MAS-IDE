import { Node as RFNode, Edge as RFEdge } from '@xyflow/react';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import { SemanticModel, Symbol } from '../types';

export function buildGraph(model: SemanticModel): { nodes: RFNode[]; edges: RFEdge[] } {
  const symbols = model.symbols;
  const containments = model.containments;
  const references = model.resolvedReferences;

  // Filter out the project root node as it is a virtual container
  const nodesList = symbols.filter(s => s.kind !== 'project');

  // Map representation of symbols
  const symbolMap = new Map<string, Symbol>();
  for (const sym of nodesList) {
    symbolMap.set(sym.id, sym);
  }

  // Define nodes for D3 simulation
  const d3Nodes = nodesList.map(sym => ({
    id: sym.id,
    x: Math.random() * 800,
    y: Math.random() * 600,
  }));

  // Define links for D3 simulation
  // Combine both containments and references as links so simulation clusters them organically
  const d3Links: { source: string; target: string; weight: number }[] = [];

  // 1. Containments (higher weight to group members inside files/classes)
  for (const c of containments) {
    if (symbolMap.has(c.parentId) && symbolMap.has(c.childId)) {
      d3Links.push({
        source: c.parentId,
        target: c.childId,
        weight: 1.2,
      });
    }
  }

  // 2. References (lower weight to represent call/import relationships)
  for (const ref of references) {
    if (symbolMap.has(ref.fromSymbolId) && symbolMap.has(ref.toSymbolId)) {
      d3Links.push({
        source: ref.fromSymbolId,
        target: ref.toSymbolId,
        weight: 0.6,
      });
    }
  }

  // Run the force simulation synchronously
  const simulation = forceSimulation(d3Nodes as any)
    .force('charge', forceManyBody().strength(-150))
    .force('link', forceLink(d3Links).id((d: any) => d.id).distance(80).strength((d: any) => d.weight))
    .force('collide', forceCollide().radius(25))
    .force('center', forceCenter(400, 300))
    .stop();

  // Tick the simulation to stabilize
  for (let i = 0; i < 250; i++) {
    simulation.tick();
  }

  // Map simulation coordinates back to React Flow nodes
  const rfNodes: RFNode[] = d3Nodes.map((d3n) => {
    const symbol = symbolMap.get(d3n.id)!;
    return {
      id: d3n.id,
      type: 'customNode',
      position: { x: d3n.x, y: d3n.y },
      data: { label: symbol.name, symbol },
    };
  });

  // Generate edges for React Flow
  const rfEdges: RFEdge[] = [];
  const edgeKeys = new Set<string>();

  // 1. Draw References as curves
  for (const ref of references) {
    if (!symbolMap.has(ref.fromSymbolId) || !symbolMap.has(ref.toSymbolId)) {
      continue;
    }
    if (ref.fromSymbolId === ref.toSymbolId) continue;

    const edgeKey = `${ref.fromSymbolId}->${ref.toSymbolId}:${ref.kind}`;
    if (edgeKeys.has(edgeKey)) continue;
    edgeKeys.add(edgeKey);

    let strokeColor = '#3b82f6';
    let isAnimated = false;
    let strokeDasharray = undefined;

    switch (ref.kind) {
      case 'call':
        strokeColor = '#10b981'; // green
        isAnimated = true;
        break;
      case 'inherit':
      case 'implement':
        strokeColor = '#a855f7'; // purple
        strokeDasharray = '4 4';
        break;
      case 'import':
        strokeColor = '#0ea5e9'; // blue
        strokeDasharray = '2 2';
        break;
      case 'instantiate':
        strokeColor = '#f59e0b'; // orange
        isAnimated = true;
        break;
      default:
        strokeColor = '#64748b';
        break;
    }

    rfEdges.push({
      id: `edge-${ref.candidateId || edgeKey}`,
      source: ref.fromSymbolId,
      target: ref.toSymbolId,
      type: 'default', // curved bezier path
      animated: isAnimated,
      label: ref.kind,
      labelStyle: { fill: '#94a3b8', fontSize: 8, fontWeight: 500, fontFamily: 'Plus Jakarta Sans' },
      labelBgPadding: [2, 1],
      labelBgBorderRadius: 2,
      labelBgStyle: { fill: '#070a13', fillOpacity: 0.8 },
      style: {
        stroke: strokeColor,
        strokeWidth: 1.2,
        strokeDasharray,
      },
    });
  }

  // 2. Draw Containment edges as faint dashed lines
  for (const c of containments) {
    if (!symbolMap.has(c.parentId) || !symbolMap.has(c.childId)) {
      continue;
    }
    if (c.parentId === model.project.id) continue;

    const edgeKey = `${c.parentId}-contains->${c.childId}`;
    if (edgeKeys.has(edgeKey)) continue;
    edgeKeys.add(edgeKey);

    rfEdges.push({
      id: `edge-containment-${edgeKey}`,
      source: c.parentId,
      target: c.childId,
      type: 'default',
      style: {
        stroke: 'rgba(255, 255, 255, 0.05)',
        strokeWidth: 0.8,
        strokeDasharray: '2 2',
      },
    });
  }

  return { nodes: rfNodes, edges: rfEdges };
}
