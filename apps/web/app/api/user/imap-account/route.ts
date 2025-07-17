import { NextResponse } from "next/server";
import prisma from "@/utils/prisma";
import { withAuth } from "@/utils/middleware";
import { encrypt, testImapConnection } from "@/utils/providers/imap";
import { createScopedLogger } from "@/utils/logger";

const logger = createScopedLogger("imap-account");

export type CreateImapAccountBody = {
  host: string;
  port: number;
  user: string;
  password: string;
  name?: string;
};

export const POST = withAuth(async (request) => {
  try {
    const userId = request.auth.userId;
    const body: CreateImapAccountBody = await request.json();
    
    const { host, port, user, password, name } = body;
    
    if (!host || !port || !user || !password) {
      return NextResponse.json(
        { error: "Missing required fields: host, port, user, password" },
        { status: 400 }
      );
    }
    
    // Test connection first
    const encryptedPassword = encrypt(password);
    const config = {
      host,
      port,
      user,
      encryptedPassword
    };
    
    logger.info(`Testing IMAP connection for user ${user}@${host}:${port}`);
    
    const isConnected = await testImapConnection(config);
    
    if (!isConnected) {
      return NextResponse.json(
        { error: "IMAP connection failed. Please check your credentials." },
        { status: 400 }
      );
    }
    
    // Create Account record
    const account = await prisma.account.create({
      data: {
        userId,
        type: "imap",
        provider: "imap",
        providerAccountId: `${user}@${host}`,
        imap_host: host,
        imap_port: port,
        imap_username: user,
        // Store encrypted password in refresh_token field
        refresh_token: encryptedPassword,
      },
    });
    
    // Create EmailAccount record
    const emailAccount = await prisma.emailAccount.create({
      data: {
        email: user,
        userId,
        accountId: account.id,
        name: name || `${user}@${host}`,
      },
    });
    
    logger.info(`Created IMAP account for ${user}@${host}`);
    
    return NextResponse.json({ 
      success: true,
      account: {
        id: emailAccount.id,
        email: emailAccount.email,
        name: emailAccount.name,
        provider: "imap",
      }
    });
    
  } catch (error) {
    logger.error("Error creating IMAP account:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});

export const GET = withAuth(async (request) => {
  try {
    const userId = request.auth.userId;
    
    // Get all IMAP accounts for this user
    const accounts = await prisma.emailAccount.findMany({
      where: {
        userId,
        account: {
          provider: "imap"
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        account: {
          select: {
            imap_host: true,
            imap_port: true,
            imap_username: true,
          }
        }
      }
    });
    
    return NextResponse.json({ accounts });
    
  } catch (error) {
    logger.error("Error fetching IMAP accounts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});