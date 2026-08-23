---
title: A scalar walkthrough of backprop
type: topic
channel: 03-backprop
published: 2026-08-14T14:15:00-03:00
sources:
  - raw/martin/modules/03-backprop/backprop.md
---

## The smallest case

Take one input `x`, one weight `w`, one bias `b`, one sigmoid unit, and squared-error loss `L = (1/2)(y - a)^2` against a target `y`. The forward pass is `z = w*x + b`, `a = σ(z)`.

## Chaining the three factors

To get `dL/dw`, chain three local derivatives:

1. `dL/da = -(y - a)`
2. `da/dz = σ'(z) = a*(1-a)` — the activation's derivative, not its value.
3. `dz/dw = x`

Multiplying them: `dL/dw = -(y - a) * a*(1-a) * x`. Notice `a*(1-a)` is `σ'(z)`, the same quantity that comes up whenever the chain rule crosses this activation.

## Plugging in numbers

With `x = 1`, `w = 0.5`, `b = 0`, `y = 1`: `z = 0.5`, `a = σ(0.5) ≈ 0.622`. Then `dL/da = -(1 - 0.622) = -0.378`, `σ'(z) = a*(1-a) = 0.622 * 0.378 ≈ 0.235`, and `dz/dw = x = 1`. So `dL/dw ≈ -0.378 * 0.235 * 1 ≈ -0.089`.

With learning rate `0.1`, the update is `w = w - 0.1 * (-0.089) = 0.5089`. Every one of the three factors matters here — drop or misuse the middle one and the sign or magnitude of the whole update changes, which is exactly the failure mode this walkthrough is meant to make visible before it happens on a full network.

## The wrong version, for contrast

Repeat the same computation using `a` instead of `σ'(z) = a*(1-a)` in the second factor — the mistake Assignment 2 flagged for most of the cohort. That gives `dL/dw ≈ -0.378 * 0.622 * 1 ≈ -0.235`, more than double the correct magnitude, and it does not shrink toward zero as `a` approaches `1` the way the true gradient does. A network trained on that wrong quantity doesn't just converge a little differently — it's climbing a gradient that isn't the loss's gradient at all, and there's no way to tell from the training curve alone that it's happening.
