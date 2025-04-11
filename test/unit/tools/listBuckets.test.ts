import { describe, it, expect, beforeEach, vi } from "vitest";
import { S3Resource } from "../../../src/resources/s3";
import { ListBucketsTool } from "../../../src/tools/listBuckets";
import { createMockBuckets } from "../../mocks/s3Client.mock";

// Mock the S3Resource
vi.mock("../../../src/resources/s3", () => {
  return {
    S3Resource: vi.fn().mockImplementation(() => ({
      listBuckets: vi.fn(),
    })),
  };
});

describe("ListBucketsTool", () => {
  let s3Resource: S3Resource;
  let listBucketsTool: ListBucketsTool;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create a fresh instance for each test
    s3Resource = new S3Resource();
    listBucketsTool = new ListBucketsTool(s3Resource);
  });

  it("should have the correct name and description", () => {
    expect(listBucketsTool.name).toBe("list-buckets");
    expect(listBucketsTool.description).toBe("List available S3 buckets");
    expect(listBucketsTool.parameters).toEqual({});
  });

  it("should return buckets when successful", async () => {
    // Create mock bucket data
    const mockBuckets = createMockBuckets(3);

    // Setup the mock to return our fake data
    vi.mocked(s3Resource.listBuckets).mockResolvedValueOnce(mockBuckets);

    // Execute the method being tested
    const result = await listBucketsTool.execute({});

    // Assertions
    expect(s3Resource.listBuckets).toHaveBeenCalledTimes(1);
    expect(result.content[0].type).toBe("text");

    // When comparing JSON parsed data, dates are converted to strings
    const parsedResult = JSON.parse(result.content[0].text);
    expect(parsedResult.length).toBe(mockBuckets.length);
    for (let i = 0; i < mockBuckets.length; i++) {
      expect(parsedResult[i].Name).toBe(mockBuckets[i].Name);
      // Only check that the date exists, not exact format
      expect(parsedResult[i].CreationDate).toBeDefined();
    }
    // Success responses don't have isError property or it's undefined
    expect("isError" in result ? result.isError : undefined).toBeUndefined();
  });

  it("should handle errors correctly", async () => {
    // Setup the mock to throw an error
    const errorMessage = "Network error";
    vi.mocked(s3Resource.listBuckets).mockRejectedValueOnce(new Error(errorMessage));

    // Spy on createErrorResponse to check it's called with correct params
    const createErrorResponseSpy = vi.spyOn(
      await import("../../../src/helpers/createErrorResponse.js"),
      "createErrorResponse",
    );

    // Execute the method being tested
    const result = await listBucketsTool.execute({});

    // Assertions
    expect(s3Resource.listBuckets).toHaveBeenCalledTimes(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("Error");
    expect(result.content[0].text).toContain(errorMessage);
    expect("isError" in result && result.isError).toBe(true);
    // Verify createErrorResponse was called
    expect(createErrorResponseSpy).toHaveBeenCalled();
    // Get the actual call arguments
    const callArgs = createErrorResponseSpy.mock.calls[0];
    // Check first two arguments are correct types
    expect(callArgs[0]).toBeInstanceOf(Error);
    expect(typeof callArgs[1]).toBe("string");
  });
});
