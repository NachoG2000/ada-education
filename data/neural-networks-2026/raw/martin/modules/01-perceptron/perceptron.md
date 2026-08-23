# The perceptron — base document

The perceptron is the smallest unit we study this term: one linear boundary and one update rule. Everything else in the course — hidden layers, backpropagation, the works — is built by stacking and training more of this same idea. Read this before Assignment 1.

## The decision rule

A perceptron takes an input vector `x = (x1, x2, ..., xn)`, multiplies each component by a weight, adds a bias, and passes the sum through a step function. In symbols: `z = w1*x1 + w2*x2 + ... + wn*xn + b`, and the output is `1` if `z >= 0` and `0` otherwise (some texts use `-1`/`+1`; we use `0`/`1` for this course).

Geometrically, `z = 0` defines a line in two dimensions (a hyperplane in general). Every point on one side of that line gets classified `1`, every point on the other side gets `0`. The weights set the line's orientation; the bias slides it away from the origin. A perceptron with two inputs is nothing more than "which side of this line is the point on."

Take the OR function on two binary inputs. Weights `w1 = 1`, `w2 = 1`, bias `b = -0.5` classify it correctly: `(0,0)` gives `z = -0.5` → `0`; `(1,0)`, `(0,1)`, and `(1,1)` all give `z >= 0.5` → `1`. AND works the same way with a stricter bias, `b = -1.5`, so that only `(1,1)` clears the threshold.

## The learning rule

The weights above didn't come from nowhere — they come from training. The perceptron learning rule adjusts weights only when a training example is misclassified: for each example `(x, target)`, compute the current output, then update `w = w + lr * (target - output) * x` and `b = b + lr * (target - output)`, where `lr` is the learning rate.

Three things follow directly from this rule. First, if the output already matches the target, `(target - output) = 0` and nothing changes — correct examples never move the boundary. Second, the update always moves the line toward the misclassified point: if a `1` was scored as `0`, the weights shift to raise `z` for inputs like that one. Third, and most important for what comes next: if the training data is linearly separable, this process is guaranteed to converge to a boundary that classifies every example correctly, in a finite number of updates. That guarantee is the perceptron convergence theorem, and it's also exactly where the rule stops helping.

A worked update: with `w = (0.2, -0.1)`, `b = 0`, `lr = 0.1`, and a misclassified example `x = (1, 1)`, `target = 1`, `output = 0`, the new weights are `w = (0.3, 0.0)`, `b = 0.1`. Run enough of these and, for separable data, the line settles.

## Where a single perceptron breaks down

"Linearly separable" is the condition the convergence theorem depends on, and it is not automatic. XOR is the standard counterexample: its positive examples, `(1,0)` and `(0,1)`, and its negative examples, `(0,0)` and `(1,1)`, cannot be split by any single straight line. Plot the four points and try — every line that puts both positive points on one side puts at least one negative point on the same side too.

This isn't a training problem. No learning rate, no number of epochs, and no different starting weights fix it, because the rule above can only ever converge on a line, and no line separates XOR. The perceptron isn't failing to find the right boundary; the right boundary, for a single linear unit, doesn't exist.

The fix isn't a better perceptron — it's more than one, arranged in layers with a nonlinearity between them. That's the multilayer perceptron, the subject of the next module.
