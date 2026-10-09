interface CloudflareEnv {
  DB: D1Database;
  BLOBS: R2Bucket;
  DATA_ENCRYPTION_KEY?: string;
}
