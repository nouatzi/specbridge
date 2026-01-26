/**
 * YAML utilities with comment preservation
 */
import { parse, stringify, Document, parseDocument } from 'yaml';

/**
 * Parse YAML string to object
 */
export function parseYaml<T = unknown>(content: string): T {
  return parse(content) as T;
}

/**
 * Stringify object to YAML with nice formatting
 */
export function stringifyYaml(data: unknown, options?: { indent?: number }): string {
  return stringify(data, {
    indent: options?.indent ?? 2,
    lineWidth: 100,
    minContentWidth: 20,
  });
}

/**
 * Parse YAML preserving document structure (for editing)
 */
export function parseYamlDocument(content: string): Document {
  return parseDocument(content);
}

/**
 * Update YAML document preserving comments
 */
export function updateYamlDocument(doc: Document, path: string[], value: unknown): void {
  let current: unknown = doc.contents;

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (key && current && typeof current === 'object' && 'get' in current) {
      current = (current as { get: (key: string) => unknown }).get(key);
    }
  }

  const lastKey = path[path.length - 1];
  if (lastKey && current && typeof current === 'object' && 'set' in current) {
    (current as { set: (key: string, value: unknown) => void }).set(lastKey, value);
  }
}
