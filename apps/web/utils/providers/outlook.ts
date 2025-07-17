// utils/providers/outlook.ts
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import { ClientSecretCredential } from '@azure/identity';

import { env } from '@/env';

export async function getOutlookClient(accessToken: string) {
  const credential = new ClientSecretCredential(
    env.MICROSOFT_TENANT_ID,
    env.MICROSOFT_CLIENT_ID,
    env.MICROSOFT_CLIENT_SECRET
  );
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default']
  });

  return Client.initWithMiddleware({ authProvider });
}

// Function to fetch emails
async function fetchEmails(client, top = 10) {
  const response = await client.api('/me/messages')
    .top(top)
    .orderby('receivedDateTime desc')
    .select('subject,from,receivedDateTime,bodyPreview')
    .get();
  return response.value;
}

// Function to send reply
async function sendReply(client, messageId, replyContent) {
  const reply = {
    message: {
      body: { contentType: 'text', content: replyContent }
    }
  };
  await client.api(`/me/messages/${messageId}/reply`).post(reply);
}
