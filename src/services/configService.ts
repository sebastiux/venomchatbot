/**
 * Configuration service for managing bot settings (flows, blacklist, prompts).
 * Persists to JSON file, same behavior as the Python version.
 */
import * as fs from 'fs'
import * as path from 'path'
import { FLOW_PROMPTS, type FlowPrompt, type MenuConfig } from '../config/flowPrompts.js'

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
                this.saveConfig(defaultConfig)
                console.log('Config file created')
            }
        } catch (e) {
            console.warn('Could not create config file:', e)
        }
    }

    private getConfig(): BotConfig {
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

    private saveConfig(config: BotConfig): boolean {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8')
            return true
        } catch (e) {
            console.error('Error saving config:', e)
            return false
        }
    }

    // ============= Blacklist =============

    getBlacklist(): string[] {
        return this.getConfig().blacklist || []
    }

    addToBlacklist(number: string): boolean {
        const config = this.getConfig()
        if (!config.blacklist.includes(number)) {
            config.blacklist.push(number)
            this.saveConfig(config)
            console.log(`Number ${number} added to blacklist`)
            return true
        }
        return false
    }

    removeFromBlacklist(number: string): boolean {
        const config = this.getConfig()
        config.blacklist = config.blacklist.filter((n) => n !== number)
        this.saveConfig(config)
        console.log(`Number ${number} removed from blacklist`)
        return true
    }

    isBlacklisted(number: string): boolean {
        return this.getBlacklist().includes(number)
    }

    // ============= System Prompt =============

    getSystemPrompt(): string {
        return this.getConfig().systemPrompt || ''
    }

    updateSystemPrompt(prompt: string): boolean {
        const config = this.getConfig()
        config.systemPrompt = prompt
        this.saveConfig(config)
        console.log('System prompt updated')
        return true
    }

    // ============= Flows =============

    getCurrentFlow(): string {
        return this.getConfig().currentFlow || 'karuna'
    }

    getAllFlows(): Record<string, any> {
        const config = this.getConfig()
        const customFlows = config.customFlows || {}
        const all: Record<string, any> = {}

        for (const [key, value] of Object.entries(FLOW_PROMPTS)) {
            all[key] = { ...value, is_builtin: true }
        }
        for (const [key, value] of Object.entries(customFlows)) {
            all[key] = { ...value, is_builtin: false }
        }

        return all
    }

    getFlowData(flowId: string): any | null {
        return this.getAllFlows()[flowId] || null
    }

    setFlow(flowId: string): boolean {
        const flowData = this.getFlowData(flowId)
        if (!flowData) return false

        const config = this.getConfig()
        config.currentFlow = flowId
        config.systemPrompt = flowData.prompt || ''
        this.saveConfig(config)
        console.log(`Flow changed to: ${flowId}`)
        return true
    }

    createCustomFlow(
        flowId: string,
        name: string,
        description: string,
        prompt: string,
        hasMenu = false,
        menuConfig?: MenuConfig
    ): { success: boolean; message: string } {
        if (flowId in FLOW_PROMPTS) {
            return { success: false, message: 'Cannot use builtin flow ID' }
        }
        if (!/^[a-z0-9_]+$/.test(flowId)) {
            return { success: false, message: 'ID can only contain lowercase letters, numbers, and underscores' }
        }

        const config = this.getConfig()
        if (!config.customFlows) config.customFlows = {}
        if (flowId in config.customFlows) {
            return { success: false, message: 'Custom flow with this ID already exists' }
        }

        config.customFlows[flowId] = {
            name,
            description,
            prompt,
            has_menu: hasMenu,
            menu_config: menuConfig || null,
            created_at: new Date().toISOString(),
        }

        this.saveConfig(config)
        return { success: true, message: 'Flow created successfully' }
    }

    updateCustomFlow(
        flowId: string,
        updates: { name?: string; description?: string; prompt?: string; has_menu?: boolean; menu_config?: MenuConfig }
    ): { success: boolean; message: string } {
        if (flowId in FLOW_PROMPTS) {
            return { success: false, message: 'Cannot edit builtin flows' }
        }

        const config = this.getConfig()
        if (!config.customFlows?.[flowId]) {
            return { success: false, message: 'Custom flow not found' }
        }

        const flow = config.customFlows[flowId]
        if (updates.name !== undefined) flow.name = updates.name
        if (updates.description !== undefined) flow.description = updates.description
        if (updates.prompt !== undefined) flow.prompt = updates.prompt
        if (updates.has_menu !== undefined) flow.has_menu = updates.has_menu
        if (updates.menu_config !== undefined) flow.menu_config = updates.menu_config
        flow.updated_at = new Date().toISOString()

        if (config.currentFlow === flowId && updates.prompt) {
            config.systemPrompt = updates.prompt
        }

        this.saveConfig(config)
        return { success: true, message: 'Flow updated successfully' }
    }

    deleteCustomFlow(flowId: string): { success: boolean; message: string } {
        if (flowId in FLOW_PROMPTS) {
            return { success: false, message: 'Cannot delete builtin flows' }
        }

        const config = this.getConfig()
        if (!config.customFlows?.[flowId]) {
            return { success: false, message: 'Custom flow not found' }
        }

        if (config.currentFlow === flowId) {
            config.currentFlow = 'karuna'
            config.systemPrompt = FLOW_PROMPTS.karuna.prompt
        }

        delete config.customFlows[flowId]
        this.saveConfig(config)
        return { success: true, message: 'Flow deleted successfully' }
    }

    getMenuForFlow(flowId: string): MenuConfig | null {
        const flowData = this.getFlowData(flowId)
        if (!flowData?.has_menu) return null
        return flowData.menu_config || null
    }
}

export const configService = new ConfigService()
