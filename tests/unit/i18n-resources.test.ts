/// <reference types="node" />

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const i18nDirectory = join(dirname(fileURLToPath(import.meta.url)), '../../src/i18n');
const pluralSuffix = /_(zero|one|two|few|many|other)$/;

function readNamespace(locale: 'en' | 'pl', filename: string): unknown {
  return JSON.parse(readFileSync(join(i18nDirectory, locale, filename), 'utf8'));
}

function flattenStrings(value: unknown, prefix = ''): Map<string, string> {
  const entries = new Map<string, string>();

  if (typeof value === 'string') {
    entries.set(prefix, value);
    return entries;
  }

  assert.ok(value && typeof value === 'object' && !Array.isArray(value));

  for (const [key, child] of Object.entries(value)) {
    const childPrefix = prefix ? `${prefix}.${key}` : key;
    for (const [childKey, childValue] of flattenStrings(child, childPrefix)) {
      entries.set(childKey, childValue);
    }
  }

  return entries;
}

function comparableKeys(entries: Map<string, string>) {
  return [...new Set([...entries.keys()].map((key) => key.replace(pluralSuffix, '')))].sort();
}

test('English and Polish expose the same translation namespaces and keys', () => {
  const englishFiles = readdirSync(join(i18nDirectory, 'en')).sort();
  const polishFiles = readdirSync(join(i18nDirectory, 'pl')).sort();

  assert.deepEqual(polishFiles, englishFiles);

  for (const filename of englishFiles) {
    const english = flattenStrings(readNamespace('en', filename));
    const polish = flattenStrings(readNamespace('pl', filename));

    assert.deepEqual(comparableKeys(polish), comparableKeys(english), filename);
  }
});

test('all translated values contain visible copy', () => {
  for (const locale of ['en', 'pl'] as const) {
    for (const filename of readdirSync(join(i18nDirectory, locale))) {
      for (const [key, value] of flattenStrings(readNamespace(locale, filename))) {
        assert.ok(value.trim(), `${locale}/${filename}: ${key}`);
      }
    }
  }
});
