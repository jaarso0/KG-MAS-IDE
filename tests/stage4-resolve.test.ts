import { describe, test, expect } from 'vitest';
import { createSymbol, createScope, createReferenceCandidate, createContainment } from '../src/semantic-model/builder.js';
import { SymbolRegistry } from '../src/stage3-registry/registry.js';
import { resolveAll } from '../src/stage4-resolve/resolver.js';
import { MergeableModel } from '../src/semantic-model/merge.js';

describe('Stage 4 - Resolve', () => {
  test('Resolves import and function calls correctly', () => {
    // File A defines login()
    const fileA = createSymbol({
      filePath: 'auth.py',
      chain: ['auth.py'],
      kind: 'file',
      range: { start: { line: 0, column: 0 }, end: { line: 10, column: 0 } }
    });

    const loginFunc = createSymbol({
      filePath: 'auth.py',
      chain: ['login'],
      kind: 'function',
      range: { start: { line: 2, column: 0 }, end: { line: 5, column: 0 } },
      exported: true
    });

    // File B imports login and calls it
    const fileB = createSymbol({
      filePath: 'main.py',
      chain: ['main.py'],
      kind: 'file',
      range: { start: { line: 0, column: 0 }, end: { line: 10, column: 0 } }
    });

    const importRef = createReferenceCandidate({
      fromSymbolId: fileB.id,
      kind: 'import',
      rawName: 'login',
      qualifierChain: ['login'],
      importPath: 'auth',
      astNodeType: 'import_from_statement',
      filePath: 'main.py',
      range: { start: { line: 1, column: 0 }, end: { line: 1, column: 23 } }
    });

    const callRef = createReferenceCandidate({
      fromSymbolId: fileB.id,
      kind: 'call',
      rawName: 'login',
      qualifierChain: ['login'],
      astNodeType: 'call_expression',
      filePath: 'main.py',
      range: { start: { line: 3, column: 4 }, end: { line: 3, column: 11 } }
    });

    const registry = new SymbolRegistry();
    const model: MergeableModel = {
      symbols: [fileA, loginFunc, fileB],
      scopes: [],
      containments: [],
      references: [importRef, callRef],
      diagnostics: []
    };

    registry.build(model);

    const result = resolveAll(model.references, registry, model.containments);

    expect(result.unresolved.length).toBe(0);
    expect(result.resolved.length).toBe(2);

    const resolvedImport = result.resolved.find(r => r.candidateId === importRef.id);
    expect(resolvedImport).toBeDefined();
    expect(resolvedImport?.toSymbolId).toBe(loginFunc.id);
    expect(resolvedImport?.resolutionMethod).toBe('import');

    const resolvedCall = result.resolved.find(r => r.candidateId === callRef.id);
    expect(resolvedCall).toBeDefined();
    expect(resolvedCall?.toSymbolId).toBe(loginFunc.id);
    expect(resolvedCall?.resolutionMethod).toBe('import'); // resolved via file-level import
  });

  test('Scope chain walks up to find lexical symbols', () => {
    const filePath = 'app.ts';
    
    const fileSymbol = createSymbol({
      filePath,
      chain: [filePath],
      kind: 'file',
      range: { start: { line: 0, column: 0 }, end: { line: 50, column: 0 } }
    });

    const globalScope = createScope({
      filePath,
      kind: 'global',
      range: fileSymbol.range,
      parentScopeId: null,
      ownerSymbolId: fileSymbol.id
    });

    const classSym = createSymbol({
      filePath,
      chain: ['App'],
      kind: 'class',
      range: { start: { line: 5, column: 0 }, end: { line: 30, column: 0 } }
    });

    const classScope = createScope({
      filePath,
      kind: 'class',
      range: classSym.range,
      parentScopeId: globalScope.id,
      ownerSymbolId: classSym.id
    });

    const instanceVar = createSymbol({
      filePath,
      chain: ['App', 'config'],
      kind: 'variable',
      range: { start: { line: 6, column: 2 }, end: { line: 6, column: 15 } }
    });

    const methodSym = createSymbol({
      filePath,
      chain: ['App', 'run'],
      kind: 'method',
      range: { start: { line: 10, column: 2 }, end: { line: 20, column: 2 } }
    });

    const methodScope = createScope({
      filePath,
      kind: 'function',
      range: methodSym.range,
      parentScopeId: classScope.id,
      ownerSymbolId: methodSym.id
    });

    // Reference to config inside method run
    const refCand = createReferenceCandidate({
      fromSymbolId: methodSym.id,
      kind: 'call',
      rawName: 'config',
      qualifierChain: ['config'],
      astNodeType: 'identifier',
      filePath,
      range: { start: { line: 12, column: 4 }, end: { line: 12, column: 10 } }
    });

    const containments = [
      createContainment(classSym.id, instanceVar.id, 'has_member'),
      createContainment(classSym.id, methodSym.id, 'has_member')
    ];

    const registry = new SymbolRegistry();
    const model: MergeableModel = {
      symbols: [fileSymbol, classSym, instanceVar, methodSym],
      scopes: [globalScope, classScope, methodScope],
      containments,
      references: [refCand],
      diagnostics: []
    };

    registry.build(model);

    const result = resolveAll(model.references, registry, model.containments);

    expect(result.resolved.length).toBe(1);
    const resolvedRef = result.resolved[0];
    expect(resolvedRef.toSymbolId).toBe(instanceVar.id);
    expect(resolvedRef.resolutionMethod).toBe('scope');
  });

  test('Unresolvable references degrade gracefully', () => {
    const filePath = 'app.ts';
    
    const fileSymbol = createSymbol({
      filePath,
      chain: [filePath],
      kind: 'file',
      range: { start: { line: 0, column: 0 }, end: { line: 100, column: 0 } }
    });

    const refCand = createReferenceCandidate({
      fromSymbolId: fileSymbol.id,
      kind: 'call',
      rawName: 'service.save',
      qualifierChain: ['service', 'save'],
      astNodeType: 'call_expression',
      filePath,
      range: { start: { line: 10, column: 0 }, end: { line: 10, column: 12 } }
    });

    const registry = new SymbolRegistry();
    const model: MergeableModel = {
      symbols: [fileSymbol],
      scopes: [],
      containments: [],
      references: [refCand],
      diagnostics: []
    };

    registry.build(model);

    const result = resolveAll(model.references, registry, model.containments);

    expect(result.resolved.length).toBe(0);
    expect(result.unresolved.length).toBe(1);
    expect(result.unresolved[0].id).toBe(refCand.id);
  });
});
