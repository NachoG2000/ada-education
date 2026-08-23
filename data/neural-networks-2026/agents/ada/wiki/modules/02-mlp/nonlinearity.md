---
title: Why the nonlinearity matters
type: topic
channel: 02-mlp
published: 2026-08-10T10:30:00-03:00
sources:
  - raw/martin/modules/02-mlp/mlp.md
---

## Stacked linear layers collapse

Stacking linear layers without a nonlinearity between them is mathematically identical to one linear layer. If layer one computes `h = W1*x + b1` and layer two computes `y = W2*h + b2`, substituting gives `y = W2*(W1*x + b1) + b2 = (W2*W1)*x + (W2*b1 + b2)`. That has the exact same form as one linear layer, with weight `W2*W1` and bias `W2*b1 + b2`.

No amount of depth helps if every layer is linear: the composition always collapses back to one line, the same limit a single perceptron runs into with a dataset like XOR that isn't linearly separable.

## The nonlinearity breaks the collapse

A **nonlinearity** — a sigmoid, a tanh, a ReLU — sitting between the layers changes this. Once a nonlinear function is applied between two linear steps, the composition can no longer be reduced to a single linear map algebraically, and the network can represent boundaries a single line never could.

## Why this solves XOR

This is exactly how an MLP solves XOR where one perceptron cannot. A single hidden layer with two units and a nonlinearity is enough: each hidden unit draws its own line, the nonlinearity keeps their combination from collapsing back into one line, and the output layer combines the two bent regions into a boundary that separates XOR's points correctly. Depth without a nonlinearity buys nothing; depth with one buys everything.

## Checking the arithmetic yourself

It's worth substituting real numbers into the collapse argument once, so it isn't just an abstract identity. Pick any `W1`, `b1`, `W2`, `b2` and any input `x`, compute `h = W1*x + b1` and then `y = W2*h + b2` two ways: directly, and by first multiplying `W2*W1` into a single matrix and applying that to `x` plus the combined bias. The two answers match exactly, every time, with no activation in between — which is the proof, not just a claim, that a stack of purely linear layers is never more expressive than one.
