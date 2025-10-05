// Encryption utilities using Web Crypto API

export class CryptoService {
    private static readonly SALT_LENGTH = 16;
    private static readonly IV_LENGTH = 12;
    private static readonly KEY_LENGTH = 256;
    private static readonly ITERATIONS = 100000;

    /**
     * Derives an encryption key from a password
     */
    private static async deriveKey(password: string, salt: BufferSource): Promise<CryptoKey> {
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);

        // Import password as a key
        const passwordKey = await crypto.subtle.importKey(
            'raw',
            passwordBuffer,
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );

        // Derive encryption key
        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: this.ITERATIONS,
                hash: 'SHA-256'
            },
            passwordKey,
            { name: 'AES-GCM', length: this.KEY_LENGTH },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Encrypts data using AES-GCM
     */
    static async encrypt(data: string, password: string): Promise<string> {
        try {
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(data);

            // Generate random salt and IV
            const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
            const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

            // Derive key
            const key = await this.deriveKey(password, salt);

            // Encrypt
            const encryptedBuffer = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                dataBuffer
            );

            // Combine salt + iv + encrypted data
            const combined = new Uint8Array(salt.length + iv.length + encryptedBuffer.byteLength);
            combined.set(salt, 0);
            combined.set(iv, salt.length);
            combined.set(new Uint8Array(encryptedBuffer), salt.length + iv.length);

            // Convert to base64
            return this.arrayBufferToBase64(combined);
        } catch (error) {
            throw new Error(`Encryption failed: ${error}`);
        }
    }

    /**
     * Decrypts data using AES-GCM
     */
    static async decrypt(encryptedData: string, password: string): Promise<string> {
        try {
            // Decode from base64
            const combined = this.base64ToArrayBuffer(encryptedData);

            // Extract salt, iv, and encrypted data
            const salt = combined.slice(0, this.SALT_LENGTH);
            const iv = combined.slice(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
            const encrypted = combined.slice(this.SALT_LENGTH + this.IV_LENGTH);

            // Derive key
            const key = await this.deriveKey(password, salt);

            // Decrypt
            const decryptedBuffer = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encrypted
            );

            // Convert to string
            const decoder = new TextDecoder();
            return decoder.decode(decryptedBuffer);
        } catch (error) {
            throw new Error(`Decryption failed: ${error}`);
        }
    }

    /**
     * Converts ArrayBuffer to base64 string
     */
    private static arrayBufferToBase64(buffer: Uint8Array): string {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Converts base64 string to ArrayBuffer
     */
    private static base64ToArrayBuffer(base64: string): Uint8Array {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    /**
     * Generates a random salt for additional security
     */
    static generateSalt(): string {
        const salt = crypto.getRandomValues(new Uint8Array(32));
        return this.arrayBufferToBase64(salt);
    }

    /**
     * Hash a password for verification
     */
    static async hashPassword(password: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return this.arrayBufferToBase64(new Uint8Array(hash));
    }
}
