// Define a content type that follows the SDK's expected format
export interface ToolContentItem {
  type: "text";
  text: string;
  [key: string]: unknown;
}

// Define the response type that matches CallToolResultSchema
export interface ToolResponse {
  content: ToolContentItem[];
  isError?: boolean;
  [key: string]: unknown;
}
