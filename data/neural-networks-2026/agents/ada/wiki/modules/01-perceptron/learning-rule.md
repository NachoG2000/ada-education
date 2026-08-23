---
title: The perceptron learning rule
type: topic
channel: 01-perceptron
published: 2026-08-09T10:30:00-03:00
sources:
  - raw/martin/modules/01-perceptron/perceptron.md
---

## The update

The perceptron learning rule adjusts weights only when a training example is misclassified. For each example `(x, target)`:

1. Compute the current output using the decision rule (weighted sum, then threshold).
2. If `output == target`, do nothing.
3. Otherwise, update `w = w + lr * (target - output) * x` and `b = b + lr * (target - output)`, where `lr` is the learning rate.

## Why it works

Three consequences fall directly out of that formula. First, correct examples never move the boundary: if `output == target`, the factor `(target - output)` is `0` and the update is `0`. Second, the update always moves the line toward the point that was misclassified — if a `1` scored as `0`, the weights shift to raise `z` for inputs shaped like that one. Third, the process only ever touches weights when there's an error to correct, so training naturally stops changing once every example is classified correctly.

## Convergence — and its limit

If the training data is **linearly separable**, this rule is guaranteed to converge to a boundary that classifies every example correctly, in a finite number of updates. That guarantee is the perceptron convergence theorem.

The theorem's condition is also its limit: it says nothing about what happens when the data is *not* linearly separable, because in that case no boundary the rule could converge to actually exists.

## A worked update

Starting from `w = (0.2, -0.1)`, `b = 0`, `lr = 0.1`, and a misclassified example `x = (1, 1)`, `target = 1`, `output = 0`: the new weights are `w = (0.2 + 0.1*1, -0.1 + 0.1*1) = (0.3, 0.0)`, and the new bias is `b = 0 + 0.1 = 0.1`. Repeat across the dataset, and for separable data the line settles.
