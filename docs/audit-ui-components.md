# Audit UI Components & Duplication Analysis (TB-006)

**Date**: 2026-07-22  
**Spec Reference**: `spec-ai-assist-unification.md` REQ-040 / AC-040  

This document audits duplicated UI components and patterns across `SitoPreventivo` (`src/components/` and `src/components/card/`, `flyer/`, `ai/`) and presents concrete abstraction proposals for each.

---

## Duplicated Patterns & Abstraction Proposals

### 1. Tier Guard Inline Check Pattern (`tier === 'unlocked'`)
- **Current Locations**:
  - `src/components/flyer/FlyerManualPanel.tsx`
  - `src/components/card/form/CardStyleFields.tsx`
  - `src/components/LogoEditor.tsx`
  - `src/components/CardAIBottomSheet.tsx`
- **Issue**: Inline `tier === 'unlocked'` conditions duplicate watermark warnings, upgrade triggers, and lock badge UI logic.
- **Proposal**: Standardize all tier-locked sections onto the shared `AiTierGuard` component in `src/components/ai-ui/AiTierGuard.tsx`.

### 2. Prompt Library & Brief Storage State Pattern
- **Current Locations**:
  - `src/components/LogoAiPanel.tsx` (logo prompt library)
  - `src/components/flyer/FlyerAiPanel.tsx` (flyer prompt library)
  - `src/components/card/CardAIControls.tsx` (card photo/cover prompt libraries)
- **Issue**: `loadPromptLibrary`, `addPromptEntry`, `removePromptEntry`, and prompt save/apply UI modal drawers repeat identical state management.
- **Proposal**: Create a generic `<AIPromptLibraryDrawer<T>>` component in `src/components/ai-ui/` that takes `storageKey`, `onApply`, and `onSave` props.

### 3. Media Upload Preview & Compression Pattern
- **Current Locations**:
  - `src/components/card/form/CardMediaFields.tsx` (Card photo + logo upload)
  - `src/components/flyer/FlyerManualPanel.tsx` (Flyer hero image upload)
- **Issue**: File input change handlers, MIME verification (`image/png`, `image/jpeg`), size limit check (5MB), base64 read, and thumbnail/remove UI controls are copy-pasted across modules.
- **Proposal**: Create a reusable `<ImageUploaderField>` component with built-in validation and thumbnail preview.

### 4. Color Picker Inline Form Elements
- **Current Locations**:
  - `src/components/card/form/CardStyleFields.tsx` (Background, text, accent colors)
  - `src/components/flyer/FlyerStyleFields.tsx` (Background, text, accent colors)
  - `src/components/LogoEditor.tsx` (Text and background colors)
- **Issue**: Standard `<input type="color">` and preset color swatches are rendered manually with separate labels and hex inputs in multiple files.
- **Proposal**: Extract `<AiColorPicker>` (similar to existing `<AiFontPicker>`) into `src/components/ai-ui/AiColorPicker.tsx` with hex validation and preset color chips.

### 5. Section Header + Helper Text + Accordion Shell Pattern
- **Current Locations**:
  - `src/components/card/form/CardFrontFields.tsx`
  - `src/components/card/form/CardBackFields.tsx`
  - `src/components/flyer/FlyerStyleFields.tsx`
- **Issue**: Form sections repeat collapsible panel structure, titles, subtitles, and standard spacing CSS classes.
- **Proposal**: Create `<FormSectionCard title="..." subtitle="..." collapsible>` component to encapsulate section styling.

---

## Action Plan & Refactoring Priorities
1. **Tier Guard Standardization**: Replace remaining inline tier checks with `AiTierGuard`.
2. **Prompt Library Consolidation**: Unify prompt drawers into `<AIPromptLibraryDrawer>`.
3. **Color Picker Component**: Build `<AiColorPicker>` in `ai-ui` for shared palette selection.
