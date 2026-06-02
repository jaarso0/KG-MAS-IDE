import * as path from 'path';
import { ReferenceCandidate, Symbol } from '../semantic-model/types.js';
import { SymbolRegistry } from '../stage3-registry/registry.js';

/**
 * Resolves reference candidates of kind 'import' to their corresponding target symbols.
 */
export class ImportResolver {
  private registry: SymbolRegistry;

  constructor(registry: SymbolRegistry) {
    this.registry = registry;
  }

  public resolveImport(candidate: ReferenceCandidate): Symbol | undefined {
    if (candidate.kind !== 'import' || !candidate.importPath) {
      return undefined;
    }

    const { filePath, importPath, rawName } = candidate;
    const isPython = filePath.endsWith('.py');
    const isJava = filePath.endsWith('.java');

    if (isPython) {
      return this.resolvePythonImport(importPath, rawName);
    } else if (isJava) {
      return this.resolveJavaImport(filePath, importPath, rawName);
    } else {
      return this.resolveTypeScriptImport(filePath, importPath, rawName);
    }
  }

  private resolvePythonImport(importPath: string, rawName: string): Symbol | undefined {
    // For Python: from services.user import UserService
    // importPath is "services/user"
    // We try to find the module file service/user.py or services/user/__init__.py
    const candidates = [
      importPath,
      importPath + '.py',
      importPath + '/__init__.py',
      importPath.replace(/\//g, '.') // dotted notation services.user
    ];

    let targetFileSymbol: Symbol | undefined;
    for (const cand of candidates) {
      const match = this.registry.byModule.lookup(cand);
      if (match) {
        targetFileSymbol = match;
        break;
      }
    }

    if (!targetFileSymbol) {
      // Best effort check by searching for file symbol that matches module name in path
      const allSymbols = this.registry.byId.values();
      targetFileSymbol = allSymbols.find(
        s => s.kind === 'file' && s.filePath.replace(/\.py$/, '').endsWith(importPath)
      );
    }

    if (targetFileSymbol) {
      // Find the imported symbol in that file
      const fileSymbols = this.registry.byFile.lookup(targetFileSymbol.filePath);
      
      // Match by name or qualifiedName
      const match = fileSymbols.find(
        s => s.kind !== 'file' && s.exported && (s.name === rawName || s.qualifiedName === rawName)
      );
      if (match) return match;

      // If we are importing the module itself, return the file symbol
      if (targetFileSymbol.name === rawName || targetFileSymbol.filePath.endsWith(rawName + '.py')) {
        return targetFileSymbol;
      }
    }

    // Try a global lookup of the name among exported symbols if path-based resolution fails
    const globalMatches = this.registry.byName.lookup(rawName);
    const exportedMatch = globalMatches.find(s => s.kind !== 'file' && s.exported);
    if (exportedMatch) return exportedMatch;

    return undefined;
  }

  private resolveTypeScriptImport(
    filePath: string,
    importPath: string,
    rawName: string
  ): Symbol | undefined {
    // For TS/JS: import { UserService } from './services/user.js'
    // Calculate path relative to current file's directory
    const dir = path.dirname(filePath);
    const relativeTarget = path.join(dir, importPath).replace(/\\/g, '/');

    // Try absolute path if importPath is a absolute/alias path (fallback)
    const candidates = [
      relativeTarget,
      relativeTarget + '.ts',
      relativeTarget + '.tsx',
      relativeTarget + '.js',
      relativeTarget + '.jsx',
      relativeTarget + '/index.ts',
      relativeTarget + '/index.tsx',
      relativeTarget + '/index.js'
    ];

    let targetFileSymbol: Symbol | undefined;
    for (const cand of candidates) {
      const match = this.registry.byModule.lookup(cand);
      if (match) {
        targetFileSymbol = match;
        break;
      }
    }

    // Fallback: look up by matching any part of file path
    if (!targetFileSymbol) {
      const cleanImportPath = importPath.replace(/^[\.\/]+/, '');
      const allSymbols = this.registry.byId.values();
      targetFileSymbol = allSymbols.find(
        s => s.kind === 'file' && s.filePath.replace(/\.[jt]sx?$/, '').endsWith(cleanImportPath)
      );
    }

    if (targetFileSymbol) {
      // Find the imported symbol in that file
      const fileSymbols = this.registry.byFile.lookup(targetFileSymbol.filePath);
      
      const match = fileSymbols.find(
        s => s.kind !== 'file' && s.exported && (s.name === rawName || s.qualifiedName === rawName)
      );
      if (match) return match;
    }

    // Fallback: look up globally by name
    const globalMatches = this.registry.byName.lookup(rawName);
    const exportedMatch = globalMatches.find(s => s.kind !== 'file' && s.exported);
    if (exportedMatch) return exportedMatch;

    return undefined;
  }

  private resolveJavaImport(
    filePath: string,
    importPath: string,
    rawName: string
  ): Symbol | undefined {
    const cleanImportPath = importPath.replace(/^[\.\/]+/, '');
    const isWildcard = cleanImportPath.endsWith('*');
    const lookupPath = isWildcard ? cleanImportPath.slice(0, -1) : cleanImportPath;

    const allSymbols = this.registry.byId.values();
    let targetFileSymbol: Symbol | undefined;

    if (!isWildcard) {
      targetFileSymbol = allSymbols.find(
        s => s.kind === 'file' && s.filePath.replace(/\.java$/, '').endsWith(lookupPath)
      );
    }

    if (targetFileSymbol) {
      const fileSymbols = this.registry.byFile.lookup(targetFileSymbol.filePath);
      const match = fileSymbols.find(
        s => s.kind !== 'file' && s.exported && (s.name === rawName || s.qualifiedName === rawName)
      );
      if (match) return match;
    }

    // Fallback: look up globally by name
    const globalMatches = this.registry.byName.lookup(rawName);
    const exportedMatch = globalMatches.find(s => s.kind !== 'file' && s.exported);
    if (exportedMatch) return exportedMatch;

    return undefined;
  }
}
