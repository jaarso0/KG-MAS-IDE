import { describe, test, expect } from 'vitest';
import * as path from 'path';
import { parseProject } from '../src/stage1-parse/walker.js';
import { extractorRegistry } from '../src/stage2-extract/extractor-registry.js';
import { parserRegistry } from '../src/stage1-parse/parser-registry.js';

describe('Stage 2 - Extract', () => {
  test('Extracts TS/JS symbols, scopes, containments, and candidates', async () => {
    const tsProjPath = path.resolve('tests/fixtures/typescript-project');
    const parsedFiles = await parseProject(tsProjPath);
    
    const serviceFile = parsedFiles.find(f => f.filePath === 'src/services/user.ts');
    expect(serviceFile).toBeDefined();

    const extractor = extractorRegistry.getExtractor(serviceFile!.language);
    const partialModel = extractor.extract(serviceFile!);

    expect(partialModel.filePath).toBe('src/services/user.ts');
    
    // Symbols extracted: file, UserService class, save method, getById method, users variable
    expect(partialModel.symbols.length).toBeGreaterThanOrEqual(4);
    
    const classSym = partialModel.symbols.find(s => s.kind === 'class');
    expect(classSym).toBeDefined();
    expect(classSym?.id).toBe('src/services/user.ts::UserService');
    expect(classSym?.name).toBe('UserService');
    expect(classSym?.qualifiedName).toBe('UserService');

    const methodSym = partialModel.symbols.find(s => s.kind === 'method' && s.name === 'save');
    expect(methodSym).toBeDefined();
    expect(methodSym?.id).toBe('src/services/user.ts::UserService::save');
    expect(methodSym?.qualifiedName).toBe('UserService.save');

    // Scopes extracted: global scope, class scope, method scope, etc.
    expect(partialModel.scopes.length).toBeGreaterThanOrEqual(3);
    const classScope = partialModel.scopes.find(s => s.kind === 'class');
    expect(classScope).toBeDefined();
    expect(classScope?.ownerSymbolId).toBe(classSym?.id);

    // Containments extracted: UserService owns save, UserService owns getById, UserService owns users
    expect(partialModel.containments.length).toBeGreaterThanOrEqual(2);
    const classOwnsMethod = partialModel.containments.find(
      c => c.parentId === classSym?.id && c.childId === methodSym?.id
    );
    expect(classOwnsMethod).toBeDefined();
    expect(classOwnsMethod?.kind).toBe('has_member');

    // Reference candidates: import of User model, and call of console.log
    expect(partialModel.references.length).toBeGreaterThanOrEqual(2);
    const importCand = partialModel.references.find(r => r.kind === 'import');
    expect(importCand).toBeDefined();
    expect(importCand?.importPath).toBe('../models/user.js');
    expect(importCand?.rawName).toBe('User');
  });

  test('Extracts Python symbols, scopes, containments, and candidates', async () => {
    const pythonProjPath = path.resolve('tests/fixtures/python-project');
    const parsedFiles = await parseProject(pythonProjPath);

    const mainFile = parsedFiles.find(f => f.filePath === 'main.py');
    expect(mainFile).toBeDefined();

    const extractor = extractorRegistry.getExtractor(mainFile!.language);
    const partialModel = extractor.extract(mainFile!);

    // References extracted from main.py
    // imports: `from services.user import UserService, get_current_user`
    // calls: `get_current_user()`, `UserService()`, `service.save(...)`, etc.
    expect(partialModel.references.length).toBeGreaterThanOrEqual(4);
    const importRefs = partialModel.references.filter(r => r.kind === 'import');
    expect(importRefs.length).toBeGreaterThanOrEqual(3);
    expect(importRefs.some(r => r.rawName === 'UserService' && r.importPath === 'services/user')).toBe(true);

    const callRefs = partialModel.references.filter(r => r.kind === 'call');
    expect(callRefs.length).toBeGreaterThanOrEqual(2);
    expect(callRefs.some(r => r.rawName === 'get_current_user')).toBe(true);
    expect(callRefs.some(r => r.rawName === 'UserService')).toBe(true);
  });

  test('Extracts Java symbols, scopes, containments, and candidates', () => {
    const javaCode = `
      package com.example;
      import com.example.db.Repository;
      
      public class UserService extends BaseService implements Service {
          private Repository repo;
          
          public void save() {
              repo.save();
          }
      }
    `;
    const parser = parserRegistry.getParser('java');
    const tree = parser.parse(javaCode);
    const parsedFile = {
      filePath: 'src/main/java/com/example/UserService.java',
      absolutePath: '/absolute/src/main/java/com/example/UserService.java',
      language: 'java' as const,
      tree,
      sourceCode: javaCode
    };

    const extractor = extractorRegistry.getExtractor('java');
    const partialModel = extractor.extract(parsedFile);

    expect(partialModel.filePath).toBe('src/main/java/com/example/UserService.java');

    // Symbols: File, UserService class, save method, repo variable
    expect(partialModel.symbols.length).toBe(4);
    
    const classSym = partialModel.symbols.find(s => s.kind === 'class');
    expect(classSym).toBeDefined();
    expect(classSym?.name).toBe('UserService');
    expect(classSym?.id).toBe('src/main/java/com/example/UserService.java::UserService');

    const methodSym = partialModel.symbols.find(s => s.kind === 'method');
    expect(methodSym).toBeDefined();
    expect(methodSym?.name).toBe('save');
    expect(methodSym?.id).toBe('src/main/java/com/example/UserService.java::UserService::save');

    const varSym = partialModel.symbols.find(s => s.kind === 'variable');
    expect(varSym).toBeDefined();
    expect(varSym?.name).toBe('repo');

    // Containments
    const classOwnsVar = partialModel.containments.find(
      c => c.parentId === classSym?.id && c.childId === varSym?.id
    );
    expect(classOwnsVar).toBeDefined();
    expect(classOwnsVar?.kind).toBe('owns');

    const classOwnsMethod = partialModel.containments.find(
      c => c.parentId === classSym?.id && c.childId === methodSym?.id
    );
    expect(classOwnsMethod).toBeDefined();
    expect(classOwnsMethod?.kind).toBe('has_member');

    // References: Import, inherit, implement, call
    expect(partialModel.references.length).toBe(4);
    
    const importRef = partialModel.references.find(r => r.kind === 'import');
    expect(importRef).toBeDefined();
    expect(importRef?.rawName).toBe('com.example.db.Repository');
    expect(importRef?.importPath).toBe('com/example/db/Repository');

    const inheritRef = partialModel.references.find(r => r.kind === 'inherit');
    expect(inheritRef).toBeDefined();
    expect(inheritRef?.rawName).toBe('BaseService');

    const implementRef = partialModel.references.find(r => r.kind === 'implement');
    expect(implementRef).toBeDefined();
    expect(implementRef?.rawName).toBe('Service');

    const callRef = partialModel.references.find(r => r.kind === 'call');
    expect(callRef).toBeDefined();
    expect(callRef?.rawName).toBe('repo.save');
  });
});
