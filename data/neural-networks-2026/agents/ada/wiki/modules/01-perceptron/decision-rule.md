---
title: The perceptron's decision rule
type: topic
channel: 01-perceptron
published: 2026-08-09T10:00:00-03:00
sources:
  - raw/martin/modules/01-perceptron/perceptron.md
---

## What it computes

A perceptron takes an input vector `x`, multiplies each component by a weight, adds a bias, and passes the sum through a step function. In symbols: `z = w1*x1 + w2*x2 + ... + wn*xn + b`, and the output is `1` if `z` is at least `0`, otherwise `0`.

That's the whole model. There's no hidden state and no iteration inside a single prediction — one weighted sum, one threshold, one output.

## The geometry

Setting `z = 0` defines a line in two dimensions, or a hyperplane in higher dimensions. Every input on one side of that line scores `1`; every input on the other side scores `0`. The weights fix the line's orientation, and the bias slides it away from the origin without changing its angle.

This geometric view is the fastest way to reason about what a perceptron can and can't do: **it is always exactly one straight boundary**. Whatever the weights, there is one line, and the perceptron's whole behavior is "which side of this line is the point on."

## A worked example

Take the OR function on two binary inputs. With weights `w1 = 1`, `w2 = 1` and bias `b = -0.5`:

1. `(0, 0)`: `z = -0.5`, below `0`, output `0`. Correct — OR of two falses is false.
2. `(1, 0)`: `z = 0.5`, output `1`. Correct.
3. `(0, 1)`: `z = 0.5`, output `1`. Correct.
4. `(1, 1)`: `z = 1.5`, output `1`. Correct.

AND works the same way with a stricter bias, `b = -1.5`, so that only `(1, 1)` produces `z >= 0`. Same rule, same shape of computation — only the line moved.
