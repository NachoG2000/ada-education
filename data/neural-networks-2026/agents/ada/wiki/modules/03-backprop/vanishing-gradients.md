---
title: Vanishing and exploding gradients
type: topic
channel: 03-backprop
published: 2026-08-14T14:45:00-03:00
sources:
  - raw/martin/modules/03-backprop/backprop.md
---

## Where depth becomes a liability

The backward recurrence `δ_prev = (δ @ W^T) ⊙ σ'(z_prev)` is where a network's depth becomes a liability. Every layer propagated through multiplies the running gradient by another `σ'(z)` term.

## Vanishing

For the logistic sigmoid, `σ'(z)` has a maximum value of `0.25`, reached only at `z = 0`; away from zero it shrinks toward `0`. Multiply several numbers each at most `0.25` together, across many layers, and the gradient reaching the earliest layers shrinks toward zero — those layers stop learning even though the loss is still nonzero. That's the **vanishing gradient** problem, and it's the practical reason deep sigmoid networks are hard to train.

## Exploding

The opposite failure happens when the weight matrices `W^T` in that same recurrence have large values: instead of shrinking, the product grows layer over layer until updates are enormous and training diverges. Both failures come from the same recurrence — repeated multiplication compounds whatever tendency, shrinking or growing, is already there.

## Why this matters in practice

1. Activation functions like ReLU, whose derivative is `1` for positive inputs rather than bounded by `0.25`, keep the multiplied term from shrinking every layer by default.
2. Careful weight initialization keeps `W^T` from starting in a regime that grows the product.
3. Both matter more as networks get deeper, because the recurrence runs once per layer — the deeper the network, the more multiplications compound the same tendency.

## A quick check on a real network

To tell which failure a training run is hitting, compare the gradient magnitude at the first hidden layer to the gradient magnitude at the last one, right after a backward pass. If the earliest layer's gradient is many orders of magnitude smaller, that's vanishing; if it's many orders of magnitude larger, that's exploding. Either symptom points back to the same recurrence above — it's diagnosing which direction the repeated multiplication pushed, not a separate bug.
