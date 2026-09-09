# Thinking in Code — Recursion

This is synthetic study material for Ada's exploration courses.

## Module 1: a problem that gets smaller

A recursive function solves a problem by calling itself on a smaller instance.
The base case returns an answer without making another recursive call.
The recursive step must make progress toward a base case. Having a base case
somewhere in the code is not enough if an input never reaches it.

For factorial over nonnegative integers, factorial(0) = 1 and
factorial(n) = n * factorial(n - 1) when n > 0.

```python
def factorial(n):
    if n < 0:
        raise ValueError("Use a nonnegative integer")
    if n == 0:
        return 1
    return n * factorial(n - 1)
```

The input domain matters: the function above expects an integer. The negative
input guard prevents subtracting one forever on negative inputs. It does not
validate every possible Python value.

## Module 2: trace before optimizing

For factorial(3), the calls descend through 3, 2, 1 and 0. The returned values
then unwind through 1, 1, 2 and 6. A call trace and a return trace answer
different questions: which subproblem is being solved, and how its result is
combined with the waiting work.

A countdown is a second example of the same stopping principle:

```python
def countdown(n):
    if n <= 0:
        return []
    return [n] + countdown(n - 1)
```

The empty list is the base result. It can be composed with the recursive
results. The base case need not return the same constant in every algorithm.

## A teaching variant: separate the two directions

When learners confuse calls with returned values, draw two columns. On the
left, write factorial(3), factorial(2), factorial(1), factorial(0). On the right,
fill in each returned value starting at the bottom. Ask the learner to explain
why the second column must be filled upward. This is an alternative example,
not a replacement for the original function.

## Module 3: branching recursion

In a binary-tree traversal, an empty subtree is a base case. Each nonempty node
recurses into at most two smaller subtrees. The depth of the call stack depends
on the tree's height; it is different from the total number of visited nodes.
Demonstrating a base case in factorial is evidence about that exercise. It does
not automatically demonstrate an understanding of stack depth in a tree.
