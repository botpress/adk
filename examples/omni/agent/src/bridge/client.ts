import type { ToolContext } from '../tools/types.js'

/**
 * Error thrown when local plane communication fails
 */
export class LocalPlaneError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly endpoint?: string
  ) {
    super(message)
    this.name = 'LocalPlaneError'
  }
}

/**
 * Response wrapper from the local plane
 */
export type LocalPlaneResponse<T> = {
  success: boolean
  data?: T
  error?: string
}

/**
 * Make an authenticated HTTP call to the local control plane
 *
 * @param endpoint - The API endpoint path (e.g., '/bash')
 * @param payload - The request body to send
 * @param config - Configuration with localPlaneUrl and localPlaneToken
 * @returns The response data from the local plane
 * @throws LocalPlaneError if the request fails
 */
export async function callLocalPlane<TInput, TOutput>(
  endpoint: string,
  payload: TInput,
  config: ToolContext['config']
): Promise<TOutput> {
  const { localPlaneUrl, localPlaneToken } = config

  if (!localPlaneUrl) {
    throw new LocalPlaneError('Local plane URL not configured. Set localPlaneUrl in agent config.')
  }

  if (!localPlaneToken) {
    throw new LocalPlaneError('Local plane token not configured. Set localPlaneToken in agent config.')
  }

  // Normalize URL (remove trailing slash) and build full endpoint
  const baseUrl = localPlaneUrl.replace(/\/$/, '')
  const url = `${baseUrl}${endpoint}`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localPlaneToken}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error')
      throw new LocalPlaneError(`Local plane returned ${response.status}: ${text}`, response.status, endpoint)
    }

    const result = (await response.json()) as LocalPlaneResponse<TOutput>

    if (!result.success) {
      throw new LocalPlaneError(result.error ?? 'Unknown local plane error', undefined, endpoint)
    }

    return result.data as TOutput
  } catch (error) {
    if (error instanceof LocalPlaneError) {
      throw error
    }

    // Network or parsing error
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new LocalPlaneError(`Failed to reach local plane: ${message}`, undefined, endpoint)
  }
}

/**
 * Check if the local plane is reachable and authenticated
 */
export async function pingLocalPlane(config: ToolContext['config']): Promise<boolean> {
  try {
    await callLocalPlane<Record<string, never>, { ok: boolean }>('/health', {}, config)
    return true
  } catch {
    return false
  }
}
