import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S3Resource } from '../../../src/resources/s3';
import { ListObjectsTool } from '../../../src/tools/listObjects';
import { createMockObjects } from '../../mocks/s3Client.mock';

// Mock the S3Resource
vi.mock('../../../src/resources/s3', () => {
  return {
    S3Resource: vi.fn().mockImplementation(() => ({
      listObjects: vi.fn()
    }))
  };
});

describe('ListObjectsTool', () => {
  let s3Resource: S3Resource;
  let listObjectsTool: ListObjectsTool;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create a fresh instance for each test
    s3Resource = new S3Resource();
    listObjectsTool = new ListObjectsTool(s3Resource);
  });

  it('should have the correct name and description', () => {
    expect(listObjectsTool.name).toBe('list-objects');
    expect(listObjectsTool.description).toBe('List objects in an S3 bucket');
    expect(listObjectsTool.parameters).toHaveProperty('bucket');
    expect(listObjectsTool.parameters).toHaveProperty('prefix');
    expect(listObjectsTool.parameters).toHaveProperty('maxKeys');
  });

  it('should return objects when successful', async () => {
    // Create mock object data (simplified for testing)
    const mockObjects = [{ Key: 'file1.txt' }, { Key: 'file2.txt' }];

    // Setup the mock to return our fake data
    vi.mocked(s3Resource.listObjects).mockResolvedValueOnce(mockObjects as any);

    // Execute the method being tested with type assertion to make TypeScript happy
    const result = await listObjectsTool.execute({
      bucket: 'test-bucket',
      prefix: 'test-prefix/',
      maxKeys: 10
    });

    // Assertions
    expect(s3Resource.listObjects).toHaveBeenCalledTimes(1);
    expect(s3Resource.listObjects).toHaveBeenCalledWith('test-bucket', 'test-prefix/', 10);
    expect(result.content[0].type).toBe('text');
    expect(JSON.parse(result.content[0].text)).toEqual(mockObjects);
    // Success responses don't have isError property or it's undefined
    expect('isError' in result ? result.isError : undefined).toBeUndefined();
  });

  it('should handle missing optional parameters', async () => {
    // Create mock object data (simplified for testing)
    const mockObjects = [{ Key: 'file1.txt' }, { Key: 'file2.txt' }];

    // Setup the mock to return our fake data
    vi.mocked(s3Resource.listObjects).mockResolvedValueOnce(mockObjects as any);

    // Execute the method with only required parameters
    const result = await listObjectsTool.execute({
      bucket: 'test-bucket',
      // Adding empty values to satisfy TypeScript
      prefix: undefined,
      maxKeys: undefined
    });

    // Assertions
    expect(s3Resource.listObjects).toHaveBeenCalledTimes(1);
    expect(s3Resource.listObjects).toHaveBeenCalledWith('test-bucket', '', 1000);
    expect(result.content[0].type).toBe('text');
    expect(JSON.parse(result.content[0].text)).toEqual(mockObjects);
  });

  it('should handle errors correctly', async () => {
    // Setup the mock to throw an error
    const errorMessage = 'Access denied';
    vi.mocked(s3Resource.listObjects).mockRejectedValueOnce(new Error(errorMessage));

    // Spy on createErrorResponse to check it's called with correct params
    const createErrorResponseSpy = vi.spyOn(await import('../../../src/helpers/createErrorResponse.js'), 'createErrorResponse');

    // Execute the method being tested
    const result = await listObjectsTool.execute({
      bucket: 'test-bucket',
      prefix: undefined,
      maxKeys: undefined
    });

    // Assertions
    expect(s3Resource.listObjects).toHaveBeenCalledTimes(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Error');
    expect(result.content[0].text).toContain(errorMessage);
    // Error responses always have isError: true
    expect('isError' in result && result.isError).toBe(true);
    // Verify createErrorResponse was called
    expect(createErrorResponseSpy).toHaveBeenCalled();
    // Get the actual call arguments
    const callArgs = createErrorResponseSpy.mock.calls[0];
    // Check first two arguments are correct types
    expect(callArgs[0]).toBeInstanceOf(Error);
    expect(typeof callArgs[1]).toBe('string');
  });
});
