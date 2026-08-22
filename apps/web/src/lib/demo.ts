/* Demo community — fully synthetic (see PRODUCT.md → Evidence on Hand).
   Course: Neural Networks, 2026. Course agent: "Ada" (blue), the community's default agent. */

import type { Card, Community, Message } from "./types"

const T = (text: string) => ({ kind: "text" as const, text })
const C = (text: string, cardId: string, section?: string) => ({
  kind: "cite" as const,
  text,
  cite: { cardId, section },
})
const K = (text: string) => ({ kind: "code" as const, text })

const cards: Card[] = [
  {
    id: "p-guide",
    channelId: "questions",
    title: "Frequently asked questions guide",
    type: "note",
    authorId: "martin",
    version: 4,
    visibility: "channel",
    sources: [{ kind: "file", ref: "faq-guide.md", label: "faq-guide.md" }],
    base: true,
    publishedAt: "2026-08-03T10:00:00-03:00",
    body: `## 1. Before you ask\nCheck the channel's cards. If the question is already answered, the agent will reply from there.\n\n## 2. Learning rate\nIf the loss oscillates, lower the learning rate by an order of magnitude. If it stalls, raise it.\n\n## 3. Why the loss is averaged per batch\nSo the learning rate doesn't depend on batch size. With a sum, a batch of 256 moves the weights 256 times more than a batch of 1.`,
  },
  {
    id: "p-vanishing",
    channelId: "questions",
    title: "Vanishing gradient",
    type: "note",
    authorId: "ada",
    version: 2,
    visibility: "channel",
    sources: [
      { kind: "message", ref: "m-old-1", label: "Tomas · Aug 12" },
      { kind: "file", ref: "lecture-06.pdf", label: "lecture-06.pdf" },
    ],
    publishedAt: "2026-08-14T18:20:00-03:00",
    body: `## 1. What it is\nIn a deep network, the gradient of the early layers is a product of many derivatives. If each factor is less than 1, the product tends toward zero.\n\n## 2. The product of Jacobians\nThe derivative of the sigmoid is bounded by 0.25. Ten layers of sigmoid multiply, at most, 0.25¹⁰ ≈ 10⁻⁶. With ReLU the factor is 0 or 1, and the problem changes shape: it doesn't shrink, it turns off.\n\n## 3. What to do\nCareful initialization (Xavier/He), ReLU or variants, layer normalization, residual connections.`,
  },
  {
    id: "p-explodes",
    channelId: "questions",
    title: "Why does the gradient explode?",
    type: "answer",
    authorId: "ada",
    version: 1,
    visibility: "channel",
    sources: [
      { kind: "message", ref: "m-sofia-q", label: "Sofia · today 10:03" },
      { kind: "message", ref: "m-ada-a1", label: "Ada · today 10:04" },
    ],
    state: "new",
    publishedAt: "2026-08-22T10:06:00-03:00",
    body: `## Short answer\nIt's not the sigmoid itself: it's the **product of Jacobians** in the chain. With a learning rate of 0.5, each step amplifies an error that was already large from the last layer, and within three epochs the loss goes to \`nan\`.\n\n## What to check\n1. How the derivatives multiply layer by layer → *Vanishing gradient*, §2.\n2. Why the initial weight scale matters so much → *Weight initialization*, §1.\n\n## What to try\n\`lr = 0.1\` with Xavier initialization. If it still explodes, it's the batch: check that you're averaging the loss, not summing it.`,
  },
  {
    id: "p-init",
    channelId: "questions",
    title: "Weight initialization",
    type: "answer",
    authorId: "ada",
    version: 3,
    visibility: "channel",
    sources: [{ kind: "message", ref: "m-old-2", label: "Lucia · Aug 9" }],
    publishedAt: "2026-08-10T16:40:00-03:00",
    body: `## 1. Initial scale\nIf the weights start large, activations saturate and gradients explode or vanish. Xavier (tanh/sigmoid) and He (ReLU) choose the initial variance so the signal keeps its scale layer by layer.`,
  },
  {
    id: "p-batch",
    channelId: "questions",
    title: "Averaging the loss per batch",
    type: "answer",
    authorId: "ada",
    version: 1,
    visibility: "channel",
    sources: [{ kind: "message", ref: "m-tomas-q", label: "Tomas · yesterday 18:42" }],
    publishedAt: "2026-08-21T18:50:00-03:00",
    body: `It's averaged so the learning rate doesn't depend on batch size.`,
  },
]

const messages: Message[] = [
  {
    id: "m-tomas-q",
    channelId: "questions",
    authorId: "tomas",
    at: "2026-08-21T18:42:00-03:00",
    paragraphs: [
      [T("Did anyone understand why we need to average the loss per batch? Martin mentioned it in passing during class.")],
    ],
    threadId: "t-batch",
  },
  {
    id: "m-ada-batch",
    channelId: "questions",
    authorId: "ada",
    at: "2026-08-21T18:44:00-03:00",
    paragraphs: [
      [
        T("Short answer: so the learning rate doesn't depend on batch size. With a sum, a batch of 256 moves the weights 256 times more than a batch of 1. It's in there with the numeric example from class in "),
        C("Frequently asked questions guide", "p-guide", "§3"),
      ],
    ],
    threadId: "t-batch",
    reactions: [
      { emoji: "👍", count: 4 },
      { emoji: "🙏", count: 1 },
    ],
  },
  {
    id: "m-sofia-q",
    channelId: "questions",
    authorId: "sofia",
    at: "2026-08-22T10:03:00-03:00",
    paragraphs: [
      [
        T("When I raise the learning rate to "),
        K("0.5"),
        T(" the loss goes to "),
        K("nan"),
        T(" within three epochs. Lowering it to "),
        K("0.01"),
        T(" works. Why does the gradient explode? Is it the sigmoid?"),
      ],
    ],
    threadId: "t-explodes",
  },
  {
    id: "m-ada-a1",
    channelId: "questions",
    authorId: "ada",
    at: "2026-08-22T10:04:00-03:00",
    threadId: "t-explodes",
    paragraphs: [
      [
        T("It's not the sigmoid itself, it's the product of Jacobians in the chain. With lr = 0.5 each step amplifies an error that was already large from the last layer."),
      ],
      [T("Two things to check:")],
      [T("1. How the derivatives multiply layer by layer → "), C("Vanishing gradient", "p-vanishing", "§2")],
      [
        T("2. Why the initial weight scale matters so much → "),
        C("Weight initialization", "p-init", "§1"),
      ],
      [T("Try "), K("lr = 0.1"), T(" with Xavier initialization. If it still explodes, it's the batch.")],
    ],
  },
  {
    id: "m-sofia-a2",
    channelId: "questions",
    authorId: "sofia",
    at: "2026-08-22T10:05:00-03:00",
    threadId: "t-explodes",
    paragraphs: [[T("Ahh, with Xavier it no longer gives nan. Thanks!")]],
  },
  {
    id: "m-ada-a3",
    channelId: "questions",
    authorId: "ada",
    at: "2026-08-22T10:06:00-03:00",
    threadId: "t-explodes",
    paragraphs: [[T("I'll archive this, it's sure to come up again.")]],
  },
  {
    id: "m-ada-pub",
    channelId: "questions",
    authorId: "ada",
    at: "2026-08-22T10:06:00-03:00",
    paragraphs: [],
    publishes: "p-explodes",
  },
  {
    id: "m-tomas-2",
    channelId: "questions",
    authorId: "tomas",
    at: "2026-08-22T10:21:00-03:00",
    paragraphs: [[T("Same thing happened to me yesterday with ReLU, so it's not just the sigmoid 👀")]],
  },
]

export const demo: Community = {
  id: "neural-networks",
  name: "Neural Networks 2026",
  subtitle: "Term 2 2026 · 31 members",
  initial: "N",
  meId: "sofia",
  members: [
    { kind: "person", id: "martin", name: "Martin", initials: "M", tone: "red-soft", role: "teacher", presence: "online" },
    {
      kind: "agent",
      id: "ada",
      name: "Ada",
      scope: "community",
      createdBy: "martin",
      figureSeed: "ada-01",
      figureColor: "blue",
      instructions: "Keep the course's cards up to date: answer questions by citing cards, and archive anything that comes up again as an answer.",
      provider: { mode: "subscription", model: "Claude" },
      channelIds: ["general", "questions", "m01", "m02", "m03", "assignment-2"],
      presence: "publishing",
    },
    { kind: "person", id: "sofia", name: "Sofia", initials: "S", tone: "seal-soft", role: "student", presence: "online" },
    { kind: "person", id: "tomas", name: "Tomas", initials: "T", tone: "cardstock", role: "student", presence: "online" },
    { kind: "person", id: "lucia", name: "Lucia", initials: "L", tone: "card", role: "student", presence: "away" },
    {
      kind: "agent",
      id: "tutor-sofia",
      name: "Sofia's tutor",
      scope: "personal",
      createdBy: "sofia",
      figureSeed: "tutor-sofia-02",
      instructions: "Explain things to me with small numeric examples before formulas.",
      provider: { mode: "api-key", model: "Claude" },
      channelIds: ["dm-tutor"],
      presence: "away",
    },
  ],
  channels: [
    { id: "general", name: "general", group: "course", memberIds: [] },
    {
      id: "questions",
      name: "questions",
      group: "course",
      description: "Ask anything. Ada answers and archives what's worth keeping.",
      memberIds: ["martin", "ada", "sofia", "tomas", "lucia"],
      memberCount: 31,
    },
    { id: "m01", name: "01-perceptron", group: "course", memberIds: [] },
    { id: "m02", name: "02-mlp", group: "course", memberIds: [] },
    { id: "m03", name: "03-backprop", group: "course", memberIds: [], unread: true },
    { id: "teachers", name: "teachers", group: "course", memberIds: [] },
    { id: "assignment-2", name: "Assignment 2 · Backprop by hand", group: "work", memberIds: [], work: { status: "active", due: "Sep 12" } },
    { id: "assignment-1", name: "Assignment 1 · Perceptron", group: "work", memberIds: [], work: { status: "submitted" } },
    { id: "midterm-1", name: "Midterm 1", group: "work", memberIds: [], work: { status: "archived" } },
    { id: "dm-tutor", name: "Sofia's tutor", group: "private", memberIds: ["sofia", "tutor-sofia"] },
    { id: "dm-martin", name: "Martin", group: "private", memberIds: ["sofia", "martin"] },
  ],
  cards,
  messages,
  threads: [
    { id: "t-batch", rootMessageId: "m-tomas-q", replyIds: ["m-ada-batch"], publishedCardId: "p-batch" },
    {
      id: "t-explodes",
      rootMessageId: "m-sofia-q",
      replyIds: ["m-ada-a1", "m-sofia-a2", "m-ada-a3"],
      publishedCardId: "p-explodes",
    },
  ],
}

export const CARD_TYPE_LABEL: Record<Card["type"], string> = {
  note: "note",
  assignment: "assignment",
  decision: "decision",
  answer: "answer",
  submission: "submission",
}
