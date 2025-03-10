import { S3Client, S3ClientConfig } from "@aws-sdk/client-s3";

export function getS3Client() {
  const ACCESS_KEY = process.env.DEV_ONLY_S3_ACCESS_KEY;
  const SECRET_KEY = process.env.DEV_ONLY_S3_SECRET_KEY;
  const ENDPOINT = process.env.DEV_ONLY_S3_ENDPOINT;
  const REGION = process.env.AWS_REGION;

  if (!REGION) throw Error("missing env AWS_REGION");

  const s3Config: S3ClientConfig = {
    region: REGION,
  };

  if (ACCESS_KEY && SECRET_KEY) {
    s3Config.credentials = {
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_KEY,
    };
  }

  if (ENDPOINT) {
    s3Config.endpoint = ENDPOINT;
    s3Config.forcePathStyle = true;
  }

  return new S3Client(s3Config);
}
