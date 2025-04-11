/**
 * Creates a standardized error response for MCP tools
 * @param error The error object
 * @param message Optional user-friendly error message
 * @param options Additional options
 * @returns Formatted error response
 */
export function createErrorResponse(
  error: unknown,
  message?: string,
  options?: { suppressLogging?: boolean },
): {
  content: { type: "text"; text: string }[];
  isError: boolean;
} {
  const errorMessage = message || (error instanceof Error ? error.message : String(error));

  // Only log errors if not suppressed (useful for testing to avoid noise)
  if (!options?.suppressLogging) {
    console.error("Error in tool execution:", error);
  }

  return {
    content: [
      {
        type: "text",
        text: `Error: ${errorMessage}`,
      },
    ],
    isError: true,
  };
}
