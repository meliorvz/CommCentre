/**
 * Envelope Encryption for Integration Credentials
 *
 * Uses AES-256-GCM with envelope encryption:
 * 1. Generate random Data Encryption Key (DEK) for each integration
 * 2. Encrypt credentials with DEK
 * 3. Encrypt DEK with master key (from environment)
 * 4. Store both encrypted values
 *
 * Benefits:
 * - Master key rotation only requires re-encrypting DEKs
 * - Each integration has a unique key
 * - Uses Web Crypto API (available in Cloudflare Workers)
 */

export interface EncryptedData {
    encryptedCredentials: Uint8Array;
    encryptedDataKey: Uint8Array;
}

/**
 * Concatenate two Uint8Arrays
 */
function concatArrays(a: Uint8Array, b: Uint8Array): Uint8Array {
    const result = new Uint8Array(a.length + b.length);
    result.set(a);
    result.set(b, a.length);
    return result;
}

/**
 * Derive a 32-byte key from the master key string
 * Uses the first 32 bytes if longer, pads with zeros if shorter
 */
function deriveKey(masterKey: string): Uint8Array {
    if (!masterKey || masterKey.length < 32) {
        throw new Error('Encryption Master Key must be at least 32 characters long');
    }
    const encoded = new TextEncoder().encode(masterKey);
    const key = new Uint8Array(32);
    key.set(encoded.slice(0, 32));
    return key;
}

/**
 * Encrypt credentials using envelope encryption
 *
 * @param masterKey - Master encryption key from environment (32+ chars recommended)
 * @param credentials - JSON string of credentials to encrypt
 * @returns EncryptedData containing encrypted credentials and encrypted data key
 */
export async function encryptCredentials(
    masterKey: string,
    credentials: string
): Promise<EncryptedData> {
    // Generate random data encryption key (32 bytes for AES-256)
    const dataKey = crypto.getRandomValues(new Uint8Array(32));

    // Import master key for encrypting the data key
    const masterCryptoKey = await crypto.subtle.importKey(
        'raw',
        deriveKey(masterKey),
        'AES-GCM',
        false,
        ['encrypt']
    );

    // Import data key for encrypting credentials
    const dataCryptoKey = await crypto.subtle.importKey(
        'raw',
        dataKey,
        'AES-GCM',
        false,
        ['encrypt']
    );

    // Generate unique IVs for each encryption (12 bytes for AES-GCM)
    const credentialsIv = crypto.getRandomValues(new Uint8Array(12));
    const dataKeyIv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt credentials with data key
    const encryptedCreds = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: credentialsIv },
        dataCryptoKey,
        new TextEncoder().encode(credentials)
    );

    // Encrypt data key with master key
    const encryptedDek = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: dataKeyIv },
        masterCryptoKey,
        dataKey
    );

    // Prepend IV to each ciphertext for storage
    // Format: [12 bytes IV][ciphertext + auth tag]
    return {
        encryptedCredentials: concatArrays(credentialsIv, new Uint8Array(encryptedCreds)),
        encryptedDataKey: concatArrays(dataKeyIv, new Uint8Array(encryptedDek)),
    };
}

/**
 * Decrypt credentials using envelope encryption
 *
 * @param masterKey - Master encryption key from environment
 * @param encryptedCredentials - Encrypted credentials (IV + ciphertext)
 * @param encryptedDataKey - Encrypted data key (IV + ciphertext)
 * @returns Decrypted credentials as string
 */
export async function decryptCredentials(
    masterKey: string,
    encryptedCredentials: Uint8Array,
    encryptedDataKey: Uint8Array
): Promise<string> {
    // Extract IVs and ciphertexts
    const dataKeyIv = encryptedDataKey.slice(0, 12);
    const dataKeyCiphertext = encryptedDataKey.slice(12);

    const credentialsIv = encryptedCredentials.slice(0, 12);
    const credentialsCiphertext = encryptedCredentials.slice(12);

    // Import master key for decrypting the data key
    const masterCryptoKey = await crypto.subtle.importKey(
        'raw',
        deriveKey(masterKey),
        'AES-GCM',
        false,
        ['decrypt']
    );

    // Decrypt data key
    const dataKey = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: dataKeyIv },
        masterCryptoKey,
        dataKeyCiphertext
    );

    // Import decrypted data key
    const dataCryptoKey = await crypto.subtle.importKey(
        'raw',
        dataKey,
        'AES-GCM',
        false,
        ['decrypt']
    );

    // Decrypt credentials
    const credentials = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: credentialsIv },
        dataCryptoKey,
        credentialsCiphertext
    );

    return new TextDecoder().decode(credentials);
}
