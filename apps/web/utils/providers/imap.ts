// utils/providers/imap.ts
import Imap from 'node-imap';
import { simpleParser } from 'mailparser';
import * as crypto from 'crypto';

import { env } from '@/env';

function encrypt(text: string) {
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(env.IMAP_ENCRYPT_SECRET, 'hex'), Buffer.from(env.IMAP_ENCRYPT_SALT, 'hex'));
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted + ':' + cipher.getAuthTag().toString('hex');
}

function decrypt(encryptedText: string) {
  const [encrypted, authTag] = encryptedText.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(env.IMAP_ENCRYPT_SECRET, 'hex'), Buffer.from(env.IMAP_ENCRYPT_SALT, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function createImapConnection(config: { host: string; port: number; user: string; encryptedPassword: string }) {
  const imap = new Imap({
    user: config.user,
    password: decrypt(config.encryptedPassword),
    host: config.host,
    port: config.port,
    tls: true
  });
  return imap;
}

// Fetch Function Example
async function fetchUnseenEmails(imap) {
  // Implementation as per research
}
