# Nuskha Design Direction

Agent-drafted from the product brief: a medical prescription guardian for elderly and low-literacy users in Pakistan, with hackathon judges and early pharmacy partners as secondary audiences. The owner may edit any field. This file is direction, not law.

## Identity

Nuskha means prescription, or household remedy, in Urdu. The brand is a careful neighbor pharmacist: plain-spoken, warm, exact. It never shows off. It reads the paper so you do not have to.

Product in one line: photograph a prescription, hear what it says, know what is dangerous, spend less.

## Audience

1. Primary: people over 55 and low-literacy users holding handwritten prescriptions they cannot fully read.
2. Secondary: their adult children, checking from another city.
3. Tertiary: judges, then early pharmacy and clinic partners.

## Personality

Calm, careful, human. Short sentences. Bilingual by default: Urdu voice first, English support text. Honest about limits: this tool explains, your doctor and pharmacist decide. Never clinic-cold, never startup-hype.

## Dials

ENERGY 1 / RHYTHM 2 / MOTION 1

Calm trust. Sections alternate between paper-card compositions and full-bleed single-focus screens, but nothing shouts. Motion only where it guides attention.

## Palette

Core colors:

- Paper, #FAF6EE: warm prescription-pad cream page background. Reason: paper is what a prescription lives on, and warm cream is kinder to aging eyes than pure white glare.
- Ink, #1F2A24: soft near-black with a green undertone for primary text. Softer than pure black, strong contrast on paper.
- Deep green, #14532D: brand color, headings, primary surfaces. Reason: Pakistani identity and pharmacy trust, chosen over medical blue to avoid the clinic feel.

Accent:

- Marigold, #D97706: used at the single key moment, the primary action. Reason: saffron warmth signals care in South Asian visual culture. One accent, at the decision point, nowhere else.

Semantic colors, functional only, never decorative:

- Danger #B91C1C, caution #B45309, safe #15803D. They may only appear on real warning or safe states, always paired with an icon and text.

Palette rule: 2 core plus 1 accent, neutrals free.

## Typography

- Urdu display: Noto Nastaliq Urdu. Reason: authentic nastaliq script for the wordmark and short Urdu headings, the script our audience grew up reading.
- UI and body: Noto Sans. Reason, written down: complete Urdu glyph coverage, true bold weights, high legibility at large sizes for aging eyes, open license. Not a default pick.
- Base body size 18px minimum, 20px preferred. Line height 1.6. No weights below 400.

## Motif

The prescription pad. Fine ruled lines like Rx paper mark section separators and card edges. The daily schedule uses the real 1-0-1 morning-afternoon-night grid patients already know. A subtle torn-paper edge marks the scan surface. One motif, repeated, owned.

## Layout principles

- One focal point per screen, usually one large camera button or one result.
- Tap targets 56px minimum, 44px as the absolute floor.
- Single-column flow, whitespace used as structure.
- Fixed light theme, no dark mode. Reason, written down: the audience is elderly users in bright daylight, and the paper-cream light theme is the accessibility decision.
- All text meets WCAG AA at minimum. Warnings carry icon and text, never color alone.

## Motion

Framer Motion, MOTION 1. Every animation has a written purpose:

- Scan processing shows real pipeline stages: reading, checking, explaining. Purpose: patience and trust during a 5 to 10 second wait.
- Result reveal: safety flags rise first. Purpose: attention to safety before anything else.
- Page transitions: gentle fade. Purpose: orientation, not delight.

No loops, no bounce. Nothing moves without a job.

## Voice and copy rules

- No em dashes, ever. Commas, colons, short sentences.
- Banned words: AI powered, seamless, revolutionary, cutting edge, next generation, intelligent. Say what it does.
- CTAs name the real action: Scan a prescription. Hear it in Urdu. Send to WhatsApp.
- Recurring honesty line: Nuskha explains your prescription. Your doctor and pharmacist make the decisions.
- Numbers only from real data or a labeled sample. Demo prescriptions are labeled Sample prescription.

## Imagery

Real screenshots and real photographed sample prescriptions, labeled as samples. No stock illustration, no 3D blobs, no AI avatars. The product itself is the visual.
