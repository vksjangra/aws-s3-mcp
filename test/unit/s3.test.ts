import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { S3Resource } from "../../src/resources/s3";
import { createMockBuckets, createMockObjects } from "../mocks/s3Client.mock";
import { Readable } from "stream";

// Mock pdf-parse module
vi.mock("pdf-parse", () => {
  return {
    default: vi.fn().mockResolvedValue({
      text: "Extracted PDF text content",
      numpages: 1,
      info: { Title: "Test PDF" },
      metadata: {},
      version: "1.0",
    }),
  };
});

// Create a mock implementation of S3Client
const mockSend = vi.fn();
vi.mock("@aws-sdk/client-s3", async () => {
  const actual = await vi.importActual("@aws-sdk/client-s3");
  return {
    ...actual,
    S3Client: vi.fn().mockImplementation(() => ({
      send: mockSend,
    })),
  };
});

// Skip MinIO setup/teardown for unit tests
vi.mock("../helpers/minio-setup", () => ({
  setupTestBucket: vi.fn().mockResolvedValue({}),
  cleanupTestBucket: vi.fn().mockResolvedValue({}),
  uploadTestFile: vi.fn().mockResolvedValue({}),
  uploadTestPdf: vi.fn().mockResolvedValue({}),
  setupTestFiles: vi.fn().mockResolvedValue({}),
}));

describe("S3Resource from resources directory", () => {
  let s3Resource: S3Resource;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    mockSend.mockReset();

    // Mock environment variables
    vi.stubEnv("S3_BUCKETS", "test-bucket-1,test-bucket-2");
    vi.stubEnv("AWS_REGION", "us-east-1");
    vi.stubEnv("AWS_ENDPOINT", "http://localhost:9000");
    vi.stubEnv("AWS_ACCESS_KEY_ID", "minioadmin");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "minioadmin");
    vi.stubEnv("AWS_S3_FORCE_PATH_STYLE", "true");

    // Create S3Resource instance
    s3Resource = new S3Resource();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("listBuckets", () => {
    it("should return a list of buckets", async () => {
      // Setup mock data
      const mockBuckets = createMockBuckets(3);

      // Mock successful response
      mockSend.mockResolvedValueOnce({ Buckets: mockBuckets });

      // Execute the method being tested
      const result = await s3Resource.listBuckets();

      // Assertions
      expect(result).toHaveLength(2); // Should only return configured buckets
      expect(result[0].Name).toBe("test-bucket-1");
      expect(result[1].Name).toBe("test-bucket-2");
    });

    it("should limit buckets to the max allowed", async () => {
      // Mock environment variable
      vi.stubEnv("S3_MAX_BUCKETS", "1");
      s3Resource = new S3Resource();

      // Setup mock data
      const mockBuckets = createMockBuckets(3);

      // Mock successful response
      mockSend.mockResolvedValueOnce({ Buckets: mockBuckets });

      // Execute the method being tested
      const result = await s3Resource.listBuckets();

      // Assertions
      expect(result).toHaveLength(1);
    });

    it("should handle errors when listing buckets", async () => {
      // Mock a failure
      mockSend.mockRejectedValueOnce(new Error("Network error"));

      // Execute the method and verify error handling
      await expect(s3Resource.listBuckets()).rejects.toThrow("Network error");
    });
  });

  describe("listObjects", () => {
    it("should return objects from a bucket", async () => {
      // Setup mock data
      const mockObjects = createMockObjects(5);

      // Mock successful response
      mockSend.mockResolvedValueOnce({ Contents: mockObjects });

      // Execute the method being tested
      const result = await s3Resource.listObjects("test-bucket-1");

      // Assertions
      expect(result).toHaveLength(5);
      expect(result[0].Key).toBe("test-file-1.txt");
    });

    it("should throw error if bucket is not in allowed list", async () => {
      // Execute the method being tested with an unauthorized bucket
      const testPromise = s3Resource.listObjects("unauthorized-bucket");

      // Assertions
      await expect(testPromise).rejects.toThrow();
    });

    it("should filter objects based on prefix", async () => {
      // Setup mock data
      const mockObjects = [
        { Key: "folder1/file1.txt" },
        { Key: "folder1/file2.txt" },
        { Key: "folder2/file3.txt" },
      ];

      // Mock successful response
      mockSend.mockResolvedValueOnce({ Contents: mockObjects });

      // Execute the method with a prefix
      const result = await s3Resource.listObjects("test-bucket-1", "folder1/");

      // Verify the correct prefix was used in the command
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: "test-bucket-1",
            Prefix: "folder1/",
          }),
        }),
      );

      // Assertions
      expect(result).toEqual(mockObjects);
    });
  });

  describe("getObject", () => {
    it("should retrieve a text object from a bucket", async () => {
      // Mock text content
      const textContent = "Hello, World!";

      // Mock successful response
      mockSend.mockResolvedValueOnce({
        ContentType: "text/plain",
        Body: Readable.from([Buffer.from(textContent)]),
      });

      // Execute the method being tested
      const result = await s3Resource.getObject("test-bucket-1", "test.txt");

      // Assertions
      expect(result.contentType).toBe("text/plain");
      expect(result.data).toBe(textContent);
    });

    it("should retrieve a binary object from a bucket", async () => {
      // Mock binary content
      const binaryContent = Buffer.from([0x01, 0x02, 0x03, 0x04]);

      // Mock successful response
      mockSend.mockResolvedValueOnce({
        ContentType: "application/octet-stream",
        Body: Readable.from([binaryContent]),
      });

      // Execute the method being tested
      const result = await s3Resource.getObject("test-bucket-1", "test.bin");

      // Assertions
      expect(result.contentType).toBe("application/octet-stream");
      expect(Buffer.isBuffer(result.data)).toBe(true);
      expect(result.data).toEqual(binaryContent);
    });

    it("should throw error if bucket is not in allowed list", async () => {
      // Execute the method being tested with an unauthorized bucket
      const testPromise = s3Resource.getObject("unauthorized-bucket", "test.txt");

      // Assertions
      await expect(testPromise).rejects.toThrow();
    });

    it("should handle non-readable body response", async () => {
      // Mock an invalid response with a non-readable body
      mockSend.mockResolvedValueOnce({
        ContentType: "text/plain",
        Body: "not a readable stream",
      });

      // Execute the method and expect it to throw
      await expect(s3Resource.getObject("test-bucket-1", "test.txt")).rejects.toThrow(
        "Unexpected response body type",
      );
    });
  });

  describe("isTextFile", () => {
    it("should identify text files based on extension", () => {
      // Test various file extensions
      expect(s3Resource.isTextFile("file.txt")).toBe(true);
      expect(s3Resource.isTextFile("file.json")).toBe(true);
      expect(s3Resource.isTextFile("file.html")).toBe(true);
      expect(s3Resource.isTextFile("file.jpg")).toBe(false);
      expect(s3Resource.isTextFile("file.png")).toBe(false);
      expect(s3Resource.isTextFile("file.zip")).toBe(false);
    });

    it("should identify text files based on content type", () => {
      // Test various content types
      expect(s3Resource.isTextFile("file", "text/plain")).toBe(true);
      expect(s3Resource.isTextFile("file", "application/json")).toBe(true);
      expect(s3Resource.isTextFile("file", "application/xml")).toBe(true);
      expect(s3Resource.isTextFile("file", "image/jpeg")).toBe(false);
      expect(s3Resource.isTextFile("file", "application/octet-stream")).toBe(false);
    });
  });

  describe("isPdfFile", () => {
    it("should identify PDF files based on extension", () => {
      // Test various file extensions
      expect(s3Resource.isPdfFile("file.pdf")).toBe(true);
      expect(s3Resource.isPdfFile("file.PDF")).toBe(true);
      expect(s3Resource.isPdfFile("file.txt")).toBe(false);
      expect(s3Resource.isPdfFile("file.jpg")).toBe(false);
    });

    it("should identify PDF files based on content type", () => {
      // Test various content types
      expect(s3Resource.isPdfFile("file", "application/pdf")).toBe(true);
      expect(s3Resource.isPdfFile("file", "text/plain")).toBe(false);
      expect(s3Resource.isPdfFile("file", "image/jpeg")).toBe(false);
    });
  });

  describe("convertPdfToText", () => {
    it("should convert PDF buffer to text", async () => {
      // Create a mock PDF buffer
      const pdfBuffer = Buffer.from("mock pdf content");

      // Execute the method
      const result = await s3Resource.convertPdfToText(pdfBuffer);

      // Assertion
      expect(result).toBe("Extracted PDF text content");
    });

    it("should handle errors during PDF conversion", async () => {
      // Import the actual pdf-parse module to mock it for this specific test
      const pdfParse = await import("pdf-parse");

      // Mock the pdf-parse implementation to throw an error
      vi.spyOn(pdfParse, "default").mockImplementationOnce(() => {
        throw new Error("PDF parsing error");
      });

      // Create a mock PDF buffer
      const pdfBuffer = Buffer.from("corrupt pdf content");

      // Execute the method
      const result = await s3Resource.convertPdfToText(pdfBuffer);

      // Assertion - should return error message
      expect(result).toBe("Error: Could not extract text from PDF file.");
    });
  });

  describe("getObject with PDF", () => {
    it("should extract text from PDF files", async () => {
      // Create a mock PDF buffer
      const pdfBuffer = Buffer.from("mock pdf content");

      // Mock successful response for a PDF file
      mockSend.mockResolvedValueOnce({
        ContentType: "application/pdf",
        Body: Readable.from([pdfBuffer]),
      });

      // Execute the method
      const result = await s3Resource.getObject("test-bucket-1", "document.pdf");

      // Assertions
      expect(result.contentType).toBe("application/pdf");
      expect(result.data).toBe("Extracted PDF text content");
      expect(typeof result.data).toBe("string");
    });
  });
});
