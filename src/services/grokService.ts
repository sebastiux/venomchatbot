/**
 * Grok AI service using xAI API (OpenAI-compatible).
 * Supports per-user demo mode for the Karuna Demos showcase flow.
 */
import OpenAI from 'openai'
import { configService } from './configService.js'

interface DemoState {
    flowId: string
    prompt: string
}

interface MenuSelectionResult {
    response: string
    demoFlowId?: string
}

const DEMO_RESET_KEYWORDS = ['menu', 'demos', 'cambiar', 'ejemplos', 'volver', 'regresar', '0']

class GrokService {
    private client: OpenAI | null
    private conversations: Map<string, Array<{ role: string; content: string }>>
    private userMenuState: Map<string, boolean>
    private userDemoState: Map<string, DemoState>

    constructor() {
        this.client = process.env.XAI_API_KEY
            ? new OpenAI({
                  apiKey: process.env.XAI_API_KEY,
                  baseURL: 'https://api.x.ai/v1',
              })
            : null
        this.conversations = new Map()
        this.userMenuState = new Map()
        this.userDemoState = new Map()
        console.log(`GrokService initialized: ${this.client ? 'OK' : 'NO API KEY'}`)
    }

    async getResponse(userId: string, userMessage: string): Promise<string> {
        if (!this.client) {
            return 'Lo siento, el servicio de IA no esta configurado correctamente.'
        }

        try {
            const currentFlow = await configService.getCurrentFlow()
            const flowData = await configService.getFlowData(currentFlow)
            const lowerMsg = userMessage.trim().toLowerCase()

            // Handle demo reset keywords — return to demo menu
            if (this.userDemoState.has(userId) && DEMO_RESET_KEYWORDS.includes(lowerMsg)) {
                this.userDemoState.delete(userId)
                this.conversations.delete(userId)
                this.userMenuState.delete(userId)
                if (flowData?.has_menu && flowData?.menu_config) {
                    this.userMenuState.set(userId, true)
                    return this.buildMenuMessage(flowData.menu_config)
                }
            }

            // Check if we should show menu (first message for this user)
            if (await this.shouldShowMenu(userId)) {
                const menuConfig = await configService.getMenuForFlow(currentFlow)
                if (menuConfig) {
                    this.userMenuState.set(userId, true)
                    return this.buildMenuMessage(menuConfig)
                }
            }

            // Check menu selection (with demo flow switching support)
            if (flowData?.has_menu && flowData?.menu_config) {
                const result = this.handleMenuSelection(userId, userMessage, flowData.menu_config)
                if (result) {
                    if (result.demoFlowId) {
                        const demoFlow = await configService.getFlowData(result.demoFlowId)
                        if (demoFlow) {
                            this.userDemoState.set(userId, {
                                flowId: result.demoFlowId,
                                prompt: demoFlow.prompt,
                            })
                            this.conversations.delete(userId)
                            console.log(`  Demo activated for ${userId}: ${result.demoFlowId}`)
                        }
                    }
                    return result.response
                }
            }

            // Normal AI response
            if (!this.conversations.has(userId)) {
                this.conversations.set(userId, [])
            }

            const history = this.conversations.get(userId)!
            history.push({ role: 'user', content: userMessage })

            // Keep last 20 messages
            if (history.length > 20) {
                this.conversations.set(userId, history.slice(-20))
            }

            // Priority: 1) user-specific config  2) demo prompt  3) global flow prompt
            let systemPrompt: string
            let promptSource = ''

            const userConfig = await configService.getUserConfig(userId)
            if (userConfig?.custom_prompt) {
                systemPrompt = userConfig.custom_prompt
                promptSource = ` [USER: ${userConfig.name || userId}]`
            } else if (this.userDemoState.has(userId)) {
                systemPrompt = this.userDemoState.get(userId)!.prompt
                promptSource = ` [DEMO: ${this.userDemoState.get(userId)!.flowId}]`
            } else {
                systemPrompt = await configService.getSystemPrompt()
            }

            console.log(`  Sending to Grok API (model: grok-4-fast-reasoning)${promptSource}`)
            console.log(`  Messages in context: ${this.conversations.get(userId)!.length}`)

            const completion = await this.client.chat.completions.create({
                model: 'grok-4-fast-reasoning',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...(this.conversations.get(userId) as any),
                ],
                temperature: 0.7,
                max_tokens: 1000,
            })

            const response = completion.choices[0].message.content || 'Sin respuesta'
            console.log(`  Grok response: ${response.substring(0, 100)}...`)

            history.push({ role: 'assistant', content: response })
            return response
        } catch (error) {
            console.error('ERROR IN GROK API:', error)
            return 'Disculpa, hubo un error tecnico. Puedes intentar de nuevo?'
        }
    }

    private async shouldShowMenu(userId: string): Promise<boolean> {
        const currentFlow = await configService.getCurrentFlow()
        const flowData = await configService.getFlowData(currentFlow)
        if (flowData?.has_menu && flowData?.menu_config) {
            if (!this.userMenuState.has(userId)) return true
        }
        return false
    }

    private buildMenuMessage(menuConfig: any): string {
        let message = (menuConfig.welcome_message || '') + '\n\n'
        const options = menuConfig.options || []
        options.forEach((opt: any, i: number) => {
            message += `${i + 1}. ${opt.label || ''}\n`
        })
        message += '\n' + (menuConfig.footer_message || '')
        return message
    }

    private handleMenuSelection(_userId: string, msg: string, menuConfig: any): MenuSelectionResult | null {
        try {
            const selection = parseInt(msg.trim())
            const options = menuConfig.options || []
            if (isNaN(selection) || selection < 1 || selection > options.length) return null
            const option = options[selection - 1]
            return {
                response: option.response || '',
                demoFlowId: option.demo_flow_id,
            }
        } catch {
            return null
        }
    }

    clearConversation(userId: string): void {
        this.conversations.delete(userId)
        this.userMenuState.delete(userId)
        this.userDemoState.delete(userId)
        console.log(`Conversation reset for: ${userId}`)
    }

    getConversationCount(): number {
        return this.conversations.size
    }
}

export const grokService = new GrokService()
