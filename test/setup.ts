import { afterAll, beforeAll } from "vitest";
import { cleanupTestBucket, setupTestBucket, setupTestFiles } from "./helpers/minio-setup";

// Check if this is an integration test
const isIntegrationTest =
  process.env.TEST_TYPE === "integration" ||
  process.argv.some((arg) => arg.includes("integration"));

// Global test setup
beforeAll(async () => {
  // Skip MinIO setup for unit tests
  if (!isIntegrationTest) {
    console.log("Unit test - skipping MinIO setup");
    return;
  }

  console.log("Setting up test environment with MinIO...");

  try {
    // Set up test buckets
    const buckets = (process.env.S3_BUCKETS || "").split(",").filter((b) => b.trim() !== "");
    if (buckets.length > 0) {
      // Set up each bucket and upload test files
      await Promise.all(
        buckets.map(async (bucket) => {
          await setupTestBucket(bucket);
          await setupTestFiles(bucket);
        }),
      );
    } else {
      // Create default test buckets
      await setupTestBucket("test-bucket-1");
      await setupTestFiles("test-bucket-1");
      await setupTestBucket("test-bucket-2");
    }

    console.log("MinIO test environment ready");
  } catch (error) {
    console.error("Failed to set up MinIO test environment:", error);
    console.error("Make sure MinIO is running (e.g., via Docker Compose)");
    if (isIntegrationTest) {
      throw error;
    }
    console.warn("Continuing with unit tests despite MinIO setup failure");
  }
});

// Cleanup after tests
afterAll(async () => {
  // Skip MinIO cleanup for unit tests
  if (!isIntegrationTest) {
    console.log("Unit test - skipping MinIO cleanup");
    return;
  }

  console.log("Cleaning up test environment...");

  try {
    const buckets = (process.env.S3_BUCKETS || "").split(",").filter((b) => b.trim() !== "");
    if (buckets.length > 0) {
      await Promise.all(buckets.map((bucket) => cleanupTestBucket(bucket)));
    } else {
      await cleanupTestBucket("test-bucket-1");
      await cleanupTestBucket("test-bucket-2");
    }

    console.log("Test environment cleanup completed");
  } catch (error) {
    console.error("Error during test environment cleanup:", error);
  }
});
