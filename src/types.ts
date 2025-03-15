// Define a type for the getObject return value
export interface S3ObjectData {
  data: Buffer | string;
  contentType: string;
}
