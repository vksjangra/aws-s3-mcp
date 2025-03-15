import { beforeEach, afterEach, vi } from 'vitest';
import { S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

// Mock the S3Client class and its send method
vi.mock('@aws-sdk/client-s3', async () => {
  const actual = await vi.importActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: vi.fn().mockImplementation(() => ({
      send: vi.fn().mockResolvedValue({}),
      config: {},
      middlewareStack: { clone: () => ({ use: () => { } }) },
      destroy: () => { }
    }))
  };
});

// Re-usable mock helper
export const mockS3 = () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });
};

// Helper functions to create mock data
export const createMockBuckets = (count = 3) => {
  return Array(count).fill(0).map((_, index) => ({
    Name: `test-bucket-${index + 1}`,
    CreationDate: new Date()
  }));
};

export const createMockObjects = (count = 5, prefix = 'test-') => {
  return Array(count).fill(0).map((_, index) => ({
    Key: `${prefix}file-${index + 1}.txt`,
    LastModified: new Date(),
    Size: 1024 * (index + 1),
    StorageClass: 'STANDARD'
  }));
};

// Integration test mock for server process
export const mcpServerMock = () => {
  // Mock environment variables
  vi.stubEnv('AWS_REGION', 'us-east-1');
  vi.stubEnv('S3_BUCKETS', 'test-bucket-1,test-bucket-2');
  vi.stubEnv('S3_MAX_BUCKETS', '5');

  return () => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  };
};

// Create mock response for getObject that can handle both text and binary
export const createGetObjectResponse = (content: string | Buffer, contentType: string) => {
  return {
    ContentType: contentType,
    Body: Readable.from([typeof content === 'string' ? Buffer.from(content) : content])
  };
};
