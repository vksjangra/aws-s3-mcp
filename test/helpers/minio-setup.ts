import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

// Configure client for MinIO connection
export function getMinioClient() {
  return new S3Client({
    endpoint: process.env.AWS_ENDPOINT || "http://localhost:9000",
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "minioadmin",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "minioadmin",
    },
    forcePathStyle: true,
  });
}

// Setup test bucket
export async function setupTestBucket(bucketName: string) {
  const client = getMinioClient();

  try {
    // Create the bucket
    await client.send(new CreateBucketCommand({ Bucket: bucketName }));
    console.log(`Created test bucket: ${bucketName}`);
  } catch (error: any) {
    // Ignore if bucket already exists
    if (error.name !== "BucketAlreadyExists" && error.name !== "BucketAlreadyOwnedByYou") {
      console.error(`Failed to create bucket: ${bucketName}`, error);
      throw error;
    }
  }

  return client;
}

// Upload a test file with sample data
export async function uploadTestFile(bucketName: string, key: string, content: string) {
  const client = getMinioClient();

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: content,
      ContentType: key.endsWith(".json") ? "application/json" : "text/plain",
    }),
  );

  console.log(`Uploaded test file: ${key} to bucket: ${bucketName}`);
}

// Upload a test PDF file
export async function uploadTestPdf(bucketName: string, key: string) {
  const client = getMinioClient();

  // Simple PDF file content
  const pdfContent = `%PDF-1.1
1 0 obj
<< /Type /Catalog
   /Pages 2 0 R
>>
endobj
2 0 obj
<< /Type /Pages
   /Kids [3 0 R]
   /Count 1
>>
endobj
3 0 obj
<< /Type /Page
   /Parent 2 0 R
   /Resources << /Font << /F1 4 0 R >> >>
   /MediaBox [0 0 612 792]
   /Contents 5 0 R
>>
endobj
4 0 obj
<< /Type /Font
   /Subtype /Type1
   /Name /F1
   /BaseFont /Helvetica
>>
endobj
5 0 obj
<< /Length 49 >>
stream
BT
/F1 24 Tf
100 700 Td
(Test PDF Document) Tj
ET
endstream
endobj
trailer
<< /Root 1 0 R
   /Size 6
>>
%%EOF`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: pdfContent,
      ContentType: "application/pdf",
    }),
  );

  console.log(`Uploaded test PDF: ${key} to bucket: ${bucketName}`);
}

// Upload multiple test files
export async function setupTestFiles(bucketName: string) {
  await uploadTestFile(bucketName, "test-file.txt", "This is a test file content");
  await uploadTestFile(bucketName, "test-file.json", JSON.stringify({ test: "data", value: 123 }));
  await uploadTestPdf(bucketName, "test-file.pdf");
}

// Clean up bucket after tests
export async function cleanupTestBucket(bucketName: string) {
  // Safety check to prevent accidental deletion of production buckets
  if (!bucketName.startsWith("test-") && !bucketName.includes("test")) {
    throw new Error(
      `Refusing to delete bucket "${bucketName}" as it doesn't appear to be a test bucket`,
    );
  }

  const client = getMinioClient();

  try {
    // List all objects in the bucket
    const listObjectsResponse = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
      }),
    );

    // Delete each object in the bucket
    if (listObjectsResponse.Contents && listObjectsResponse.Contents.length > 0) {
      console.log(
        `Deleting ${listObjectsResponse.Contents.length} objects from bucket: ${bucketName}`,
      );

      for (const object of listObjectsResponse.Contents) {
        if (object.Key) {
          await client.send(
            new DeleteObjectCommand({
              Bucket: bucketName,
              Key: object.Key,
            }),
          );
          console.log(`Deleted object: ${object.Key}`);
        }
      }
    }

    // Optionally delete the bucket itself (uncomment if needed)
    // await client.send(new DeleteBucketCommand({
    //   Bucket: bucketName,
    // }));
    // console.log(`Deleted test bucket: ${bucketName}`);

    console.log(`Cleaned up all objects in test bucket: ${bucketName}`);
  } catch (error: any) {
    console.error(`Error cleaning up bucket: ${bucketName}`, error);
  }
}
