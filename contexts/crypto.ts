import AsyncStorage from "@react-native-async-storage/async-storage";
import crypto from "react-native-quick-crypto";
import { EncodingOptions } from "react-native-quick-crypto/lib/typescript/src/keys";

export async function signMessage(message: string): Promise<string> {
    const privateKey = await AsyncStorage.getItem('privateKey');
    if (!privateKey) {
        console.error('Brak prywatnego klucza. Nie można odszyfrować wiadomości.');
        throw Error("Couldn't load private key.");
    }

    const sign = crypto.createSign('SHA256');
    sign.update(message, 'base64');
    const encryptedAesKeySignature = sign.sign({ key: privateKey }, 'base64') as string;
    return encryptedAesKeySignature;
}

export function verifySignature(encryptedAesKey: string, senderPublicKey: string, encryptedAesKeySignature: string) {
    const verify = crypto.createVerify('SHA256');
    verify.update(encryptedAesKey, 'base64');
    const isValid = verify.verify(
        { key: senderPublicKey, encoding: 'utf-8' } as EncodingOptions,
        Buffer.from(encryptedAesKeySignature, 'base64')
    );
    if (!isValid) {
        throw new Error('Signature verification failed');
    }
}

export function encodeAndEncryptMessage(message: string, aesKey: string, iv: string): { encryptedMessage: string; authTag: string } {
    const encodedMessage = Buffer.from(message, 'utf-8').toString('base64');

    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(aesKey, 'base64'), Buffer.from(iv, 'base64'));
    let encryptedMessage = cipher.update(encodedMessage, 'utf8', 'base64');
    encryptedMessage += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');
    return { encryptedMessage, authTag };
}

export function decryptAndDecodeMessage(aesKey: string, iv: string, authTag: string, encryptedMessage: string): string {
    const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(aesKey, 'base64'),
        Buffer.from(iv, 'base64')
    );
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    let decryptedMessage = decipher.update(encryptedMessage, 'base64', 'utf8');
    decryptedMessage += decipher.final('utf8');

    const decodedMessage = Buffer.from(decryptedMessage, 'base64').toString('utf-8');
    return decodedMessage;
}