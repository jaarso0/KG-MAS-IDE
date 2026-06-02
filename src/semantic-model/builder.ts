import {
  Symbol,
  SymbolKind,
  SymbolVisibility,
  Range,
  Scope,
  ScopeKind,
  Containment,
  ContainmentKind,
  ReferenceCandidate,
  ReferenceKind,
  Diagnostic,
  DiagnosticKind,
  DiagnosticSeverity
} from './types.js';
import {
  buildSymbolId,
  buildQualifiedName,
  generateScopeId,
  generateReferenceId
} from '../utils/id.js';

export { buildSymbolId, buildQualifiedName };

export function createSymbol(params: {
  filePath: string;
  chain: string[];
  kind: SymbolKind;
  range: Range;
  exported?: boolean;
  visibility?: SymbolVisibility;
  metadata?: Record<string, unknown>;
}): Symbol {
  const { filePath, chain, kind, range } = params;
  const name = chain[chain.length - 1] || '';
  const id = buildSymbolId(filePath, ...chain);
  const qualifiedName = buildQualifiedName(...chain);

  return {
    id,
    kind,
    name,
    qualifiedName,
    filePath: filePath.replace(/\\/g, '/'),
    range,
    exported: params.exported ?? false,
    visibility: params.visibility ?? 'public',
    metadata: params.metadata ?? {}
  };
}

export function createScope(params: {
  filePath: string;
  kind: ScopeKind;
  range: Range;
  parentScopeId: string | null;
  ownerSymbolId: string | null;
  metadata?: Record<string, unknown>;
}): Scope {
  const { filePath, kind, range, parentScopeId, ownerSymbolId } = params;
  const id = generateScopeId(filePath, kind, range);

  return {
    id,
    kind,
    parentScopeId,
    ownerSymbolId,
    filePath: filePath.replace(/\\/g, '/'),
    range,
    metadata: params.metadata ?? {}
  };
}

export function createContainment(
  parentId: string,
  childId: string,
  kind: ContainmentKind = 'owns'
): Containment {
  return { parentId, childId, kind };
}

export function createReferenceCandidate(params: {
  fromSymbolId: string;
  kind: ReferenceKind;
  rawName: string;
  qualifierChain: string[];
  importPath?: string;
  astNodeType: string;
  filePath: string;
  range: Range;
  metadata?: Record<string, unknown>;
}): ReferenceCandidate {
  const { fromSymbolId, kind, rawName, qualifierChain, filePath, range } = params;
  const id = generateReferenceId(fromSymbolId, rawName, range);

  return {
    id,
    fromSymbolId,
    kind,
    rawName,
    qualifierChain,
    importPath: params.importPath,
    astNodeType: params.astNodeType,
    filePath: filePath.replace(/\\/g, '/'),
    range,
    metadata: params.metadata ?? {}
  };
}

export function createDiagnostic(params: {
  kind: DiagnosticKind;
  severity: DiagnosticSeverity;
  message: string;
  filePath: string;
  range?: Range;
  relatedSymbolIds?: string[];
  relatedCandidateId?: string;
}): Diagnostic {
  return {
    kind: params.kind,
    severity: params.severity,
    message: params.message,
    filePath: params.filePath.replace(/\\/g, '/'),
    range: params.range,
    relatedSymbolIds: params.relatedSymbolIds,
    relatedCandidateId: params.relatedCandidateId
  };
}
