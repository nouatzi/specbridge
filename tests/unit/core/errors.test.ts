/**
 * Core Error Classes Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  SpecBridgeError,
  ConfigError,
  DecisionValidationError,
  DecisionNotFoundError,
  RegistryError,
  VerificationError,
  InferenceError,
  FileSystemError,
  AlreadyInitializedError,
  NotInitializedError,
  VerifierNotFoundError,
  AnalyzerNotFoundError,
  HookError,
  formatError,
} from '../../../src/core/errors/index.js';

describe('Core Error Classes', () => {
  describe('SpecBridgeError', () => {
    it('should create error with message and code', () => {
      const error = new SpecBridgeError('Test error', 'TEST_ERROR');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SpecBridgeError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.name).toBe('SpecBridgeError');
    });

    it('should include optional details', () => {
      const details = { foo: 'bar', count: 42 };
      const error = new SpecBridgeError('Test error', 'TEST_ERROR', details);

      expect(error.details).toEqual(details);
    });

    it('should work without details', () => {
      const error = new SpecBridgeError('Test error', 'TEST_ERROR');

      expect(error.details).toBeUndefined();
    });

    it('should capture stack trace', () => {
      const error = new SpecBridgeError('Test error', 'TEST_ERROR');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('SpecBridgeError');
    });

    it('should be throwable and catchable', () => {
      expect(() => {
        throw new SpecBridgeError('Test error', 'TEST_ERROR');
      }).toThrow(SpecBridgeError);
    });
  });

  describe('ConfigError', () => {
    it('should create config error with correct code', () => {
      const error = new ConfigError('Invalid config');

      expect(error).toBeInstanceOf(SpecBridgeError);
      expect(error.message).toBe('Invalid config');
      expect(error.code).toBe('CONFIG_ERROR');
      expect(error.name).toBe('ConfigError');
    });

    it('should accept details', () => {
      const details = { field: 'sourceRoots', reason: 'missing' };
      const error = new ConfigError('Config validation failed', details);

      expect(error.details).toEqual(details);
    });

    it('should work without details', () => {
      const error = new ConfigError('Config error');

      expect(error.details).toBeUndefined();
    });
  });

  describe('DecisionValidationError', () => {
    it('should create validation error with decision ID and errors', () => {
      const validationErrors = ['Missing field: title', 'Invalid status'];
      const error = new DecisionValidationError(
        'Decision validation failed',
        'dec-001',
        validationErrors
      );

      expect(error).toBeInstanceOf(SpecBridgeError);
      expect(error.message).toBe('Decision validation failed');
      expect(error.code).toBe('DECISION_VALIDATION_ERROR');
      expect(error.name).toBe('DecisionValidationError');
      expect(error.decisionId).toBe('dec-001');
      expect(error.validationErrors).toEqual(validationErrors);
    });

    it('should include validation errors in details', () => {
      const validationErrors = ['Error 1', 'Error 2'];
      const error = new DecisionValidationError(
        'Validation failed',
        'dec-001',
        validationErrors
      );

      expect(error.details).toEqual({
        decisionId: 'dec-001',
        validationErrors,
      });
    });

    it('should handle empty validation errors array', () => {
      const error = new DecisionValidationError('Validation failed', 'dec-001', []);

      expect(error.validationErrors).toEqual([]);
    });

    it('should handle many validation errors', () => {
      const validationErrors = Array.from({ length: 10 }, (_, i) => `Error ${i}`);
      const error = new DecisionValidationError(
        'Multiple errors',
        'dec-001',
        validationErrors
      );

      expect(error.validationErrors.length).toBe(10);
    });
  });

  describe('DecisionNotFoundError', () => {
    it('should create error with decision ID', () => {
      const error = new DecisionNotFoundError('dec-001');

      expect(error).toBeInstanceOf(SpecBridgeError);
      expect(error.message).toBe('Decision not found: dec-001');
      expect(error.code).toBe('DECISION_NOT_FOUND');
      expect(error.name).toBe('DecisionNotFoundError');
    });

    it('should include decision ID in details', () => {
      const error = new DecisionNotFoundError('dec-001');

      expect(error.details).toEqual({ decisionId: 'dec-001' });
    });

    it('should handle special characters in decision ID', () => {
      const error = new DecisionNotFoundError('dec-001/special-chars_123');

      expect(error.message).toContain('dec-001/special-chars_123');
    });
  });

  describe('RegistryError', () => {
    it('should create registry error with correct code', () => {
      const error = new RegistryError('Registry operation failed');

      expect(error).toBeInstanceOf(SpecBridgeError);
      expect(error.message).toBe('Registry operation failed');
      expect(error.code).toBe('REGISTRY_ERROR');
      expect(error.name).toBe('RegistryError');
    });

    it('should accept details', () => {
      const details = { operation: 'load', path: '/path/to/registry' };
      const error = new RegistryError('Load failed', details);

      expect(error.details).toEqual(details);
    });

    it('should work without details', () => {
      const error = new RegistryError('Registry error');

      expect(error.details).toBeUndefined();
    });
  });

  describe('VerificationError', () => {
    it('should create verification error with correct code', () => {
      const error = new VerificationError('Verification failed');

      expect(error).toBeInstanceOf(SpecBridgeError);
      expect(error.message).toBe('Verification failed');
      expect(error.code).toBe('VERIFICATION_ERROR');
      expect(error.name).toBe('VerificationError');
    });

    it('should accept details', () => {
      const details = { violationCount: 5, criticalCount: 2 };
      const error = new VerificationError('Critical violations found', details);

      expect(error.details).toEqual(details);
    });

    it('should work without details', () => {
      const error = new VerificationError('Verification error');

      expect(error.details).toBeUndefined();
    });
  });

  describe('InferenceError', () => {
    it('should create inference error with correct code', () => {
      const error = new InferenceError('Inference failed');

      expect(error).toBeInstanceOf(SpecBridgeError);
      expect(error.message).toBe('Inference failed');
      expect(error.code).toBe('INFERENCE_ERROR');
      expect(error.name).toBe('InferenceError');
    });

    it('should accept details', () => {
      const details = { analyzer: 'naming', filesScanned: 100 };
      const error = new InferenceError('Analyzer failed', details);

      expect(error.details).toEqual(details);
    });

    it('should work without details', () => {
      const error = new InferenceError('Inference error');

      expect(error.details).toBeUndefined();
    });
  });

  describe('FileSystemError', () => {
    it('should create file system error with path', () => {
      const error = new FileSystemError('File not found', '/path/to/file.ts');

      expect(error).toBeInstanceOf(SpecBridgeError);
      expect(error.message).toBe('File not found');
      expect(error.code).toBe('FILE_SYSTEM_ERROR');
      expect(error.name).toBe('FileSystemError');
      expect(error.path).toBe('/path/to/file.ts');
    });

    it('should include path in details', () => {
      const error = new FileSystemError('Permission denied', '/etc/config');

      expect(error.details).toEqual({ path: '/etc/config' });
    });

    it('should handle relative paths', () => {
      const error = new FileSystemError('File error', './relative/path.ts');

      expect(error.path).toBe('./relative/path.ts');
    });

    it('should handle Windows paths', () => {
      const error = new FileSystemError('File error', 'C:\\Users\\test\\file.ts');

      expect(error.path).toBe('C:\\Users\\test\\file.ts');
    });
  });

  describe('AlreadyInitializedError', () => {
    it('should create error with initialization path', () => {
      const error = new AlreadyInitializedError('/project/path');

      expect(error).toBeInstanceOf(SpecBridgeError);
      expect(error.message).toBe('SpecBridge is already initialized at /project/path');
      expect(error.code).toBe('ALREADY_INITIALIZED');
      expect(error.name).toBe('AlreadyInitializedError');
    });

    it('should include path in details', () => {
      const error = new AlreadyInitializedError('/project/path');

      expect(error.details).toEqual({ path: '/project/path' });
    });
  });

  describe('NotInitializedError', () => {
    it('should create error with helpful message', () => {
      const error = new NotInitializedError();

      expect(error).toBeInstanceOf(SpecBridgeError);
      expect(error.message).toBe('SpecBridge is not initialized. Run "specbridge init" first.');
      expect(error.code).toBe('NOT_INITIALIZED');
      expect(error.name).toBe('NotInitializedError');
    });

    it('should not require any parameters', () => {
      expect(() => new NotInitializedError()).not.toThrow();
    });

    it('should not have details', () => {
      const error = new NotInitializedError();

      expect(error.details).toBeUndefined();
    });
  });

  describe('VerifierNotFoundError', () => {
    it('should create error with verifier ID', () => {
      const error = new VerifierNotFoundError('custom-verifier');

      expect(error).toBeInstanceOf(SpecBridgeError);
      expect(error.message).toBe('Verifier not found: custom-verifier');
      expect(error.code).toBe('VERIFIER_NOT_FOUND');
      expect(error.name).toBe('VerifierNotFoundError');
    });

    it('should include verifier ID in details', () => {
      const error = new VerifierNotFoundError('custom-verifier');

      expect(error.details).toEqual({ verifierId: 'custom-verifier' });
    });
  });

  describe('AnalyzerNotFoundError', () => {
    it('should create error with analyzer ID', () => {
      const error = new AnalyzerNotFoundError('custom-analyzer');

      expect(error).toBeInstanceOf(SpecBridgeError);
      expect(error.message).toBe('Analyzer not found: custom-analyzer');
      expect(error.code).toBe('ANALYZER_NOT_FOUND');
      expect(error.name).toBe('AnalyzerNotFoundError');
    });

    it('should include analyzer ID in details', () => {
      const error = new AnalyzerNotFoundError('custom-analyzer');

      expect(error.details).toEqual({ analyzerId: 'custom-analyzer' });
    });
  });

  describe('HookError', () => {
    it('should create hook error with correct code', () => {
      const error = new HookError('Hook installation failed');

      expect(error).toBeInstanceOf(SpecBridgeError);
      expect(error.message).toBe('Hook installation failed');
      expect(error.code).toBe('HOOK_ERROR');
      expect(error.name).toBe('HookError');
    });

    it('should accept details', () => {
      const details = { hookType: 'pre-commit', reason: 'permission denied' };
      const error = new HookError('Installation failed', details);

      expect(error.details).toEqual(details);
    });

    it('should work without details', () => {
      const error = new HookError('Hook error');

      expect(error.details).toBeUndefined();
    });
  });

  describe('formatError', () => {
    it('should format SpecBridgeError with code', () => {
      const error = new SpecBridgeError('Test error', 'TEST_ERROR');
      const formatted = formatError(error);

      expect(formatted).toContain('Error [TEST_ERROR]');
      expect(formatted).toContain('Test error');
    });

    it('should include details in formatted output', () => {
      const error = new SpecBridgeError('Test error', 'TEST_ERROR', {
        foo: 'bar',
        count: 42,
      });
      const formatted = formatError(error);

      expect(formatted).toContain('foo: bar');
      expect(formatted).toContain('count: 42');
    });

    it('should exclude validationErrors from details section', () => {
      const error = new DecisionValidationError(
        'Validation failed',
        'dec-001',
        ['Error 1', 'Error 2']
      );
      const formatted = formatError(error);

      // validationErrors should not appear in details section
      expect(formatted).not.toMatch(/details:.*validationErrors/);
    });

    it('should format DecisionValidationError with validation errors list', () => {
      const error = new DecisionValidationError(
        'Validation failed',
        'dec-001',
        ['Missing title', 'Invalid status']
      );
      const formatted = formatError(error);

      expect(formatted).toContain('Validation errors:');
      expect(formatted).toContain('- Missing title');
      expect(formatted).toContain('- Invalid status');
    });

    it('should not show validation errors section if array is empty', () => {
      const error = new DecisionValidationError('Validation failed', 'dec-001', []);
      const formatted = formatError(error);

      expect(formatted).not.toContain('Validation errors:');
    });

    it('should format regular Error without code', () => {
      const error = new Error('Regular error');
      const formatted = formatError(error);

      expect(formatted).toBe('Error: Regular error');
      expect(formatted).not.toContain('[');
    });

    it('should handle errors with undefined details', () => {
      const error = new ConfigError('Config error');
      const formatted = formatError(error);

      expect(formatted).toContain('Error [CONFIG_ERROR]');
      expect(formatted).toContain('Config error');
    });

    it('should handle errors with empty details object', () => {
      const error = new ConfigError('Config error', {});
      const formatted = formatError(error);

      expect(formatted).toContain('Error [CONFIG_ERROR]');
      expect(formatted).toContain('Config error');
    });

    it('should format nested objects in details', () => {
      const error = new VerificationError('Verification failed', {
        result: { passed: false, violations: 5 },
      });
      const formatted = formatError(error);

      expect(formatted).toContain('result:');
      expect(formatted).toContain('[object Object]');
    });

    it('should handle multiline error messages', () => {
      const error = new SpecBridgeError(
        'Line 1\nLine 2\nLine 3',
        'MULTILINE_ERROR'
      );
      const formatted = formatError(error);

      expect(formatted).toContain('Line 1');
      expect(formatted).toContain('Line 2');
      expect(formatted).toContain('Line 3');
    });

    it('should handle special characters in error messages', () => {
      const error = new SpecBridgeError(
        'Error with special chars: <>&"\'',
        'SPECIAL_CHARS'
      );
      const formatted = formatError(error);

      expect(formatted).toContain('Error with special chars: <>&"\'');
    });

    it('should format errors with numeric details', () => {
      const error = new VerificationError('Failed', {
        count: 0,
        percentage: 99.9,
      });
      const formatted = formatError(error);

      expect(formatted).toContain('count: 0');
      expect(formatted).toContain('percentage: 99.9');
    });

    it('should format errors with boolean details', () => {
      const error = new ConfigError('Config issue', {
        enabled: true,
        valid: false,
      });
      const formatted = formatError(error);

      expect(formatted).toContain('enabled: true');
      expect(formatted).toContain('valid: false');
    });

    it('should format errors with null details values', () => {
      const error = new RegistryError('Registry issue', {
        value: null,
      });
      const formatted = formatError(error);

      expect(formatted).toContain('value: null');
    });

    it('should format errors with undefined details values', () => {
      const error = new RegistryError('Registry issue', {
        value: undefined,
      });
      const formatted = formatError(error);

      expect(formatted).toContain('value: undefined');
    });

    it('should format multiple details fields correctly', () => {
      const error = new VerificationError('Verification failed', {
        file: 'test.ts',
        line: 42,
        severity: 'critical',
        constraintId: 'auth-001-c1',
      });
      const formatted = formatError(error);

      expect(formatted).toContain('file: test.ts');
      expect(formatted).toContain('line: 42');
      expect(formatted).toContain('severity: critical');
      expect(formatted).toContain('constraintId: auth-001-c1');
    });
  });

  describe('Error inheritance chain', () => {
    it('should maintain proper instanceof checks', () => {
      const configError = new ConfigError('Test');

      expect(configError instanceof Error).toBe(true);
      expect(configError instanceof SpecBridgeError).toBe(true);
      expect(configError instanceof ConfigError).toBe(true);
    });

    it('should not cross-match different error types', () => {
      const configError = new ConfigError('Test');
      const registryError = new RegistryError('Test');

      expect(configError instanceof RegistryError).toBe(false);
      expect(registryError instanceof ConfigError).toBe(false);
    });

    it('should allow catching as base type', () => {
      try {
        throw new ConfigError('Test');
      } catch (error) {
        expect(error instanceof SpecBridgeError).toBe(true);
        expect(error instanceof Error).toBe(true);
      }
    });

    it('should allow catching specific error types', () => {
      let caught = false;
      try {
        throw new DecisionNotFoundError('dec-001');
      } catch (error) {
        if (error instanceof DecisionNotFoundError) {
          caught = true;
          expect(error.details?.decisionId).toBe('dec-001');
        }
      }
      expect(caught).toBe(true);
    });
  });

  describe('Error message formatting', () => {
    it('should create clear error messages', () => {
      const errors = [
        new ConfigError('Invalid configuration'),
        new DecisionNotFoundError('dec-001'),
        new VerifierNotFoundError('custom-verifier'),
        new AnalyzerNotFoundError('custom-analyzer'),
        new AlreadyInitializedError('/path'),
        new NotInitializedError(),
      ];

      for (const error of errors) {
        expect(error.message).toBeTruthy();
        expect(error.message.length).toBeGreaterThan(0);
      }
    });

    it('should provide actionable messages', () => {
      const error = new NotInitializedError();

      expect(error.message).toContain('Run "specbridge init"');
    });
  });
});
