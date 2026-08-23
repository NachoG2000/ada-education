---
title: The forward pass, scalar to vector
type: topic
channel: 02-mlp
published: 2026-08-10T11:00:00-03:00
sources:
  - raw/martin/modules/02-mlp/mlp.md
---

## Start with numbers, not matrices

Work through the forward pass by hand once, with real numbers, before writing the matrix version — the matrix form hides exactly the operations you need to trust are happening.

Take a tiny network: two inputs, one hidden layer with two units, one output, sigmoid activation. With input `x = (1, 0.5)`, hidden weights `w11 = 0.4, w12 = -0.2, w21 = 0.1, w22 = 0.3`, and hidden biases `b1 = 0, b2 = 0`:

1. Hidden unit 1: `z1 = 0.4*1 + (-0.2)*0.5 + 0 = 0.3`, so `a1 = σ(0.3) ≈ 0.574`.
2. Hidden unit 2: `z2 = 0.1*1 + 0.3*0.5 + 0 = 0.25`, so `a2 = σ(0.25) ≈ 0.562`.
3. The output unit takes `a1` and `a2` as its input and repeats the same two steps: weighted sum, then activation.

## Then generalize to matrices

Once that scalar computation is comfortable, the matrix form is just notation for doing every unit in a layer at once: `Z = X @ W + b`, `A = σ(Z)`, where `X` is a row of inputs, `W` stacks every unit's weights as a column, and `σ` is applied elementwise. The two hidden-unit computations above are literally the two columns of `X @ W` for this layer — nothing new is happening, only the bookkeeping changed.

## State every shape

State the shape of every vector as you go: in the example above, `X` is `1 × 2`, `W` is `2 × 2`, and `Z` and `A` are `1 × 2`. Getting a shape wrong is the most common way this step goes silently wrong in code, because most shape mismatches on the input side don't throw an error — they broadcast into a wrong answer instead of stopping the program. Writing the scalar version first, and naming each shape out loud, catches this before it reaches code.
