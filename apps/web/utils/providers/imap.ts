// utils/providers/imap.ts
import Imap from 'node-imap';
import { simpleParser } from 'mailparser';
import * as crypto from 'crypto';

import { env } from '@/env';
import { createScopedLogger } from '@/utils/logger';

const logger = createScopedLogger('imap-provider');

function encrypt(text: string) {
  if (!env.IMAP_ENCRYPT_SECRET || !env.IMAP_ENCRYPT_SALT) {
    throw new Error('IMAP encryption keys not configured');
  }
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(env.IMAP_ENCRYPT_SECRET, 'hex'), Buffer.from(env.IMAP_ENCRYPT_SALT, 'hex'));
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted + ':' + cipher.getAuthTag().toString('hex');
}

function decrypt(encryptedText: string) {
  if (!env.IMAP_ENCRYPT_SECRET || !env.IMAP_ENCRYPT_SALT) {
    throw new Error('IMAP encryption keys not configured');
  }
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
    tls: true,
    connTimeout: 10000,
    authTimeout: 5000,
    keepalive: true,
    debug: (info) => logger.debug('IMAP Debug:', info)
  });
  return imap;
}

// Common IMAP server configurations
export const IMAP_PROVIDERS = {
  'imap.gemneye.org': {
    host: 'imap.gemneye.org',
    port: 993,
    tls: true,
    name: 'Gemneye'
  },
  'imap.gmail.com': {
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    name: 'Gmail'
  },
  'mail.cox.net': {
    host: 'mail.cox.net',
    port: 993,
    tls: true,
    name: 'Cox'
  },
  'outlook.office365.com': {
    host: 'outlook.office365.com',
    port: 993,
    tls: true,
    name: 'Outlook'
  }
};

export interface ImapEmail {
  uid: number;
  messageId: string;
  from: string;
  to: string;
  subject: string;
  date: Date;
  textPlain?: string;
  textHtml?: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    size: number;
    content: Buffer;
  }>;
  headers: Record<string, string>;
}

export async function fetchUnseenEmails(imap: Imap, limit: number = 50): Promise<ImapEmail[]> {
  return new Promise((resolve, reject) => {
    const emails: ImapEmail[] = [];
    
    function openInbox(cb: (err: Error | null, box?: any) => void) {
      imap.openBox('INBOX', true, cb);
    }
    
    imap.once('ready', () => {
      logger.info('IMAP connection ready');
      
      openInbox((err, box) => {
        if (err) {
          logger.error('Error opening INBOX:', err);
          reject(err);
          return;
        }
        
        // Search for unseen emails
        imap.search(['UNSEEN'], (err, results) => {
          if (err) {
            logger.error('Error searching for unseen emails:', err);
            reject(err);
            return;
          }
          
          if (!results || results.length === 0) {
            logger.info('No unseen emails found');
            resolve([]);
            return;
          }
          
          // Limit results
          const limitedResults = results.slice(0, limit);
          logger.info(`Found ${results.length} unseen emails, fetching ${limitedResults.length}`);
          
          const fetch = imap.fetch(limitedResults, {
            bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)', 'TEXT'],
            struct: true
          });
          
          fetch.on('message', (msg, seqno) => {
            const email: Partial<ImapEmail> = {};
            
            msg.on('body', (stream, info) => {
              let buffer = '';
              
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });
              
              stream.once('end', () => {
                if (info.which === 'TEXT') {
                  // Parse the full email body
                  simpleParser(buffer, (err, parsed) => {
                    if (err) {
                      logger.error('Error parsing email body:', err);
                      return;
                    }
                    
                    email.textPlain = parsed.text;
                    email.textHtml = parsed.html;
                    email.attachments = parsed.attachments?.map(att => ({
                      filename: att.filename || 'attachment',
                      contentType: att.contentType,
                      size: att.size,
                      content: att.content
                    }));
                  });
                } else {
                  // Parse headers
                  const headers = Imap.parseHeader(buffer);
                  email.from = headers.from?.[0] || '';
                  email.to = headers.to?.[0] || '';
                  email.subject = headers.subject?.[0] || '';
                  email.messageId = headers['message-id']?.[0] || '';
                  email.date = new Date(headers.date?.[0] || Date.now());
                  email.headers = headers;
                }
              });
            });
            
            msg.once('attributes', (attrs) => {
              email.uid = attrs.uid;
            });
            
            msg.once('end', () => {
              if (email.uid) {
                emails.push(email as ImapEmail);
              }
            });
          });
          
          fetch.once('error', (err) => {
            logger.error('Fetch error:', err);
            reject(err);
          });
          
          fetch.once('end', () => {
            logger.info(`Finished fetching ${emails.length} emails`);
            imap.end();
          });
        });
      });
    });
    
    imap.once('error', (err) => {
      logger.error('IMAP connection error:', err);
      reject(err);
    });
    
    imap.once('end', () => {
      logger.info('IMAP connection ended');
      resolve(emails);
    });
    
    imap.connect();
  });
}

export async function markEmailAsRead(imap: Imap, uid: number): Promise<void> {
  return new Promise((resolve, reject) => {
    imap.addFlags(uid, ['\\Seen'], (err) => {
      if (err) {
        logger.error('Error marking email as read:', err);
        reject(err);
      } else {
        logger.info(`Marked email ${uid} as read`);
        resolve();
      }
    });
  });
}

export async function moveEmailToFolder(imap: Imap, uid: number, folderName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    imap.move(uid, folderName, (err) => {
      if (err) {
        logger.error(`Error moving email ${uid} to ${folderName}:`, err);
        reject(err);
      } else {
        logger.info(`Moved email ${uid} to ${folderName}`);
        resolve();
      }
    });
  });
}

export async function testImapConnection(config: { host: string; port: number; user: string; encryptedPassword: string }): Promise<boolean> {
  return new Promise((resolve) => {
    const imap = createImapConnection(config);
    
    imap.once('ready', () => {
      logger.info('IMAP connection test successful');
      imap.end();
      resolve(true);
    });
    
    imap.once('error', (err) => {
      logger.error('IMAP connection test failed:', err);
      resolve(false);
    });
    
    imap.connect();
  });
}

export { encrypt, decrypt };
