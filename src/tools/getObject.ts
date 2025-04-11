import { z } from "zod";
import { S3Resource } from "../resources/s3.js";
import { createErrorResponse } from "../helpers/createErrorResponse.js";
import type { IMCPTool, InferZodParams } from "../types.js";

/**
 * Retrieve an object from an S3 bucket
 */
export class GetObjectTool implements IMCPTool {
  /**
   * Tool name
   */
  readonly name = "get-object";

  /**
   * Tool description
   */
  readonly description = "Retrieve an object from an S3 bucket";

  /**
   * Parameter definition
   */
  readonly parameters = {
    bucket: z.string().describe("Name of the S3 bucket"),
    key: z.string().describe("Key (path) of the object to retrieve"),
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
    const { bucket, key } = args;

    try {
      const result = await this.s3Resource.getObject(bucket, key);

      // For text content, return as text
      if (typeof result.data === "string") {
        return {
          content: [
            {
              type: "text" as const,
              text: result.data,
            },
          ],
        };
      }

      // For binary content, return as base64-encoded string
      return {
        content: [
          {
            type: "text" as const,
            text: `Binary content (${result.contentType}): base64 data is ${result.data.toString("base64").substring(0, 100)}...`,
          },
        ],
      };
    } catch (error) {
      return createErrorResponse(
        error,
        `Error getting object ${key} from bucket ${bucket}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
