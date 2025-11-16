import NodeCache from 'node-cache';
import crypto from 'crypto';
import chalk from 'chalk';

export interface CacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in seconds
  checkPeriod: number; // Period in seconds for automatic delete check
}

export class CacheManager {
  private cache: NodeCache;
  private config: CacheConfig;
  private hits: number = 0;
  private misses: number = 0;

  constructor(config: CacheConfig) {
    this.config = config;
    this.cache = new NodeCache({
      stdTTL: config.ttl,
      checkperiod: config.checkPeriod,
      useClones: false,
    });

    this.cache.on('expired', (key, value) => {
      console.log(chalk.dim(`🗑️  Cache expired: ${key}`));
    });
  }

  get<T>(key: string): T | undefined {
    if (!this.config.enabled) {
      return undefined;
    }

    const value = this.cache.get<T>(key);
    if (value !== undefined) {
      this.hits++;
      console.log(chalk.cyan(`💾 Cache hit: ${key}`));
    } else {
      this.misses++;
      console.log(chalk.dim(`💨 Cache miss: ${key}`));
    }
    return value;
  }

  set<T>(key: string, value: T, ttl?: number): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const success = this.cache.set(key, value, ttl || this.config.ttl);
    if (success) {
      console.log(chalk.cyan(`💾 Cached: ${key}`));
    }
    return success;
  }

  has(key: string): boolean {
    return this.config.enabled && this.cache.has(key);
  }

  del(key: string | string[]): number {
    return this.cache.del(key);
  }

  flush(): void {
    this.cache.flushAll();
    console.log(chalk.yellow('🗑️  Cache flushed'));
  }

  static generateKey(...parts: string[]): string {
    const combined = parts.join('::');
    return crypto.createHash('md5').update(combined).digest('hex');
  }

  getStats() {
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0
        ? (this.hits / (this.hits + this.misses)) * 100
        : 0,
      keys: this.cache.keys().length,
      stats: this.cache.getStats(),
    };
  }
}
