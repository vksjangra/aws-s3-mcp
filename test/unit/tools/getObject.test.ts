import { describe, it, expect, beforeEach, vi } from "vitest";
import { S3Resource } from "../../../src/resources/s3";
import { GetObjectTool } from "../../../src/tools/getObject";
import { S3ObjectData } from "../../../src/types";

// Mock the S3Resource
vi.mock("../../../src/resources/s3", () => {
  return {
    S3Resource: vi.fn().mockImplementation(() => ({
      getObject: vi.fn(),
    })),
  };
});

describe("GetObjectTool", () => {
  let s3Resource: S3Resource;
  let getObjectTool: GetObjectTool;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create a fresh instance for each test
    s3Resource = new S3Resource();
    getObjectTool = new GetObjectTool(s3Resource);
  });

  it("should have the correct name and description", () => {
    expect(getObjectTool.name).toBe("get-object");
    expect(getObjectTool.description).toBe("Retrieve an object from an S3 bucket");
    expect(getObjectTool.parameters).toHaveProperty("bucket");
    expect(getObjectTool.parameters).toHaveProperty("key");
  });

  it("should return text content when object is text", async () => {
    // Mock text content response
    const textContent = "This is a text file content";
    const mockResult: S3ObjectData = {
      data: textContent,
      contentType: "text/plain",
    };

    // Setup the mock to return our fake data
    vi.mocked(s3Resource.getObject).mockResolvedValueOnce(mockResult);

    // Execute the method being tested
    const result = await getObjectTool.execute({
      bucket: "test-bucket",
      key: "test-file.txt",
    });

    // Assertions
    expect(s3Resource.getObject).toHaveBeenCalledTimes(1);
    expect(s3Resource.getObject).toHaveBeenCalledWith("test-bucket", "test-file.txt");
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toBe(textContent);
    // Success responses don't have isError property or it's undefined
    expect("isError" in result ? result.isError : undefined).toBeUndefined();
  });

  it("should return base64 string for binary content", async () => {
    // Mock binary content response
    const binaryData = Buffer.from("Binary content");
    const mockResult: S3ObjectData = {
      data: binaryData,
      contentType: "application/octet-stream",
    };

    // Setup the mock to return our fake data
    vi.mocked(s3Resource.getObject).mockResolvedValueOnce(mockResult);

    // Execute the method being tested
    const result = await getObjectTool.execute({
      bucket: "test-bucket",
      key: "test-file.bin",
    });

    // Assertions
    expect(s3Resource.getObject).toHaveBeenCalledTimes(1);
    expect(s3Resource.getObject).toHaveBeenCalledWith("test-bucket", "test-file.bin");
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("Binary content");
    expect(result.content[0].text).toContain("base64 data is");
    // Success responses don't have isError property or it's undefined
    expect("isError" in result ? result.isError : undefined).toBeUndefined();
  });

  it("should handle errors correctly", async () => {
    // Setup the mock to throw an error
    const errorMessage = "Object not found";
    vi.mocked(s3Resource.getObject).mockRejectedValueOnce(new Error(errorMessage));

    // Spy on createErrorResponse to check it's called with correct params
    const createErrorResponseSpy = vi.spyOn(
      await import("../../../src/helpers/createErrorResponse.js"),
      "createErrorResponse",
    );

    // Execute the method being tested
    const result = await getObjectTool.execute({
      bucket: "test-bucket",
      key: "non-existent.txt",
    });

    // Assertions
    expect(s3Resource.getObject).toHaveBeenCalledTimes(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("Error");
    expect(result.content[0].text).toContain(errorMessage);
    // Error responses always have isError: true
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
