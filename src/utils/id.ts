import { Range } from '../semantic-model/types.js';

export function buildSymbolId(filePath: string, ...chain: string[]): string {
  // Replace backslashes with forward slashes for cross-platform stability
  const normalizedPath = filePath.replace(/\\/g, '/');
  return `${normalizedPath}::${chain.join('::')}`;
}

export function buildQualifiedName(...chain: string[]): string {
  return chain.join('.');
}

export function generateScopeId(filePath: string, kind: string, range: Range): string {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return `scope:${normalizedPath}:${kind}:${range.start.line}:${range.start.column}:${range.end.line}:${range.end.column}`;
}

export function generateReferenceId(fromSymbolId: string, rawName: string, range: Range): string {
  return `ref:${fromSymbolId}:${rawName}:${range.start.line}:${range.start.column}:${range.end.line}:${range.end.column}`;
}

export function generateDiagnosticId(filePath: string, kind: string, range?: Range): string {
  const normalizedPath = filePath.replace(/\\/g, '/');
  if (range) {
    return `diag:${normalizedPath}:${kind}:${range.start.line}:${range.start.column}`;
  }
  return `diag:${normalizedPath}:${kind}:file-level`;
}
