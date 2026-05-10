# Digid Stitch Output

Source brief: `docs/digid-inkwell-stitch-brief.md`

Stitch project ID: `12930016020870673407`

## Design Concept

The generated concept is named `Steel Precision`: a technical, editorial visual system for Digid's migration from WordPress/Elementor to Inkwell.

The direction avoids generic SaaS gradients and card-heavy page sections. It uses an architectural, advisory feel with asymmetry, clear content hierarchy, and restrained color.

## Layout Decisions

- Use background shifts rather than heavy borders to establish surface hierarchy.
- Use asymmetric grids and whitespace to create a premium business-advisory feel.
- Use `Manrope` for geometric headlines and `Inter` for readable technical body copy.
- Keep article pages editorial, with long-form readability and roughly `75ch` max line length.

## Component Kit

- Service cards: minimal, typography-led modules without heavy borders.
- Data strips: horizontal technical markers for metrics, confidence, or process state.
- Precision triggers: small-radius, high-contrast buttons.
- Consultation form: visible on the page, not hidden behind a modal.
- Reading tools: sticky progress indicators and expandable table of contents for resource pages.

## Generated Screens

- Homepage: entry point with four core service pathways and manufacturing credibility.
- AI Solutions: service page for LLM/RAG and practical AI implementation.
- Government Grants: article/detail layout for deep content.
- Contact & Consultation: conversion page with consultation request form and next-step workflow.

## Implementation Notes

- Preserve one clear H1 per page.
- Keep visible breadcrumbs on service and article pages.
- Map FAQ blocks to `FAQPage` schema where present.
- Map service pages to `Service` schema.
- Preserve the lead capture path before any DNS cutover from WordPress.
