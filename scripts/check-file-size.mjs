#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const MAX_LINES = 600;
const SRC_DIR = path.resolve(process.cwd(), 'src');

function getFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') {
        continue;
      }
      files.push(...getFiles(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function countLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content) return 0;
  return content.split(/\r?\n/).length;
}

function checkFileSizes() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`Error: src directory not found at ${SRC_DIR}`);
    process.exit(1);
  }

  const files = getFiles(SRC_DIR);
  const oversized = [];

  for (const file of files) {
    const lines = countLines(file);
    if (lines > MAX_LINES) {
      const relativePath = path.relative(process.cwd(), file);
      oversized.push({ path: relativePath, lines });
    }
  }

  oversized.sort((a, b) => b.lines - a.lines);

  console.log(`[check-file-size] Scanned ${files.length} source files under src/ (target: <= ${MAX_LINES} lines)`);

  if (oversized.length > 0) {
    console.warn(`\n⚠️  WARNING: Found ${oversized.length} file(s) exceeding the ${MAX_LINES}-line target:`);
    console.warn('------------------------------------------------------------');
    for (const item of oversized) {
      console.warn(`  ${item.lines.toString().padStart(5, ' ')} lines : ${item.path}`);
    }
    console.warn('------------------------------------------------------------');
    console.warn('Please refactor or split these files in future tasks.\n');
  } else {
    console.log(`✅ All ${files.length} source files are within the ${MAX_LINES}-line target!\n`);
  }

  // Non-blocking warning step per Task C specification
  process.exit(0);
}

checkFileSizes();
