/**
 * S3StorageAdapter — AWS S3 / S3-compatible implementation of StoragePort.
 *
 * Uses the standard AWS S3 REST API over fetch. Compatible with:
 *   - AWS S3
 *   - MinIO
 *   - DigitalOcean Spaces
 *   - Backblaze B2
 *   - Any S3-compatible object store
 *
 * Requires AWS Signature V4 signing. Pass a pre-configured S3Client
 * interface to keep this adapter lean and signing-library agnostic.
 */
import type { StoragePort } from '../types'

/** Minimal S3 client interface — keeps adapter agnostic to signing implementation. */
export interface S3Client {
  getObject(key: string): Promise<{ body: ReadableStream; contentType: string } | null>
  putObject(key: string, body: ReadableStream | ArrayBuffer | string, contentType?: string): Promise<void>
  deleteObject(key: string): Promise<void>
  listObjects(prefix?: string): Promise<string[]>
}

export class S3StorageAdapter implements StoragePort {
  constructor(private readonly client: S3Client) {}

  async get(key: string): Promise<{ body: ReadableStream; contentType: string } | null> {
    return this.client.getObject(key)
  }

  async put(key: string, data: ReadableStream | ArrayBuffer | string, contentType?: string): Promise<void> {
    await this.client.putObject(key, data, contentType)
  }

  async delete(key: string): Promise<void> {
    await this.client.deleteObject(key)
  }

  async list(prefix?: string): Promise<string[]> {
    return this.client.listObjects(prefix)
  }
}
