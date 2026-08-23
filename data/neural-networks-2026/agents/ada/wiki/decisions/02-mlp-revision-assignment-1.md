---
title: Multilayer perceptrons · revision after Assignment 1
type: decision
channel: 02-mlp
published: 2026-08-12T09:00:00-03:00
sources:
  - raw/martin/modules/02-mlp/mlp.md
---

## Accepted

1. Add a worked scalar example of the forward pass before introducing the matrix form.
2. Have students state the shape of each activation vector explicitly before computing it in matrix form.

## Note

Ignacio's Assignment 1 work showed the matrix form on its own without the intuition to back it up: the formula `Z = X @ W + b` was correct, but there was no sense of what any single hidden unit was computing. Added the scalar forward pass before the matrix form to close that gap — the module now walks through one hidden unit's arithmetic with real numbers before generalizing to matrix notation, and asks for each shape to be named along the way.
