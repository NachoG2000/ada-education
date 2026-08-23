# Multilayer perceptrons — base document

A multilayer perceptron (MLP) is what you get when you stack perceptron-like units in layers and put a nonlinearity between them. This is the module where the course moves from "one line" to "a function built from many lines," and it's also where the arithmetic starts to matter more, so take the scalar version seriously before jumping to matrices.

## Hidden layers

An MLP has an input layer, one or more hidden layers, and an output layer. Each hidden layer is a set of units; each unit computes a weighted sum of everything in the previous layer, plus a bias, then applies an activation function. A network with one hidden layer of `h` units, taking `n` inputs and producing `m` outputs, has one weight matrix `n × h` into the hidden layer and one `h × m` into the output layer.

Width (units per layer) and depth (number of layers) are both design choices, and they trade off differently: a wider layer gives the network more room to represent complex boundaries at a given depth; more depth lets the network compose simpler pieces into more complex ones, often with fewer total parameters than an equally expressive wide-and-shallow network. For the small classification problems in this course, one hidden layer with a handful of units is usually enough — reach for more depth only when a single hidden layer plateaus on the training data.

## Why the nonlinearity matters

Here is the fact that makes hidden layers worth having at all: stacking linear layers without a nonlinearity between them is mathematically identical to one linear layer. If layer one computes `h = W1*x + b1` and layer two computes `y = W2*h + b2`, substituting gives `y = W2*(W1*x + b1) + b2 = (W2*W1)*x + (W2*b1 + b2)`, which has the exact same form as a single linear layer with weight `W2*W1` and bias `W2*b1 + b2`. No amount of depth helps if every layer is linear — you always collapse back to one line, the same limit discussed for a single perceptron.

The nonlinearity — a sigmoid, a tanh, a ReLU — breaks that collapse. Once a nonlinear function sits between the layers, the composition can no longer be reduced to a single linear map, and the network can represent boundaries a single line never could. This is precisely how an MLP solves XOR where one perceptron cannot: one hidden layer with two units and a nonlinearity can bend two lines into a boundary that separates XOR's points correctly.

## The forward pass

Work through the forward pass by hand once, with numbers, before writing the matrix version — the matrix form hides exactly the operations you need to trust are happening.

Take a tiny network: two inputs, one hidden layer with two units, one output. With input `x = (1, 0.5)`, hidden weights `w11 = 0.4, w12 = -0.2, w21 = 0.1, w22 = 0.3`, hidden biases `b1 = 0, b2 = 0`, and sigmoid activation: hidden unit 1 gets `z1 = 0.4*1 + (-0.2)*0.5 + 0 = 0.3`, so `a1 = σ(0.3) ≈ 0.574`. Hidden unit 2 gets `z2 = 0.1*1 + 0.3*0.5 + 0 = 0.25`, so `a2 = σ(0.25) ≈ 0.562`. The output unit takes `a1` and `a2` as its input and repeats the same two steps: weighted sum, then activation.

Once that scalar computation is comfortable, the matrix form is just notation for doing every unit in a layer at once: `Z = X @ W + b`, `A = σ(Z)`, where `X` is a row of inputs, `W` stacks every unit's weights as a column, and `σ` is applied elementwise. The two hidden-unit computations above are literally the two columns of `X @ W` for this layer — nothing new is happening, only the bookkeeping changed.

State the shape of every vector as you go: `X` is `1 × 2`, `W` is `2 × 2`, `Z` and `A` are `1 × 2`. Getting the shapes wrong is the most common way this step goes silently wrong in code, because most shape mismatches that come from the input side don't throw an error — they just broadcast into a wrong answer.
