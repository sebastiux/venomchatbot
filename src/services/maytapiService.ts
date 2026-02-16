/**
 * Maytapi WhatsApp API service.
 *
 * Handles sending messages, checking phone status,
 * retrieving QR/screen, and configuring webhooks.
 *
 * API docs: https://maytapi.com/whatsapp-api-documentation
 */

const MAYTAPI_BASE = 'https://api.maytapi.com/api'

const PRODUCT_ID = process.env.MAYTAPI_PRODUCT_ID || ''
const PHONE_ID = process.env.MAYTAPI_PHONE_ID || ''
const API_TOKEN = process.env.MAYTAPI_API_TOKEN || ''

function phoneUrl(endpoint: string): string {
    return `${MAYTAPI_BASE}/${PRODUCT_ID}/${PHONE_ID}/${endpoint}`
}

function productUrl(endpoint: string): string {
    return `${MAYTAPI_BASE}/${PRODUCT_ID}/${endpoint}`
}

function headers(): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        'x-maytapi-key': API_TOKEN,
    }
}

export interface MaytapiMessage {
    to_number: string
    message: string
    type: string
}

export interface WebhookPayload {
    product_id?: string
    phone_id?: string
    message?: {
        id?: string
        type?: string
        text?: string
        fromMe?: boolean
        chatId?: string
        timestamp?: number
    }
    user?: {
        id?: string
        name?: string
        phone?: string
    }
    conversation?: string
    receiver?: string
    type?: string // 'message' | 'ack' | 'status' | 'error'
}

class MaytapiService {
    /**
     * Send a text message via Maytapi API.
     */
    async sendMessage(to: string, message: string): Promise<any> {
        const body: MaytapiMessage = {
            to_number: to,
            message,
            type: 'text',
        }

        const res = await fetch(phoneUrl('sendMessage'), {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify(body),
        })

        const data = await res.json()
        if (!res.ok) {
            console.error('[MAYTAPI] sendMessage error:', data)
            throw new Error(data?.message || `Maytapi API error ${res.status}`)
        }
        return data
    }

    /**
     * Get screen screenshot (QR code when not connected).
     * Returns base64 image data.
     */
    async getScreen(): Promise<{ success: boolean; screen?: string; message?: string }> {
        try {
            const res = await fetch(phoneUrl('getScreen'), {
                method: 'GET',
                headers: headers(),
            })

            if (!res.ok) {
                return { success: false, message: `HTTP ${res.status}` }
            }

            const contentType = res.headers.get('content-type') || ''

            // If the response is an image, convert to base64
            if (contentType.includes('image')) {
                const buffer = Buffer.from(await res.arrayBuffer())
                const base64 = buffer.toString('base64')
                return { success: true, screen: base64 }
            }

            // Otherwise it's JSON
            const data = await res.json()
            return { success: true, ...data }
        } catch (err: any) {
            return { success: false, message: err.message }
        }
    }

    /**
     * Get QR code for phone pairing.
     */
    async getQrCode(): Promise<{ success: boolean; qr?: string; message?: string }> {
        try {
            const res = await fetch(phoneUrl('getQrCode'), {
                method: 'GET',
                headers: headers(),
            })

            if (!res.ok) {
                return { success: false, message: `HTTP ${res.status}` }
            }

            const contentType = res.headers.get('content-type') || ''

            if (contentType.includes('image')) {
                const buffer = Buffer.from(await res.arrayBuffer())
                const base64 = buffer.toString('base64')
                return { success: true, qr: base64 }
            }

            const data = await res.json()
            return { success: true, ...data }
        } catch (err: any) {
            return { success: false, message: err.message }
        }
    }

    /**
     * Get phone instance status.
     */
    async getStatus(): Promise<any> {
        try {
            const res = await fetch(phoneUrl('status'), {
                method: 'GET',
                headers: headers(),
            })
            return await res.json()
        } catch (err: any) {
            return { success: false, message: err.message }
        }
    }

    /**
     * List all phones registered to the product.
     */
    async listPhones(): Promise<any> {
        try {
            const res = await fetch(productUrl('listPhones'), {
                method: 'GET',
                headers: headers(),
            })
            return await res.json()
        } catch (err: any) {
            return { success: false, message: err.message }
        }
    }

    /**
     * Set the product-level webhook URL for receiving messages.
     */
    async setWebhook(webhookUrl: string): Promise<any> {
        const res = await fetch(productUrl('setWebhook'), {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({ webhook: webhookUrl }),
        })
        return await res.json()
    }

    /**
     * Check if the service is properly configured.
     */
    isConfigured(): boolean {
        return !!(PRODUCT_ID && PHONE_ID && API_TOKEN)
    }

    getProductId(): string {
        return PRODUCT_ID
    }

    getPhoneId(): string {
        return PHONE_ID
    }
}

export const maytapiService = new MaytapiService()
