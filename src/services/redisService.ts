/**
 * Redis service for persistent storage.
 * Falls back gracefully when Redis is not available.
 */
import Redis from 'ioredis'

class RedisService {
    private client: Redis | null = null
    private _connected = false

    async connect(): Promise<void> {
        const url = process.env.REDIS_URL
        if (!url) {
            console.log('[REDIS] No REDIS_URL configured — using JSON file fallback')
            return
        }

        try {
            this.client = new Redis(url, {
                maxRetriesPerRequest: 3,
                retryStrategy(times) {
                    if (times > 5) return null // stop retrying
                    return Math.min(times * 500, 3000)
                },
                lazyConnect: true,
            })

            this.client.on('error', (err) => {
                console.error('[REDIS] Connection error:', err.message)
                this._connected = false
            })

            this.client.on('connect', () => {
                console.log('[REDIS] Connected')
                this._connected = true
            })

            this.client.on('close', () => {
                this._connected = false
            })

            await this.client.connect()
        } catch (err: any) {
            console.error('[REDIS] Failed to connect:', err.message)
            this.client = null
            this._connected = false
        }
    }

    get isConnected(): boolean {
        return this._connected && this.client !== null
    }

    // ============= Generic key-value ops =============

    async get(key: string): Promise<string | null> {
        if (!this.isConnected) return null
        try {
            return await this.client!.get(key)
        } catch {
            return null
        }
    }

    async set(key: string, value: string): Promise<boolean> {
        if (!this.isConnected) return false
        try {
            await this.client!.set(key, value)
            return true
        } catch {
            return false
        }
    }

    async del(key: string): Promise<boolean> {
        if (!this.isConnected) return false
        try {
            await this.client!.del(key)
            return true
        } catch {
            return false
        }
    }

    // ============= Set ops (for blacklist) =============

    async sAdd(key: string, member: string): Promise<boolean> {
        if (!this.isConnected) return false
        try {
            await this.client!.sadd(key, member)
            return true
        } catch {
            return false
        }
    }

    async sRem(key: string, member: string): Promise<boolean> {
        if (!this.isConnected) return false
        try {
            await this.client!.srem(key, member)
            return true
        } catch {
            return false
        }
    }

    async sIsMember(key: string, member: string): Promise<boolean> {
        if (!this.isConnected) return false
        try {
            return (await this.client!.sismember(key, member)) === 1
        } catch {
            return false
        }
    }

    async sMembers(key: string): Promise<string[]> {
        if (!this.isConnected) return []
        try {
            return await this.client!.smembers(key)
        } catch {
            return []
        }
    }
}

export const redisService = new RedisService()
