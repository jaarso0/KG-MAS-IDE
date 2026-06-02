import { PYTHON_QUERIES } from './python-queries.js';
import { TYPESCRIPT_QUERIES } from './typescript-queries.js';
import { JAVA_QUERIES } from './java-queries.js';

export const QUERY_REGISTRY: Record<string, string> = {
  python: PYTHON_QUERIES,
  typescript: TYPESCRIPT_QUERIES,
  javascript: TYPESCRIPT_QUERIES,
  tsx: TYPESCRIPT_QUERIES,
  jsx: TYPESCRIPT_QUERIES,
  java: JAVA_QUERIES
};
