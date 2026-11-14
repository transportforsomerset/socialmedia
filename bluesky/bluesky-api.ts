
const API_URL = "https://bsky.social/xrpc";

const TEST_MESSAGE =
  "Transport for Somerset API test — posted using our own Bun script! 🚍";

interface SessionResponse {
  did: string;
  handle: string;
  accessJwt: string;
}

interface CreateRecordResponse {
  uri: string;
  cid: string;
}

async function apiRequest<T>(
  endpoint: string,
  body: object,
  accessJwt?: string,
): Promise<T> {
  const response = await fetch(`${API_URL}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessJwt
        ? { Authorization: `Bearer ${accessJwt}` }
        : {}),
    },
    body: JSON.stringify(body),
  });

  const result: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = result as {
      error?: string;
      message?: string;
    } | null;

    throw new Error(
      `${endpoint} failed (${response.status}): ${
        error?.message ?? error?.error ?? "Unknown API error"
      }`,
    );
  }

  return result as T;
}

async function main() {
  const identifier = Bun.env.BLUESKY_IDENTIFIER;
  const password = Bun.env.BLUESKY_PASSWORD;

  if (!identifier || !password) {
    throw new Error(
      "Missing BLUESKY_IDENTIFIER or BLUESKY_PASSWORD environment variables.",
    );
  }

  console.log("Connecting to Bluesky...");

  // Step 1: Authenticate
  const session = await apiRequest<SessionResponse>(
    "com.atproto.server.createSession",
    {
      identifier,
      password,
    },
  );

  console.log(`Authenticated as @${session.handle}`);
  console.log("Publishing test message...");

  // Step 2: Create the post
  const post = await apiRequest<CreateRecordResponse>(
    "com.atproto.repo.createRecord",
    {
      repo: session.did,
      collection: "app.bsky.feed.post",
      record: {
        $type: "app.bsky.feed.post",
        text: TEST_MESSAGE,
        createdAt: new Date().toISOString(),
      },
    },
    session.accessJwt,
  );

  const rkey = post.uri.split("/").pop();

  console.log("Successfully published!");
  console.log(`Post URI: ${post.uri}`);
  console.log(
    `Post URL: https://bsky.app/profile/${session.handle}/post/${rkey}`,
  );
}

main().catch((error: unknown) => {
  console.error("Bluesky publishing failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
