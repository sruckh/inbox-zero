import { NextResponse } from "next/server";
import { testImapConnection, encrypt, IMAP_PROVIDERS } from "@/utils/providers/imap";
import { createScopedLogger } from "@/utils/logger";

const logger = createScopedLogger("test-imap-connection");

export async function POST(request: Request) {
  try {
    const { host, port, user, password } = await request.json();
    
    if (!host || !port || !user || !password) {
      return NextResponse.json(
        { error: "Missing required fields: host, port, user, password" },
        { status: 400 }
      );
    }
    
    // Encrypt password for testing
    const encryptedPassword = encrypt(password);
    
    const config = {
      host,
      port: parseInt(port),
      user,
      encryptedPassword
    };
    
    logger.info(`Testing IMAP connection to ${host}:${port} for user ${user}`);
    
    const isConnected = await testImapConnection(config);
    
    if (isConnected) {
      logger.info("IMAP connection test successful");
      return NextResponse.json({ 
        success: true, 
        message: "IMAP connection successful" 
      });
    } else {
      logger.error("IMAP connection test failed");
      return NextResponse.json(
        { error: "IMAP connection failed" },
        { status: 400 }
      );
    }
  } catch (error) {
    logger.error("Error testing IMAP connection:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to return common IMAP providers
export async function GET() {
  return NextResponse.json({ providers: IMAP_PROVIDERS });
}