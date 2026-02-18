/**
 * Configuration service for managing bot settings (flows, blacklist, prompts).
 *
 * Storage priority:
 *   1. Redis (persistent across deploys)  — when REDIS_URL is set
 *   2. JSON file (ephemeral on Railway)   — always used as fallback
 *
 * On startup, if Redis is empty the JSON file seeds it automatically.
 */
import * as fs from 'fs'
import * as path from 'path'
import { FLOW_PROMPTS, type FlowPrompt, type MenuConfig } from '../config/flowPrompts.js'
import { redisService } from './redisService.js'

// Redis keys
const R = {
    BLACKLIST: 'bot:blacklist',
    CURRENT_FLOW: 'bot:currentFlow',
    SYSTEM_PROMPT: 'bot:systemPrompt',
    CUSTOM_FLOWS: 'bot:customFlows',
    RECENT_MESSAGES: 'bot:messages:recent',
    USER_CONFIGS: 'bot:user:configs',
}

const MAX_RECENT_MESSAGES = 200

export interface RecentMessage {
    id: string
    from: string
    name: string
    text: string
    timestamp: string
}

export interface UserConfig {
    name: string
    custom_prompt: string
    notes: string
    created_at: string
}

interface BotConfig {
    blacklist: string[]
    currentFlow: string
    systemPrompt: string
    customFlows: Record<string, any>
}

class ConfigService {
    private configPath: string

    constructor() {
        this.configPath = process.env.CONFIG_FILE_PATH || './config/bot-config.json'
        this.ensureConfigFile()
    }

    // ============= Init =============

    /** Seed Redis from JSON file if Redis is empty (first deploy) */
    async seedRedis(): Promise<void> {
        if (!redisService.isConnected) return

        const existing = await redisService.get(R.CURRENT_FLOW)
        if (existing) {
            console.log('[CONFIG] Redis already seeded — skipping')
            return
        }

        console.log('[CONFIG] Seeding Redis from JSON file...')
        const config = this.getFileConfig()

        // Blacklist
        for (const num of config.blacklist) {
            await redisService.sAdd(R.BLACKLIST, this.normalizeNumber(num))
        }

        // Prompt & flow
        await redisService.set(R.CURRENT_FLOW, config.currentFlow || 'karuna')
        await redisService.set(R.SYSTEM_PROMPT, config.systemPrompt || FLOW_PROMPTS.karuna.prompt)

        // Custom flows
        if (Object.keys(config.customFlows).length > 0) {
            await redisService.set(R.CUSTOM_FLOWS, JSON.stringify(config.customFlows))
        }

        console.log('[CONFIG] Redis seeded successfully')
    }

    // ============= Helpers =============

    /** Strip everything except digits from a phone number */
    private normalizeNumber(number: string): string {
        return number.replace(/\D/g, '')
    }

    // ---- JSON file helpers (fallback) ----

    private ensureConfigFile(): void {
        try {
            const dir = path.dirname(this.configPath)
            if (dir && !fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true })
            }
            if (!fs.existsSync(this.configPath)) {
                const defaultConfig: BotConfig = {
                    blacklist: [],
                    currentFlow: 'karuna',
                    systemPrompt: FLOW_PROMPTS.karuna.prompt,
                    customFlows: {},
                }
                this.saveFileConfig(defaultConfig)
                console.log('Config file created')
            }
        } catch (e) {
            console.warn('Could not create config file:', e)
        }
    }

    private getFileConfig(): BotConfig {
        try {
            const data = fs.readFileSync(this.configPath, 'utf-8')
            return JSON.parse(data)
        } catch {
            return {
                blacklist: [],
                systemPrompt: '',
                currentFlow: 'karuna',
                customFlows: {},
            }
        }
    }

    private saveFileConfig(config: BotConfig): boolean {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8')
            return true
        } catch (e) {
            console.error('Error saving config:', e)
            return false
        }
    }

    // ============= Blacklist =============

    async getBlacklist(): Promise<string[]> {
        if (redisService.isConnected) {
            return redisService.sMembers(R.BLACKLIST)
        }
        // Fallback: file + env
        const fromFile = (this.getFileConfig().blacklist || []).map((n) => this.normalizeNumber(n))
        const envVal = process.env.BLACKLIST_NUMBERS || ''
        const fromEnv = envVal.trim() ? envVal.split(',').map((n) => this.normalizeNumber(n)).filter(Boolean) : []
        return [...new Set([...fromEnv, ...fromFile])]
    }

    async addToBlacklist(number: string): Promise<boolean> {
        const normalized = this.normalizeNumber(number)
        if (!normalized) return false

        if (redisService.isConnected) {
            const added = await redisService.sAdd(R.BLACKLIST, normalized)
            if (added) console.log(`Number ${normalized} added to blacklist (Redis)`)
            return added
        }

        // Fallback: file
        const config = this.getFileConfig()
        const existing = config.blacklist.map((n) => this.normalizeNumber(n))
        if (!existing.includes(normalized)) {
            config.blacklist.push(normalized)
            this.saveFileConfig(config)
            console.log(`Number ${normalized} added to blacklist (file)`)
            return true
        }
        return false
    }

    async removeFromBlacklist(number: string): Promise<boolean> {
        const normalized = this.normalizeNumber(number)

        if (redisService.isConnected) {
            await redisService.sRem(R.BLACKLIST, normalized)
            console.log(`Number ${normalized} removed from blacklist (Redis)`)
            return true
        }

        // Fallback: file
        const config = this.getFileConfig()
        config.blacklist = config.blacklist.filter((n) => this.normalizeNumber(n) !== normalized)
        this.saveFileConfig(config)
        console.log(`Number ${normalized} removed from blacklist (file)`)
        return true
    }

    async isBlacklisted(number: string): Promise<boolean> {
        const normalized = this.normalizeNumber(number)
        if (!normalized) return false

        if (redisService.isConnected) {
            return redisService.sIsMember(R.BLACKLIST, normalized)
        }

        // Fallback: file + env
        const list = await this.getBlacklist()
        return list.includes(normalized)
    }

    // ============= System Prompt =============

    async getSystemPrompt(): Promise<string> {
        if (redisService.isConnected) {
            const prompt = await redisService.get(R.SYSTEM_PROMPT)
            if (prompt !== null) return prompt
        }
        return this.getFileConfig().systemPrompt || ''
    }

    async updateSystemPrompt(prompt: string): Promise<boolean> {
        if (redisService.isConnected) {
            await redisService.set(R.SYSTEM_PROMPT, prompt)
            console.log('System prompt updated (Redis)')
            return true
        }

        const config = this.getFileConfig()
        config.systemPrompt = prompt
        this.saveFileConfig(config)
        console.log('System prompt updated (file)')
        return true
    }

    // ============= Flows =============

    async getCurrentFlow(): Promise<string> {
        if (redisService.isConnected) {
            const flow = await redisService.get(R.CURRENT_FLOW)
            if (flow) return flow
        }
        return this.getFileConfig().currentFlow || 'karuna'
    }

    private async getCustomFlows(): Promise<Record<string, any>> {
        if (redisService.isConnected) {
            const raw = await redisService.get(R.CUSTOM_FLOWS)
            if (raw) {
                try { return JSON.parse(raw) } catch { /* fall through */ }
            }
        }
        return this.getFileConfig().customFlows || {}
    }

    private async saveCustomFlows(flows: Record<string, any>): Promise<void> {
        if (redisService.isConnected) {
            await redisService.set(R.CUSTOM_FLOWS, JSON.stringify(flows))
        }
        // Also save to file as backup
        const config = this.getFileConfig()
        config.customFlows = flows
        this.saveFileConfig(config)
    }

    async getAllFlows(): Promise<Record<string, any>> {
        const customFlows = await this.getCustomFlows()
        const all: Record<string, any> = {}

        for (const [key, value] of Object.entries(FLOW_PROMPTS)) {
            all[key] = { ...value, is_builtin: true }
        }
        for (const [key, value] of Object.entries(customFlows)) {
            all[key] = { ...value, is_builtin: false }
        }

        return all
    }

    async getFlowData(flowId: string): Promise<any | null> {
        const all = await this.getAllFlows()
        return all[flowId] || null
    }

    async setFlow(flowId: string): Promise<boolean> {
        const flowData = await this.getFlowData(flowId)
        if (!flowData) return false

        const prompt = flowData.prompt || ''

        if (redisService.isConnected) {
            await redisService.set(R.CURRENT_FLOW, flowId)
            await redisService.set(R.SYSTEM_PROMPT, prompt)
        }

        const config = this.getFileConfig()
        config.currentFlow = flowId
        config.systemPrompt = prompt
        this.saveFileConfig(config)

        console.log(`Flow changed to: ${flowId}`)
        return true
    }

    async createCustomFlow(
        flowId: string,
        name: string,
        description: string,
        prompt: string,
        hasMenu = false,
        menuConfig?: MenuConfig
    ): Promise<{ success: boolean; message: string }> {
        if (flowId in FLOW_PROMPTS) {
            return { success: false, message: 'Cannot use builtin flow ID' }
        }
        if (!/^[a-z0-9_]+$/.test(flowId)) {
            return { success: false, message: 'ID can only contain lowercase letters, numbers, and underscores' }
        }

        const customFlows = await this.getCustomFlows()
        if (flowId in customFlows) {
            return { success: false, message: 'Custom flow with this ID already exists' }
        }

        customFlows[flowId] = {
            name,
            description,
            prompt,
            has_menu: hasMenu,
            menu_config: menuConfig || null,
            created_at: new Date().toISOString(),
        }

        await this.saveCustomFlows(customFlows)
        return { success: true, message: 'Flow created successfully' }
    }

    async updateCustomFlow(
        flowId: string,
        updates: { name?: string; description?: string; prompt?: string; has_menu?: boolean; menu_config?: MenuConfig }
    ): Promise<{ success: boolean; message: string }> {
        if (flowId in FLOW_PROMPTS) {
            return { success: false, message: 'Cannot edit builtin flows' }
        }

        const customFlows = await this.getCustomFlows()
        if (!customFlows[flowId]) {
            return { success: false, message: 'Custom flow not found' }
        }

        const flow = customFlows[flowId]
        if (updates.name !== undefined) flow.name = updates.name
        if (updates.description !== undefined) flow.description = updates.description
        if (updates.prompt !== undefined) flow.prompt = updates.prompt
        if (updates.has_menu !== undefined) flow.has_menu = updates.has_menu
        if (updates.menu_config !== undefined) flow.menu_config = updates.menu_config
        flow.updated_at = new Date().toISOString()

        await this.saveCustomFlows(customFlows)

        // If current flow was updated, also update the active prompt
        const currentFlow = await this.getCurrentFlow()
        if (currentFlow === flowId && updates.prompt) {
            await this.updateSystemPrompt(updates.prompt)
        }

        return { success: true, message: 'Flow updated successfully' }
    }

    async deleteCustomFlow(flowId: string): Promise<{ success: boolean; message: string }> {
        if (flowId in FLOW_PROMPTS) {
            return { success: false, message: 'Cannot delete builtin flows' }
        }

        const customFlows = await this.getCustomFlows()
        if (!customFlows[flowId]) {
            return { success: false, message: 'Custom flow not found' }
        }

        const currentFlow = await this.getCurrentFlow()
        if (currentFlow === flowId) {
            await this.setFlow('karuna')
        }

        delete customFlows[flowId]
        await this.saveCustomFlows(customFlows)
        return { success: true, message: 'Flow deleted successfully' }
    }

    async getMenuForFlow(flowId: string): Promise<MenuConfig | null> {
        const flowData = await this.getFlowData(flowId)
        if (!flowData?.has_menu) return null
        return flowData.menu_config || null
    }

    // ============= Recent Messages =============

    async logMessage(from: string, name: string, text: string): Promise<void> {
        const msg: RecentMessage = {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            from: this.normalizeNumber(from),
            name: name || from,
            text,
            timestamp: new Date().toISOString(),
        }

        if (redisService.isConnected) {
            await redisService.lPush(R.RECENT_MESSAGES, JSON.stringify(msg))
            await redisService.lTrim(R.RECENT_MESSAGES, 0, MAX_RECENT_MESSAGES - 1)
        }
    }

    async getRecentMessages(limit = 50): Promise<RecentMessage[]> {
        if (!redisService.isConnected) return []
        const raw = await redisService.lRange(R.RECENT_MESSAGES, 0, limit - 1)
        return raw.map((s) => {
            try { return JSON.parse(s) } catch { return null }
        }).filter(Boolean) as RecentMessage[]
    }

    // ============= User-specific Configs =============

    private async getUserConfigs(): Promise<Record<string, UserConfig>> {
        if (redisService.isConnected) {
            const raw = await redisService.get(R.USER_CONFIGS)
            if (raw) {
                try { return JSON.parse(raw) } catch { /* fall through */ }
            }
        }
        return {}
    }

    private async saveUserConfigs(configs: Record<string, UserConfig>): Promise<void> {
        if (redisService.isConnected) {
            await redisService.set(R.USER_CONFIGS, JSON.stringify(configs))
        }
    }

    async getAllUserConfigs(): Promise<Record<string, UserConfig>> {
        return this.getUserConfigs()
    }

    async getUserConfig(number: string): Promise<UserConfig | null> {
        const normalized = this.normalizeNumber(number)
        const configs = await this.getUserConfigs()
        return configs[normalized] || null
    }

    async setUserConfig(number: string, name: string, customPrompt: string, notes: string): Promise<boolean> {
        const normalized = this.normalizeNumber(number)
        if (!normalized) return false

        const configs = await this.getUserConfigs()
        configs[normalized] = {
            name,
            custom_prompt: customPrompt,
            notes,
            created_at: configs[normalized]?.created_at || new Date().toISOString(),
        }
        await this.saveUserConfigs(configs)
        console.log(`User config set for ${normalized}`)
        return true
    }

    async deleteUserConfig(number: string): Promise<boolean> {
        const normalized = this.normalizeNumber(number)
        const configs = await this.getUserConfigs()
        if (!configs[normalized]) return false
        delete configs[normalized]
        await this.saveUserConfigs(configs)
        console.log(`User config deleted for ${normalized}`)
        return true
    }
}

export const configService = new ConfigService()
