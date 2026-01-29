import { describe, it, expect } from 'vitest';
import { parseYaml, stringifyYaml, parseYamlDocument, updateYamlDocument } from '../../../src/utils/yaml';

describe('YAML Utilities', () => {
  describe('parseYaml', () => {
    it('should parse simple YAML', () => {
      const yaml = 'name: test\nvalue: 42';
      const result = parseYaml(yaml);

      expect(result).toEqual({ name: 'test', value: 42 });
    });

    it('should parse nested objects', () => {
      const yaml = `
metadata:
  id: test-001
  nested:
    value: 42
      `.trim();

      const result = parseYaml<any>(yaml);

      expect(result.metadata.id).toBe('test-001');
      expect(result.metadata.nested.value).toBe(42);
    });

    it('should parse arrays', () => {
      const yaml = `
items:
  - first
  - second
  - third
      `.trim();

      const result = parseYaml<any>(yaml);

      expect(result.items).toEqual(['first', 'second', 'third']);
    });

    it('should parse boolean values', () => {
      const yaml = 'enabled: true\ndisabled: false';
      const result = parseYaml<any>(yaml);

      expect(result.enabled).toBe(true);
      expect(result.disabled).toBe(false);
    });

    it('should parse null values', () => {
      const yaml = 'value: null';
      const result = parseYaml<any>(yaml);

      expect(result.value).toBeNull();
    });

    it('should handle empty string', () => {
      const result = parseYaml('');

      expect(result).toBeNull();
    });
  });

  describe('stringifyYaml', () => {
    it('should stringify simple objects', () => {
      const obj = { name: 'test', value: 42 };
      const yaml = stringifyYaml(obj);

      expect(yaml).toContain('name: test');
      expect(yaml).toContain('value: 42');
    });

    it('should stringify nested objects', () => {
      const obj = {
        metadata: {
          id: 'test-001',
          nested: { value: 42 },
        },
      };
      const yaml = stringifyYaml(obj);

      expect(yaml).toContain('metadata:');
      expect(yaml).toContain('id: test-001');
      expect(yaml).toContain('value: 42');
    });

    it('should stringify arrays', () => {
      const obj = { items: ['first', 'second', 'third'] };
      const yaml = stringifyYaml(obj);

      expect(yaml).toContain('items:');
      expect(yaml).toContain('- first');
      expect(yaml).toContain('- second');
    });

    it('should respect custom indent', () => {
      const obj = { nested: { value: 42 } };
      const yaml = stringifyYaml(obj, { indent: 4 });

      expect(yaml).toContain('nested:');
    });

    it('should round-trip parse and stringify', () => {
      const original = {
        name: 'test',
        value: 42,
        items: ['a', 'b'],
        nested: { key: 'value' },
      };

      const yaml = stringifyYaml(original);
      const parsed = parseYaml(yaml);

      expect(parsed).toEqual(original);
    });
  });

  describe('parseYamlDocument', () => {
    it('should parse YAML document', () => {
      const yaml = 'name: test\nvalue: 42';
      const doc = parseYamlDocument(yaml);

      expect(doc).toBeDefined();
      expect(doc.contents).toBeDefined();
    });

    it('should preserve document structure', () => {
      const yaml = `
# Comment
name: test
value: 42
      `.trim();

      const doc = parseYamlDocument(yaml);

      expect(doc.toString()).toContain('name: test');
    });
  });

  describe('updateYamlDocument', () => {
    it('should update simple value', () => {
      const yaml = 'name: test\nvalue: 42';
      const doc = parseYamlDocument(yaml);

      updateYamlDocument(doc, ['name'], 'updated');

      const updated = doc.toString();
      expect(updated).toContain('updated');
    });

    it('should update nested value', () => {
      const yaml = `
metadata:
  id: test-001
  value: 42
      `.trim();

      const doc = parseYamlDocument(yaml);

      updateYamlDocument(doc, ['metadata', 'value'], 100);

      const updated = doc.toString();
      expect(updated).toContain('100');
    });

    it('should handle empty path', () => {
      const yaml = 'name: test';
      const doc = parseYamlDocument(yaml);

      // Should not throw
      expect(() => updateYamlDocument(doc, [], 'value')).not.toThrow();
    });

    it('should handle invalid path', () => {
      const yaml = 'name: test';
      const doc = parseYamlDocument(yaml);

      // Should not throw (no-op)
      expect(() => updateYamlDocument(doc, ['nonexistent', 'path'], 'value')).not.toThrow();
    });
  });
});
