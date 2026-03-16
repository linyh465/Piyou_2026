/**
 * Exponential Backoff Retry Utility
 * Retries an async function with exponential delays: 1s → 2s → 4s
 */
export async function retryWithBackoff(fn, options = {}) {
    const {
        maxRetries = 3,
        baseDelay = 1000,
        factor = 2,
        onRetry = null,
    } = options;

    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn(attempt);
        } catch (error) {
            lastError = error;

            if (attempt === maxRetries) break;

            // Don't retry on 4xx client errors (except 429 Too Many Requests)
            if (error.response && error.response.status >= 400 && error.response.status < 500 && error.response.status !== 429) {
                throw error;
            }

            const delay = baseDelay * Math.pow(factor, attempt);
            const jitter = delay * (0.5 + Math.random() * 0.5); // Add jitter

            if (onRetry) {
                onRetry({ attempt: attempt + 1, delay: jitter, error });
            }

            await new Promise(resolve => setTimeout(resolve, jitter));
        }
    }

    throw lastError;
}
