/**
 * Verifier Instance Pooling Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getVerifier, clearVerifierPool, getVerifierIds } from '../../../src/verification/verifiers/index.js';
import { resetPluginLoader } from '../../../src/verification/plugins/loader.js';

describe('Verifier Instance Pooling', () => {
  afterEach(() => {
    clearVerifierPool();
    resetPluginLoader();
  });

  describe('Instance Reuse', () => {
    it('should return same instance on multiple calls', () => {
      const verifier1 = getVerifier('naming');
      const verifier2 = getVerifier('naming');

      expect(verifier1).toBe(verifier2);
      expect(verifier1).toBeTruthy();
    });

    it('should return different instances for different verifiers', () => {
      const naming = getVerifier('naming');
      const imports = getVerifier('imports');

      expect(naming).toBeTruthy();
      expect(imports).toBeTruthy();
      expect(naming).not.toBe(imports);
    });

    it('should pool all built-in verifiers', () => {
      const builtinIds = ['naming', 'imports', 'errors', 'regex', 'dependencies', 'complexity', 'security', 'api'];

      const instances = builtinIds.map(id => getVerifier(id));

      // All should be truthy
      instances.forEach(instance => expect(instance).toBeTruthy());

      // Get them again
      const instances2 = builtinIds.map(id => getVerifier(id));

      // Should be same instances
      instances.forEach((instance, i) => {
        expect(instance).toBe(instances2[i]);
      });
    });
  });

  describe('Pool Clearing', () => {
    it('should clear pool and create new instances', () => {
      const verifier1 = getVerifier('naming');

      clearVerifierPool();

      const verifier2 = getVerifier('naming');

      expect(verifier1).toBeTruthy();
      expect(verifier2).toBeTruthy();
      expect(verifier1).not.toBe(verifier2);
    });

    it('should clear all pooled instances', () => {
      getVerifier('naming');
      getVerifier('imports');
      getVerifier('errors');

      clearVerifierPool();

      const naming2 = getVerifier('naming');
      const imports2 = getVerifier('imports');
      const errors2 = getVerifier('errors');

      expect(naming2).toBeTruthy();
      expect(imports2).toBeTruthy();
      expect(errors2).toBeTruthy();
    });
  });

  describe('Performance Impact', () => {
    it('should reuse instances across calls', () => {
      // Call multiple times
      const instances = [];
      for (let i = 0; i < 100; i++) {
        instances.push(getVerifier('naming'));
      }

      // All should be the exact same instance
      const first = instances[0];
      instances.forEach(instance => {
        expect(instance).toBe(first);
      });

      // This validates pooling works without flaky timing tests
    });
  });

  describe('Null Handling', () => {
    it('should return null for non-existent verifier', () => {
      const verifier = getVerifier('non-existent-verifier');

      expect(verifier).toBeNull();
    });

    it('should not pool null results', () => {
      const verifier1 = getVerifier('non-existent');
      const verifier2 = getVerifier('non-existent');

      expect(verifier1).toBeNull();
      expect(verifier2).toBeNull();
    });
  });

  describe('Verifier IDs', () => {
    it('should return all built-in verifier IDs', () => {
      const ids = getVerifierIds();

      expect(ids).toContain('naming');
      expect(ids).toContain('imports');
      expect(ids).toContain('errors');
      expect(ids).toContain('regex');
      expect(ids).toContain('dependencies');
      expect(ids).toContain('complexity');
      expect(ids).toContain('security');
      expect(ids).toContain('api');
      expect(ids.length).toBeGreaterThanOrEqual(8);
    });

    it('should return unique verifier IDs', () => {
      const ids = getVerifierIds();
      const uniqueIds = [...new Set(ids)];

      expect(ids.length).toBe(uniqueIds.length);
    });
  });
});
