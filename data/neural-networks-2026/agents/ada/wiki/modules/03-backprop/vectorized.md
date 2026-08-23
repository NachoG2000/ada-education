---
title: The vectorized form of backprop
type: topic
channel: 03-backprop
published: 2026-08-14T14:30:00-03:00
sources:
  - raw/martin/modules/03-backprop/backprop.md
---

## From one unit to a layer

Once the scalar chain is solid, the vectorized version is the same three factors, generalized to a whole layer of units instead of one. Define `δ` (delta) at the output layer as `δ = dL/da ⊙ σ'(z)`, where `⊙` is elementwise multiplication and `σ'(z)` is applied elementwise across the layer's pre-activations — the same "derivative, not value" rule, now done for a vector at once.

## The gradients

From `δ`, the gradients with respect to the layer's parameters are:

1. `dL/dW = a_prev^T @ δ`
2. `dL/db = δ` (summed over the batch, if training in batches)
3. `δ_prev = (δ @ W^T) ⊙ σ'(z_prev)` — to propagate the error one layer further back.

The weights route the error backward, and each layer's own `σ'(z)` scales it again on the way through.

## Checking the work

State the shape of `δ` at each layer as it's computed: it should always match the shape of that layer's pre-activation `z`. A shape mismatch here almost always means a transpose was dropped somewhere in `W^T` or `a_prev^T`, and it will silently produce a gradient for the wrong thing rather than raise an error — the same silent-failure pattern that shows up in the forward pass when a shape is assumed instead of checked.

## Matching it back to the scalar version

Every symbol in `δ = dL/da ⊙ σ'(z)` has a one-to-one match in the scalar walkthrough: `dL/da` is `-(y - a)` for a single unit, `σ'(z)` is `a*(1-a)` for the sigmoid, and `⊙` collapses to ordinary multiplication when there's only one unit in the layer. Nothing about moving to vector notation changes which factor is the activation's derivative — it just lets every unit in the layer carry out that same multiplication at once, which is the entire point of writing it in matrix form.
