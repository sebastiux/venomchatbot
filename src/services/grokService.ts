/**
 * Grok AI service using xAI API (OpenAI-compatible).
 */
import OpenAI from 'openai'
import { configService } from './configService.js'

class GrokService {
    private client: OpenAI | null
    private conversations: Map<string, Array<{ role: string; content: string }>>
    private userMenuState: Map<string, boolean>

    constructor() {
        this.client = process.env.XAI_API_KEY
            ? new OpenAI({
                  apiKey: process.env.XAI_API_KEY,
                  baseURL: 'https://api.x.ai/v1',
              })
            : null
        this.conversations = new Map()
        this.userMenuState = new Map()
        console.log(`GrokService initialized: ${this.client ? 'OK' : 'NO API KEY'}`)
    }

    async getResponse(userId: string, userMessage: string): Promise<string> {
        if (!this.client) {
            return 'Lo siento, el servicio de IA no esta configurado correctamente.'
        }

        try {
            // Check if we should show menu
            if (this.shouldShowMenu(userId)) {
                const currentFlow = configService.getCurrentFlow()
                const menuConfig = configService.getMenuForFlow(currentFlow)
                if (menuConfig) {
                    this.userMenuState.set(userId, true)
                    return this.buildMenuMessage(menuConfig)
                }
            }

            // Check menu selection
            const currentFlow = configService.getCurrentFlow()
            const flowData = configService.getFlowData(currentFlow)
            if (flowData?.has_menu && flowData?.menu_config) {
                const menuResponse = this.handleMenuSelection(userId, userMessage, flowData.menu_config)
                if (menuResponse) return menuResponse
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

            const systemPrompt = configService.getSystemPrompt()

            console.log(`  Sending to Grok API (model: grok-4-fast-reasoning)`)
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

    private shouldShowMenu(userId: string): boolean {
        const currentFlow = configService.getCurrentFlow()
        const flowData = configService.getFlowData(currentFlow)
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

    private handleMenuSelection(userId: string, msg: string, menuConfig: any): string | null {
        try {
            const selection = parseInt(msg.trim())
            const options = menuConfig.options || []
            if (isNaN(selection) || selection < 1 || selection > options.length) return null
            return options[selection - 1].response || null
        } catch {
            return null
        }
    }

    clearConversation(userId: string): void {
        this.conversations.delete(userId)
        this.userMenuState.delete(userId)
        console.log(`Conversation reset for: ${userId}`)
    }

    getConversationCount(): number {
        return this.conversations.size
    }
}

export const grokService = new GrokService()
