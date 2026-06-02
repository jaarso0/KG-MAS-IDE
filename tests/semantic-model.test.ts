import { describe, test, expect } from 'vitest';
import { createSymbol, createScope, createContainment } from '../src/semantic-model/builder.js';
import { mergePartials, updatePartial } from '../src/semantic-model/merge.js';
import { PartialSemanticModel, Symbol } from '../src/semantic-model/types.js';

describe('Semantic Model Core', () => {
  test('Path-anchored IDs do not collide across files', () => {
    const symA = createSymbol({
      filePath: 'services/user.py',
      chain: ['UserService'],
      kind: 'class',
      range: { start: { line: 1, column: 0 }, end: { line: 10, column: 0 } }
    });

    const symB = createSymbol({
      filePath: 'admin/user.py',
      chain: ['UserService'],
      kind: 'class',
      range: { start: { line: 1, column: 0 }, end: { line: 10, column: 0 } }
    });

    expect(symA.id).toBe('services/user.py::UserService');
    expect(symB.id).toBe('admin/user.py::UserService');
    expect(symA.id).not.toBe(symB.id);
  });

  test('Scope objects track parent chain correctly', () => {
    const filePath = 'src/index.ts';
    const globalScope = createScope({
      filePath,
      kind: 'global',
      range: { start: { line: 0, column: 0 }, end: { line: 100, column: 0 } },
      parentScopeId: null,
      ownerSymbolId: null
    });

    const classSymbol = createSymbol({
      filePath,
      chain: ['MyClass'],
      kind: 'class',
      range: { start: { line: 1, column: 0 }, end: { line: 50, column: 0 } }
    });

    const classScope = createScope({
      filePath,
      kind: 'class',
      range: classSymbol.range,
      parentScopeId: globalScope.id,
      ownerSymbolId: classSymbol.id
    });

    const methodSymbol = createSymbol({
      filePath,
      chain: ['MyClass', 'myMethod'],
      kind: 'method',
      range: { start: { line: 2, column: 2 }, end: { line: 10, column: 2 } }
    });

    const methodScope = createScope({
      filePath,
      kind: 'function',
      range: methodSymbol.range,
      parentScopeId: classScope.id,
      ownerSymbolId: methodSymbol.id
    });

    expect(methodScope.parentScopeId).toBe(classScope.id);
    expect(classScope.parentScopeId).toBe(globalScope.id);
    expect(methodScope.ownerSymbolId).toBe(methodSymbol.id);
    expect(classScope.ownerSymbolId).toBe(classSymbol.id);
  });

  test('Merge and incremental update (idempotency & correctness)', () => {
    const projectSymbol: Symbol = createSymbol({
      filePath: '',
      chain: ['my-project'],
      kind: 'project',
      range: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }
    });

    const partial1: PartialSemanticModel = {
      filePath: 'src/a.ts',
      symbols: [
        createSymbol({
          filePath: 'src/a.ts',
          chain: ['aFunc'],
          kind: 'function',
          range: { start: { line: 1, column: 0 }, end: { line: 5, column: 0 } }
        })
      ],
      scopes: [
        createScope({
          filePath: 'src/a.ts',
          kind: 'global',
          range: { start: { line: 0, column: 0 }, end: { line: 10, column: 0 } },
          parentScopeId: null,
          ownerSymbolId: null
        })
      ],
      containments: [],
      references: [],
      diagnostics: []
    };

    const partial2: PartialSemanticModel = {
      filePath: 'src/b.ts',
      symbols: [
        createSymbol({
          filePath: 'src/b.ts',
          chain: ['bFunc'],
          kind: 'function',
          range: { start: { line: 2, column: 0 }, end: { line: 6, column: 0 } }
        })
      ],
      scopes: [
        createScope({
          filePath: 'src/b.ts',
          kind: 'global',
          range: { start: { line: 0, column: 0 }, end: { line: 10, column: 0 } },
          parentScopeId: null,
          ownerSymbolId: null
        })
      ],
      containments: [],
      references: [],
      diagnostics: []
    };

    // Full Merge
    const merged = mergePartials([partial1, partial2], projectSymbol);

    // Verify Project symbol is included, plus file symbols and user symbols
    expect(merged.symbols.some(s => s.id === projectSymbol.id)).toBe(true);
    expect(merged.symbols.some(s => s.id === 'src/a.ts::aFunc')).toBe(true);
    expect(merged.symbols.some(s => s.id === 'src/b.ts::bFunc')).toBe(true);
    expect(merged.containments.length).toBe(2); // project -> src/a.ts and project -> src/b.ts

    // Incremental Update
    const updatedPartial1: PartialSemanticModel = {
      filePath: 'src/a.ts',
      symbols: [
        createSymbol({
          filePath: 'src/a.ts',
          chain: ['aFuncNew'],
          kind: 'function',
          range: { start: { line: 1, column: 0 }, end: { line: 5, column: 0 } }
        })
      ],
      scopes: [
        createScope({
          filePath: 'src/a.ts',
          kind: 'global',
          range: { start: { line: 0, column: 0 }, end: { line: 10, column: 0 } },
          parentScopeId: null,
          ownerSymbolId: null
        })
      ],
      containments: [],
      references: [],
      diagnostics: []
    };

    const incrementallyMerged = updatePartial(merged, 'src/a.ts', updatedPartial1, projectSymbol);

    // Ensure old symbol in a.ts is gone, and new is present
    expect(incrementallyMerged.symbols.some(s => s.id === 'src/a.ts::aFunc')).toBe(false);
    expect(incrementallyMerged.symbols.some(s => s.id === 'src/a.ts::aFuncNew')).toBe(true);
    // Ensure b.ts is untouched
    expect(incrementallyMerged.symbols.some(s => s.id === 'src/b.ts::bFunc')).toBe(true);
    expect(incrementallyMerged.containments.length).toBe(2);
  });
});
