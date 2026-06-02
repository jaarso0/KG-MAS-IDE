import * as fs from 'fs/promises';
import * as path from 'path';
import { SemanticModel } from '../semantic-model/types.js';

export interface SemanticModelStorage {
  save(model: SemanticModel, projectRoot: string): Promise<void>;
  load(projectRoot: string): Promise<SemanticModel>;
}

export class JsonSemanticModelStorage implements SemanticModelStorage {
  private getStoragePath(projectRoot: string): string {
    return path.join(projectRoot, '.masai', 'semantic-model.json');
  }

  public async save(model: SemanticModel, projectRoot: string): Promise<void> {
    const storagePath = this.getStoragePath(projectRoot);
    const dir = path.dirname(storagePath);
    
    // Ensure .masai folder exists
    await fs.mkdir(dir, { recursive: true });

    // Format JSON with 2 spaces for human-readability as requested in manual verification plan
    const content = JSON.stringify(model, null, 2);
    await fs.writeFile(storagePath, content, 'utf-8');
  }

  public async load(projectRoot: string): Promise<SemanticModel> {
    const storagePath = this.getStoragePath(projectRoot);
    const content = await fs.readFile(storagePath, 'utf-8');
    return JSON.parse(content) as SemanticModel;
  }
}
