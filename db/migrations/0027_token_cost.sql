-- TB-023: aggiunge colonna tokens_cost_usd per tracking costi reale
-- per provider AI (DeepSeek pay-per-token, Gemini per-image, Ollama flat).
-- Backward compatible: default 0, non null.
-- Vedi spec/spec-design-ai-harness-upgrade.md REQ-TC-003.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS tokens_cost_usd NUMERIC(10, 6) DEFAULT 0 NOT NULL;