# Backpropagation — base document

Backpropagation is not a new idea on top of the forward pass — it's the chain rule, applied layer by layer, to find how much each weight is responsible for the final error. The arithmetic is mechanical once it's set up correctly. Almost every mistake in Assignment 2 comes from one specific step in that setup, so read the first section closely even if the rest feels familiar.

## Chain rule through the activation

The forward pass at a layer computes two things in sequence: a weighted sum `z = w*a_prev + b`, then an activation `a = σ(z)`. To train the network, we need to know how the loss `L` changes as each weight changes — `dL/dw` — and the chain rule says we get there by multiplying the local derivatives along the path from `w` to `L`.

The step that trips people up is the middle one: `da/dz`. Since `a = σ(z)`, the derivative of `a` with respect to `z` is `σ'(z)` — the derivative of the activation function, evaluated at `z` — **not** `σ(z)` itself. `σ(z)` is the activation's *value*; `σ'(z)` is its *slope* at that point, and it's the slope, not the value, that tells you how a small change in `z` moves `a`.

Concretely, for the logistic sigmoid `σ(z) = 1/(1+e^-z)`, the derivative has a convenient closed form: `σ'(z) = σ(z) * (1 - σ(z))`. At `z = 0`, `σ(z) = 0.5`, so `σ'(z) = 0.5 * 0.5 = 0.25` — a completely different number from `σ(z)` itself, and this is the number that belongs in the chain rule product, not `0.5`. Using `σ(z)` where `σ'(z)` belongs doesn't just introduce a small numeric error: it changes what the gradient means, because it stops representing "how sensitive is the output to this weight" and starts representing something with no clean interpretation at all.

## A scalar walkthrough

Take the smallest possible case: one input `x`, one weight `w`, one bias `b`, one sigmoid unit, and a squared-error loss `L = (1/2)(y - a)^2` against a target `y`. The forward pass: `z = w*x + b`, `a = σ(z)`.

To get `dL/dw`, chain three local derivatives together: `dL/da = -(y - a)`, `da/dz = σ'(z) = a*(1-a)`, `dz/dw = x`. Multiplying them: `dL/dw = -(y - a) * a*(1-a) * x`. Notice `a*(1-a)` is `σ'(z)`, not `a` alone — the same distinction as above, now inside an actual computation.

With numbers: `x = 1`, `w = 0.5`, `b = 0`, `y = 1`. Then `z = 0.5`, `a = σ(0.5) ≈ 0.622`. `dL/da = -(1 - 0.622) = -0.378`. `σ'(z) = a*(1-a) = 0.622 * 0.378 ≈ 0.235`. `dz/dw = x = 1`. So `dL/dw ≈ -0.378 * 0.235 * 1 ≈ -0.089`. The weight update, with learning rate `0.1`, is `w = w - 0.1 * (-0.089) = 0.5089`. Every one of those three factors matters; drop or misuse the middle one and the sign or magnitude of the whole update changes.

## The vectorized form

Once the scalar chain is solid, the vectorized version is the same three factors, generalized to a layer of units instead of one. Define `δ` (delta) at the output layer as `δ = dL/da ⊙ σ'(z)`, where `⊙` is elementwise multiplication and `σ'(z)` is applied elementwise across the layer's pre-activations — the same "derivative, not value" rule, just done for a whole vector at once.

From `δ`, the gradients with respect to the layer's parameters are `dL/dW = a_prev^T @ δ` and `dL/db = δ` (summed over the batch, if training in batches). To propagate the error one layer further back, compute `δ_prev = (δ @ W^T) ⊙ σ'(z_prev)` — the weights route the error backward, and each layer's own `σ'(z)` scales it again on the way through.

State the shape of `δ` at each layer as you compute it: it should always match the shape of that layer's pre-activation `z`. A shape mismatch here almost always means a transpose was dropped, and it will silently produce a gradient for the wrong thing rather than an error.

## Vanishing and exploding gradients

`δ_prev = (δ @ W^T) ⊙ σ'(z_prev)` is also where a network's depth becomes a liability. Every layer you propagate through multiplies the running gradient by another `σ'(z)` term. For the logistic sigmoid, `σ'(z)` has a maximum value of `0.25`, reached only at `z = 0`; away from zero it shrinks toward `0`. Multiply several numbers each at most `0.25` together, across many layers, and the gradient reaching the earliest layers shrinks toward zero — those layers stop learning even though the loss is still nonzero. That's the vanishing gradient problem, and it's the practical reason deep sigmoid networks are hard to train.

The opposite failure, exploding gradients, happens when the weight matrices `W^T` in that same recurrence have large values: instead of shrinking, the product grows layer over layer until updates are enormous and training diverges. Both failures come from the same recurrence — repeated multiplication compounds whatever tendency, shrinking or growing, is already there. In practice this is why activation functions like ReLU (whose derivative is `1` for positive inputs, not bounded by `0.25`) and careful weight initialization matter more as networks get deeper.
