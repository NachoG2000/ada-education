---
title: Hidden layers
type: topic
channel: 02-mlp
published: 2026-08-10T10:00:00-03:00
sources:
  - raw/martin/modules/02-mlp/mlp.md
---

## The shape of a multilayer perceptron

A multilayer perceptron (MLP) has an input layer, one or more **hidden layers**, and an output layer. Each hidden layer is a set of units; each unit computes a weighted sum of everything in the previous layer, plus a bias, then applies an activation function. A network with one hidden layer of `h` units, taking `n` inputs and producing `m` outputs, has one weight matrix `n × h` into the hidden layer and one `h × m` into the output layer.

## Width versus depth

Width (units per layer) and depth (number of layers) are both design choices, and they trade off differently.

1. A wider layer gives the network more room to represent complex boundaries at a given depth.
2. More depth lets the network compose simpler pieces into more complex ones, often with fewer total parameters than an equally expressive wide-and-shallow network.
3. Neither choice fixes the other's weaknesses on its own — a network that's too narrow at every depth, or too shallow at every width, plateaus the same way.

## A practical default

For the small classification problems in this course, one hidden layer with a handful of units is usually enough. Reach for more depth only when a single hidden layer plateaus on the training data — adding depth before that point makes the network harder to train without adding anything it needed.

## Reading a network's shape

When a diagram lists layer sizes like `2 → 4 → 1`, read it as: 2 input features, 4 hidden units, 1 output unit. Each arrow is a full weight matrix connecting every unit in one layer to every unit in the next, plus one bias per unit in the layer being computed. Counting parameters this way — before writing any code — is the fastest check that a described architecture matches what actually gets built: a `2 → 4 → 1` network has `2*4 + 4` parameters into the hidden layer and `4*1 + 1` into the output layer, 17 in total.
