import { z } from "zod";
import { createErrorResponse } from "../helpers/createErrorResponse.js";
import type { S3Resource } from "../resources/s3.js";
import type { IMCPTool, InferZodParams } from "../types.js";

/**
 * List objects in an S3 bucket
 */
export class ListObjectsTool implements IMCPTool {
  /**
   * Tool name
   */
  readonly name = "list-s3-objects";

  /**
   * Tool description
   */
  readonly description = "List objects in an S3 bucket";

  /**
   * Parameter definition
   */
  readonly parameters = {
    bucket: z.string().describe("Name of the S3 bucket"),
    prefix: z
      .union([z.string(), z.null()])
      .optional()
      .describe("Prefix to filter objects (like a folder)"),
    maxKeys: z
      .union([z.number(), z.null()])
      .optional()
      .describe("Maximum number of objects to return"),
  } as const;

  /**
   * S3Resource instance
   */
  private s3Resource: S3Resource;

  /**
   * Constructor
   */
  constructor(s3Resource: S3Resource) {
    this.s3Resource = s3Resource;
  }

  /**
   * Execute function
   */
  async execute(args: InferZodParams<typeof this.parameters>) {
    const { bucket, prefix, maxKeys } = args;

    try {
      // Handle both undefined and null values for optional parameters
      const validPrefix = prefix === null || prefix === undefined ? "" : prefix;
      const validMaxKeys = maxKeys === null || maxKeys === undefined ? 1000 : maxKeys;

      const objects = await this.s3Resource.listObjects(bucket, validPrefix, validMaxKeys);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(objects, null, 2),
          },
        ],
      };
    } catch (error) {
      return createErrorResponse(
        error,
        `Error listing objects in bucket ${bucket}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
