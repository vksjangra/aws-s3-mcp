import type { z } from "zod";

/**
 * Helper type to infer the parameter types from Zod schemas
 */
export type InferZodParams<T extends Record<string, z.ZodType>> = {
  [K in keyof T]: z.infer<T[K]>;
};

/**
 * Interface for MCP tools
 */
export interface IMCPTool<TParams extends Record<string, z.ZodType> = Record<string, z.ZodType>> {
  /**
   * Tool name
   */
  readonly name: string;

  /**
   * Tool description
   */
  readonly description: string;

  /**
   * Parameter definitions
   */
  readonly parameters: TParams;

  /**
   * Execute the tool
   * @param args Parameters
   */
  execute(args: InferZodParams<TParams>): Promise<{
    content: {
      type: "text";
      text: string;
      [key: string]: unknown;
    }[];
    isError?: boolean;
    [key: string]: unknown;
  }>;
}

/**
 * Data returned from S3 operations
 */
export interface S3ObjectData {
  data: Buffer | string;
  contentType: string;
}
