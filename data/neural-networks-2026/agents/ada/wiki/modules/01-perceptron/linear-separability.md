---
title: Linear separability and XOR
type: topic
channel: 01-perceptron
published: 2026-08-09T11:00:00-03:00
sources:
  - raw/martin/modules/01-perceptron/perceptron.md
---

## What "linearly separable" means

A dataset is linearly separable if a single straight line (or hyperplane, in higher dimensions) can put every positive example on one side and every negative example on the other. AND and OR, on two binary inputs, are both linearly separable — draw the line and check: one line correctly splits each of them.

The perceptron learning rule converges only when this condition holds. Separability isn't a detail of the proof — it's the whole reason the rule has anything to converge to.

## XOR is not separable

XOR's positive examples are `(1, 0)` and `(0, 1)`; its negative examples are `(0, 0)` and `(1, 1)`. Plot the four points: the positives sit on one diagonal, the negatives on the other. No single straight line puts both positives on one side without also catching at least one negative — every candidate line you try fails on some point.

## Why training can't fix this

This is not a training problem. No learning rate, no number of epochs, and no different starting weights solve XOR for a single perceptron, because the learning rule can only ever converge on a line, and no line separates XOR's points. The perceptron isn't failing to find the right boundary — for a single linear unit, the right boundary doesn't exist.

## The way out

A single perceptron is stuck at one straight boundary by construction. The fix is not a better perceptron; it's several of them, arranged in layers with a nonlinear function between the layers. One hidden layer with two units and a nonlinearity is enough to bend two lines into a boundary that separates XOR correctly — that construction is covered where hidden layers are introduced in the multilayer perceptron module.
