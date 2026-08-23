---
title: Chain rule through the activation
type: topic
channel: 03-backprop
published: 2026-08-14T14:00:00-03:00
sources:
  - raw/martin/modules/03-backprop/backprop.md
---

## Two steps, one chain

The forward pass at a layer computes two things in sequence: a weighted sum `z = w*a_prev + b`, then an activation `a = σ(z)`. To train the network we need `dL/dw` — how the loss changes as the weight changes — and the chain rule gets there by multiplying the local derivatives along the path from `w` to `L`.

## The step that trips people up

The middle step is `da/dz`. Since `a = σ(z)`, the derivative of `a` with respect to `z` is **σ'(z)** — the derivative of the activation function, evaluated at `z` — not `σ(z)` itself. `σ(z)` is the activation's *value*; `σ'(z)` is its *slope* at that point, and it's the slope, not the value, that says how a small change in `z` moves `a`.

## A number that makes the difference concrete

For the logistic sigmoid, `σ'(z) = σ(z) * (1 - σ(z))`. At `z = 0`, `σ(z) = 0.5`, so `σ'(z) = 0.5 * 0.5 = 0.25` — a different number from `σ(z)` itself, and `σ'(z)` is the one that belongs in the chain-rule product.

1. Using `σ(z)` where `σ'(z)` belongs is not a small numeric slip.
2. It changes what the gradient represents: instead of "how sensitive is the output to this weight," it becomes a quantity with no clean interpretation.
3. It shows up in Assignment 2 specifically at the point where the chain rule passes through a hidden layer's activation — the exact spot this card is about.

Keep this distinction explicit every time the chain rule crosses an activation: write `σ'(z)`, not `σ(z)`, and check it against the closed form above before trusting the rest of the computation.
