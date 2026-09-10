/**
 * Isolated Test Runner
 * Ensures test suites run against an isolated sandbox database (.data/pglite_test)
 * so running tests never interferes with or truncates the live dev database (.data/pglite)
 */
import path from 'path';
import { pathToFileURL } from 'url';

const testArg = process.argv[2];
if (!testArg) {
  console.error('Error: Please provide a test file to run.');
  process.exit(1);
}

// Direct all test database operations to an isolated sandbox
process.env.PG_DATA_DIR = path.resolve(process.cwd(), '.data/pglite_test');

const targetUrl = pathToFileURL(path.resolve(testArg)).href;
await import(targetUrl);
