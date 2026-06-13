import { type EnvConfig } from '../../config/env.js';
import { EasyEdaMcpError } from '../../schemas/common.js';
import { getLogger } from '../../utils/logger.js';
import type pino from 'pino';
import { httpRequestWithRetry, DEFAULT_REQUEST_TIMEOUT_MS } from '../base-http-client.js';

export interface LcscPart {
  lcsc: string;
  manufacturer: string;
  description: string;
  datasheet: string;
  stock: number;
  price: string;
  category: string;
  package: string;
  inStock: boolean;
  stockCount?: number;
  leadTime?: number;
  discontinued?: boolean;
  priceBreaks?: Array<{ quantity?: number; unitPrice?: number }>;
}

export interface LcscSearchResponse {
  parts: LcscPart[];
  total: number;
}

export class LcscClient {
  private config: EnvConfig;
  private logger: pino.Logger;
  private jlcsearchBase: string;
  private lcscApiKey: string;

  constructor(config: EnvConfig) {
    this.config = config;
    this.logger = getLogger();
    this.jlcsearchBase = config.JLCSEARCH_BASE_URL.replace(/\/+$/, '');
    this.lcscApiKey = config.LCSC_API_KEY;
  }

  private async jlcsearchRequest<T>(
    path: string,
    options: { method?: string; query?: Record<string, string> },
  ): Promise<T> {
    const method = options.method ?? 'GET';
    const queryString = options.query ? '?' + new URLSearchParams(options.query).toString() : '';
    const url = `${this.jlcsearchBase}${path}${queryString}`;

    const { statusCode, responseText } = await httpRequestWithRetry(
      url,
      { method, headers: { accept: 'application/json' }, timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS },
      this.logger,
    );

    if (statusCode < 200 || statusCode >= 300) {
      throw new EasyEdaMcpError({
        code: 'VENDOR_API_UNAVAILABLE',
        message: `LCSC jlcsearch API returned status ${statusCode}`,
        suggestion: 'Check JLCSEARCH_BASE_URL and network connectivity.',
        retryable: statusCode >= 500,
        details: { statusCode, response: responseText.slice(0, 500) },
      });
    }

    return JSON.parse(responseText) as T;
  }

  private async lcscOfficialRequest<T>(
    path: string,
    options: { method?: string; body?: unknown },
  ): Promise<T> {
    const method = options.method ?? 'GET';
    const url = `https://www.lcsc.com/api${path}`;

    const headers: Record<string, string> = {
      accept: 'application/json',
    };

    if (this.lcscApiKey) {
      headers['x-api-key'] = this.lcscApiKey;
    }

    if (options.body) {
      headers['content-type'] = 'application/json';
    }

    const { statusCode, responseText } = await httpRequestWithRetry(
      url,
      {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
      },
      this.logger,
    );

    if (statusCode < 200 || statusCode >= 300) {
      throw new EasyEdaMcpError({
        code: 'VENDOR_API_UNAVAILABLE',
        message: `LCSC official API returned status ${statusCode}`,
        suggestion: 'Check LCSC_API_KEY and network connectivity.',
        retryable: statusCode >= 500,
        details: { statusCode, response: responseText.slice(0, 500) },
      });
    }

    return JSON.parse(responseText) as T;
  }

  /**
   * Search LCSC parts by keyword query.
   * Uses the jlcsearch API as primary backend, falls back to LCSC official API if available.
   * @param query - The search keyword
   * @param options - Optional search configuration (limit, page)
   * @returns Search results with parts list and total count
   */
  async searchParts(
    query: string,
    options?: { limit?: number; page?: number },
  ): Promise<LcscSearchResponse> {
    const limit = options?.limit ?? 20;
    const page = options?.page ?? 1;

    try {
      const data = await this.jlcsearchRequest<{
        results?: LcscPart[];
        count?: number;
        parts?: LcscPart[];
        total?: number;
      }>('/api/search', {
        query: { keyword: query, limit: String(limit), page: String(page) },
      });

      const parts = data.results ?? data.parts ?? [];
      const total = data.count ?? data.total ?? parts.length;

      return { parts, total };
    } catch (err) {
      if (this.lcscApiKey) {
        this.logger.debug('jlcsearch failed, falling back to lcsc official api');
        return this.lcscOfficialRequest<LcscSearchResponse>('/search', {
          method: 'POST',
          body: { keyword: query, limit, page },
        });
      }
      throw err;
    }
  }

  /**
   * Get detailed information for a specific LCSC part by its LCSC code.
   * @param lcscCode - The LCSC part number (e.g., "C12345")
   * @returns The part detail or null if not found
   */
  async getPartDetail(lcscCode: string): Promise<LcscPart | null> {
    try {
      const data = await this.jlcsearchRequest<{ part?: LcscPart } | LcscPart>(
        `/api/part/${encodeURIComponent(lcscCode)}`,
        {},
      );
      const part = 'part' in data ? data.part : (data as LcscPart);
      return part ?? null;
    } catch (err) {
      if (this.lcscApiKey) {
        this.logger.debug('jlcsearch failed, falling back to lcsc official api');
        return this.lcscOfficialRequest<LcscPart | null>(
          `/part/${encodeURIComponent(lcscCode)}`,
          {},
        );
      }
      throw err;
    }
  }

  /**
   * Get parts by category from LCSC.
   * @param category - The category name or ID
   * @returns Array of parts in the category
   */
  async getPartsByCategory(category: string): Promise<LcscPart[]> {
    try {
      const data = await this.jlcsearchRequest<{ parts?: LcscPart[]; results?: LcscPart[] }>(
        `/api/categories/${encodeURIComponent(category)}/parts`,
        {},
      );
      return data.parts ?? data.results ?? [];
    } catch (err) {
      if (this.lcscApiKey) {
        this.logger.debug('jlcsearch failed, falling back to lcsc official api');
        return this.lcscOfficialRequest<LcscPart[]>(
          `/categories/${encodeURIComponent(category)}/parts`,
          {},
        );
      }
      throw err;
    }
  }
}
