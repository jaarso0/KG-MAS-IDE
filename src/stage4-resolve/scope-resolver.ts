import { ReferenceCandidate, Symbol, Scope, Containment } from '../semantic-model/types.js';
import { SymbolRegistry } from '../stage3-registry/registry.js';
import { isRangeContained } from '../stage3-registry/registry.js';

export class ScopeResolver {
  private registry: SymbolRegistry;
  private containments: Containment[];

  constructor(registry: SymbolRegistry, containments: Containment[]) {
    this.registry = registry;
    this.containments = containments;
  }

  public resolveScope(
    candidate: ReferenceCandidate,
    resolvedImports: Map<string, Symbol>
  ): { symbol: Symbol; method: 'scope' | 'qualified_name' | 'global_fallback' } | undefined {
    const { filePath, range, rawName, qualifierChain } = candidate;
    const nameToLookUp = qualifierChain[0] || rawName;

    // Find all scopes in the file
    const fileSymbols = this.registry.byFile.lookup(filePath);
    const fileScopes: Scope[] = [];
    
    // We walk through all scopes to find containing ones
    // Note: SymbolRegistry holds rawScopes internally, but we can also query ScopeIndex or scan raw scopes.
    // Let's find the innermost containing scope from ScopeIndex or by checking all scopes in the registry.
    const innermostScope = this.getInnermostScope(filePath, range);

    let currentScope = innermostScope;
    while (currentScope) {
      const scopeSymbols = this.registry.byScope.getSymbolsInScope(currentScope.id);
      
      // Look for a symbol declared in this scope matching the first chain element
      const matchedBase = scopeSymbols.find(s => s.name === nameToLookUp);
      if (matchedBase) {
        if (qualifierChain.length > 1) {
          const resolvedMember = this.resolveChain(matchedBase, qualifierChain, 1);
          if (resolvedMember) {
            return { symbol: resolvedMember, method: 'scope' };
          }
        } else {
          return { symbol: matchedBase, method: 'scope' };
        }
      }

      // Walk up the scope parent chain
      if (currentScope.parentScopeId) {
        currentScope = this.registry.byScope.getScopeById(currentScope.parentScopeId);
      } else {
        currentScope = undefined;
      }
    }

    // Check file-level imports (if imported in the same file)
    const resolvedImport = resolvedImports.get(nameToLookUp);
    if (resolvedImport) {
      if (qualifierChain.length > 1) {
        const resolvedMember = this.resolveChain(resolvedImport, qualifierChain, 1);
        if (resolvedMember) {
          return { symbol: resolvedMember, method: 'scope' };
        }
      } else {
        return { symbol: resolvedImport, method: 'scope' };
      }
    }

    // Fall back to best-effort qualified name lookup (qualified_name method)
    if (qualifierChain.length > 1) {
      const qname = qualifierChain.join('.');
      const qnameMatches = this.registry.byQualifiedName.lookup(qname);
      if (qnameMatches.length > 0) {
        // Return first match
        return { symbol: qnameMatches[0], method: 'qualified_name' };
      }
    }

    // Final fallback: global lookup by name (global_fallback method)
    const nameMatches = this.registry.byName.lookup(nameToLookUp);
    // Prefer non-file, non-project symbols first
    const cleanMatches = nameMatches.filter(s => s.kind !== 'file' && s.kind !== 'project');
    const bestMatch = cleanMatches[0] || nameMatches[0];
    
    if (bestMatch) {
      if (qualifierChain.length > 1) {
        const resolvedMember = this.resolveChain(bestMatch, qualifierChain, 1);
        if (resolvedMember) {
          return { symbol: resolvedMember, method: 'global_fallback' };
        }
      }
      return { symbol: bestMatch, method: 'global_fallback' };
    }

    return undefined;
  }

  private getInnermostScope(filePath: string, range: Range): Scope | undefined {
    // Scan all registered scopes (we can find scopes from their owner symbol id or files)
    // To make it simple and reliable, let's search for scopes in the same file
    // that contain the range, and find the smallest.
    const allScopes = this.registry.byId.values()
      .filter(s => s.kind === 'file')
      .map(s => this.registry.byScope.getScopeForSymbol(s.id))
      .filter((s): s is Scope => s !== undefined);
      
    // Actually, we can get rawScopes if we walk registry raw scopes list,
    // or we can just access all scopes that the registry knows of.
    // In builder, every scope has a unique ID, let's find scopes in our registered file:
    const fileSymbols = this.registry.byFile.lookup(filePath);
    const scopeIds = new Set<string>();
    for (const sym of fileSymbols) {
      const sc = this.registry.byScope.getScopeForSymbol(sym.id);
      if (sc) {
        scopeIds.add(sc.id);
        // Also capture parent scopes of this scope
        let parent = sc.parentScopeId;
        while (parent) {
          scopeIds.add(parent);
          const parentScope = this.registry.byScope.getScopeById(parent);
          parent = parentScope ? parentScope.parentScopeId : null;
        }
      }
    }

    const scopes = Array.from(scopeIds)
      .map(id => this.registry.byScope.getScopeById(id))
      .filter((s): s is Scope => s !== undefined && s.filePath === filePath && isRangeContained(range, s.range));

    if (scopes.length === 0) return undefined;

    // Sort by range size (smallest first)
    scopes.sort((a, b) => {
      const sizeA = (a.range.end.line - a.range.start.line) * 10000 + (a.range.end.column - a.range.start.column);
      const sizeB = (b.range.end.line - b.range.start.line) * 10000 + (b.range.end.column - b.range.start.column);
      return sizeA - sizeB;
    });

    return scopes[0];
  }

  private resolveChain(startSymbol: Symbol, chain: string[], index: number): Symbol | undefined {
    if (index >= chain.length) return startSymbol;

    const memberName = chain[index];
    const nextSymbol = this.resolveMember(startSymbol, memberName);
    if (!nextSymbol) return undefined;

    return this.resolveChain(nextSymbol, chain, index + 1);
  }

  private resolveMember(parentSymbol: Symbol, memberName: string): Symbol | undefined {
    const childEdges = this.containments.filter(c => c.parentId === parentSymbol.id);
    for (const edge of childEdges) {
      const child = this.registry.byId.lookup(edge.childId);
      if (child && child.name === memberName) {
        return child;
      }
    }
    return undefined;
  }
}
