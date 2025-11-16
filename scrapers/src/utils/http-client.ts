import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import pRetry from 'p-retry';
import chalk from 'chalk';

export interface HttpClientConfig {
  userAgent: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  exponentialBackoff: boolean;
  followRedirects: boolean;
  maxRedirects: number;
}

export class HttpClient {
  private client: AxiosInstance;
  private config: HttpClientConfig;

  constructor(config: HttpClientConfig) {
    this.config = config;
    this.client = axios.create({
      timeout: config.timeout,
      maxRedirects: config.maxRedirects,
      headers: {
        'User-Agent': config.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
      },
    });
  }

  async get(url: string, options: AxiosRequestConfig = {}): Promise<AxiosResponse> {
    console.log(chalk.blue(`📡 Fetching: ${url}`));

    try {
      const response = await pRetry(
        async () => {
          const res = await this.client.get(url, options);

          // Validate response
          if (!res.data || res.data.length === 0) {
            throw new Error('Empty response received');
          }

          return res;
        },
        {
          retries: this.config.retryAttempts,
          factor: this.config.exponentialBackoff ? 2 : 1,
          minTimeout: this.config.retryDelay,
          onFailedAttempt: (error) => {
            console.log(
              chalk.yellow(
                `⚠️  Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`
              )
            );
            console.log(chalk.yellow(`   Error: ${error.message}`));
          },
        }
      );

      console.log(chalk.green(`✓ Successfully fetched: ${url}`));
      return response;
    } catch (error) {
      console.error(chalk.red(`✗ Failed to fetch ${url}:`));
      if (axios.isAxiosError(error)) {
        console.error(chalk.red(`  Status: ${error.response?.status}`));
        console.error(chalk.red(`  Message: ${error.message}`));
      } else {
        console.error(chalk.red(`  ${error}`));
      }
      throw error;
    }
  }

  async post(url: string, data: any, options: AxiosRequestConfig = {}): Promise<AxiosResponse> {
    console.log(chalk.blue(`📤 Posting to: ${url}`));

    try {
      const response = await pRetry(
        () => this.client.post(url, data, options),
        {
          retries: this.config.retryAttempts,
          factor: this.config.exponentialBackoff ? 2 : 1,
          minTimeout: this.config.retryDelay,
        }
      );

      console.log(chalk.green(`✓ Successfully posted to: ${url}`));
      return response;
    } catch (error) {
      console.error(chalk.red(`✗ Failed to post to ${url}`));
      throw error;
    }
  }

  getStats() {
    return {
      timeout: this.config.timeout,
      retryAttempts: this.config.retryAttempts,
      userAgent: this.config.userAgent,
    };
  }
}
