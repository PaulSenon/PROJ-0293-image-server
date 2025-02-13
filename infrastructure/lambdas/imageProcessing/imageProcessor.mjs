import { S3Client, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import sharp from 'sharp';
import { Readable } from 'stream';
import { pipeline } from "node:stream/promises";
import exifReader from 'exif-reader';
import iptcReader from 'iptc-reader';



export const handler = awslambda.streamifyResponse(async (event, responseStream) => {
  try {
    const s3Client = new S3Client({});
    const BUCKET_NAME = process.env.BUCKET_NAME;  
    
    console.log('queryStringParameters', event.queryStringParameters);
    console.log('headers', event.headers);
    console.log('bucketName', BUCKET_NAME);
    const { uri, w, h, q, type, meta } = event.queryStringParameters;
    const acceptHeader = event.headers['accept'] || '';
    const debugCacheKey = event.headers['x-cache-key'] || '';
    const ifNoneMatch = event.headers['if-none-match'];

    // Check if the source image exists and get its ETag
    const headResult = await s3Client.send(new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: uri,
    }));
    console.log('headResult', headResult);

    const sourceETag = headResult.ETag || '';

    // Determine output format
    let outputFormat = type || 'jpeg';
    if (!type) {
      if (acceptHeader.includes('image/avif')) outputFormat = 'avif';
      else if (acceptHeader.includes('image/webp')) outputFormat = 'webp';
    }

    const width = parseInt(w, 10) || undefined;
    const height = parseInt(h, 10) || undefined;
    const quality = parseInt(q, 10) || 85;
    const fit = 'cover';
    const allowUpscale = false;
    const sharpen = true;
    const successCacheControl = 'public, max-age=21600, stale-while-revalidate=86400';

    // If-None-Match handling
    if (ifNoneMatch === sourceETag) {
      const metadata = {
        statusCode: 304,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'X-Cache-Key': debugCacheKey,
          'Cache-Control': successCacheControl,
          'ETag': sourceETag,
        },
      }

      responseStream = awslambda.HttpResponseStream.from(responseStream, metadata)
      responseStream.end();
      return;
    }

    // Get the source image as a stream
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: uri,
      });
    const response = await s3Client.send(command);
    if (response.Body === undefined) throw new Error('No body in response');
    if (!(response.Body instanceof Readable)) throw new Error('Body is not a stream');

    if (meta === 'true') {
      const metadata = await sharp(await streamToBuffer(response.Body)).metadata();
      let exif = undefined;
      let iptc = undefined;
      if (metadata.exif) {
        try {
          exif = exifReader(metadata.exif);
        } catch (error) {
          console.error('Error reading EXIF data:', error);
        }
      }
      if (metadata.iptc) {
        try {
          iptc = iptcReader(metadata.iptc);
        } catch (error) {
          console.error('Error reading IPTC data:', error);
        }
      }

      responseStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'X-Cache-Key': debugCacheKey,
          'Cache-Control': successCacheControl,
          'ETag': sourceETag,
        },
      })

      responseStream.write(JSON.stringify({
        ratio: metadata.width / metadata.height,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        space: metadata.space,
        channels: metadata.channels,
        density: metadata.density,
        hasProfile: metadata.hasProfile,
        hasAlpha: metadata.hasAlpha,
        orientation: metadata.orientation,
        exif: exif,
        iptc: iptc,
      }));
      responseStream.end();
      return;
    }

    let transformer = sharp().timeout({ seconds: 5}).rotate();
    // resize and sharpen image
    transformer = transformer.resize(width, height, {
      fit,
      withoutEnlargement: !allowUpscale,
    });
    if (sharpen) {
      transformer = transformer.sharpen({
        sigma: 1.5,
        m1: 0.5,
        m2: 0.5,
      });
    }

    // transform image based on type
    switch (outputFormat) {
      case 'avif': {
        const avifQuality = quality - 20;
        transformer.avif({
          quality: Math.max(avifQuality, 1),
          effort: width > 900 ? 2 : 4,
        });
        break;
      }
      case 'webp': {
        transformer.webp({ quality });
        break;
      }
      case 'png': {
        transformer.png({ quality });
        break;
      }
      case 'jpeg': {
        transformer.jpeg({ quality, mozjpeg: true, progressive: true, optimiseScans: true });
        break;
      }
      case 'jxl': {
        transformer.jxl({ quality });
      }
      case 'matchSource':
      // do nothing
    }
    
    awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'X-Cache-Key': debugCacheKey,
        'Content-Type': `image/${outputFormat}`,
        'Cache-Control': successCacheControl,
        'ETag': sourceETag,
      },
    });

    await pipeline(response.Body, transformer, responseStream);
  } catch (error) {
    console.error('Error processing image:', error);
    const metadata = {
      statusCode: error.statusCode || 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
    responseStream = awslambda.HttpResponseStream.from(responseStream, metadata)
    responseStream.write(JSON.stringify({ message: 'Error processing image' }));
    responseStream.end();
  }
});

// Helper function to convert stream to buffer
async function streamToBuffer(stream) {
  const chunks= [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
} 