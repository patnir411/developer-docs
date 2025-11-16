import pLimit from 'p-limit';

export interface RateLimiterConfig {
  requestsPerSecond: number;
  maxConcurrent: number;
}

export class RateLimiter {
  private limit: ReturnType<typeof pLimit>;
  private requestTimes: number[] = [];
  private requestsPerSecond: number;

  constructor(config: RateLimiterConfig) {
    this.limit = pLimit(config.maxConcurrent);
    this.requestsPerSecond = config.requestsPerSecond;
  }

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    await this.waitIfNeeded();
    return this.limit(async () => {
      this.recordRequest();
      return fn();
    });
  }

  private async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    const oneSecondAgo = now - 1000;

    // Remove requests older than 1 second
    this.requestTimes = this.requestTimes.filter(time => time > oneSecondAgo);

    // If we've hit the rate limit, wait
    if (this.requestTimes.length >= this.requestsPerSecond) {
      const oldestRequest = this.requestTimes[0];
      const waitTime = 1000 - (now - oldestRequest);
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  private recordRequest(): void {
    this.requestTimes.push(Date.now());
  }

  getStats() {
    return {
      requestsInLastSecond: this.requestTimes.filter(
        time => time > Date.now() - 1000
      ).length,
      totalRequests: this.requestTimes.length,
    };
  }
}
