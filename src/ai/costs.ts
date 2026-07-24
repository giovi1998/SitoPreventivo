/**
 * Flat token cost constants for non-text generation operations.
 * Gemini image endpoints don't expose token counts via DeepSeek-style
 * `usage`, so we account for them as a flat per-image cost. This value
 * is intentionally conservative and can be tuned later without changing
 * any call-site logic.
 */
export const IMAGE_TOKEN_COST = 500;
