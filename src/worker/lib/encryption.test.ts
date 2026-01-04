import { describe, it, expect, beforeAll } from 'vitest';
import { encryptCredentials, decryptCredentials } from './encryption';

describe('Envelope Encryption', () => {
    // 32-character key for testing
    const validMasterKey = '12345678901234567890123456789012';
    const shortMasterKey = 'short-key';

    // We need to ensure the crypto web API is available globaly if not already
    // but in modern node/vitest setup it is usually there.
    // If not, we might need: global.crypto = require('crypto').webcrypto;

    it('should throw error if master key is too short', async () => {
        const credentials = JSON.stringify({ foo: 'bar' });
        await expect(encryptCredentials(shortMasterKey, credentials))
            .rejects.toThrow('Encryption Master Key must be at least 32 characters long');

        // Also check decrypt throws
        await expect(decryptCredentials(shortMasterKey, new Uint8Array(), new Uint8Array()))
            .rejects.toThrow('Encryption Master Key must be at least 32 characters long');
    });

    it('should encrypt and decrypt correctly with valid key', async () => {
        const credentials = JSON.stringify({ apiKey: 'secret-123', id: 456 });

        const encrypted = await encryptCredentials(validMasterKey, credentials);

        expect(encrypted.encryptedCredentials).toBeDefined();
        expect(encrypted.encryptedDataKey).toBeDefined();

        // Ciphertext should be different from input
        expect(new TextDecoder().decode(encrypted.encryptedCredentials)).not.toContain('secret-123');

        const decrypted = await decryptCredentials(
            validMasterKey,
            encrypted.encryptedCredentials,
            encrypted.encryptedDataKey
        );

        expect(decrypted).toBe(credentials);
        const parsed = JSON.parse(decrypted);
        expect(parsed.apiKey).toBe('secret-123');
        expect(parsed.id).toBe(456);
    });

    it('should produce different ciphertexts for same input (random IV)', async () => {
        const credentials = 'sensitive-data';

        const enc1 = await encryptCredentials(validMasterKey, credentials);
        const enc2 = await encryptCredentials(validMasterKey, credentials);

        // Encrypted DEKs should be different (new DEK generation)
        expect(enc1.encryptedDataKey).not.toEqual(enc2.encryptedDataKey);

        // Encrypted credentials should be different (random IV)
        expect(enc1.encryptedCredentials).not.toEqual(enc2.encryptedCredentials);

        // Both should decrypt to same original value
        const dec1 = await decryptCredentials(validMasterKey, enc1.encryptedCredentials, enc1.encryptedDataKey);
        const dec2 = await decryptCredentials(validMasterKey, enc2.encryptedCredentials, enc2.encryptedDataKey);

        expect(dec1).toBe(credentials);
        expect(dec2).toBe(credentials);
    });
});
