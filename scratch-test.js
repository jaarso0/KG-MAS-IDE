import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';
import pkg from 'tree-sitter-typescript';
const { typescript, tsx } = pkg;

console.log("JavaScript language type:", typeof JavaScript);
console.log("Python language type:", typeof Python);
console.log("TypeScript language type:", typeof typescript);
console.log("TSX language type:", typeof tsx);

const parser = new Parser();
parser.setLanguage(JavaScript);
console.log("Parser with JavaScript initialized successfully!");
