import { z, Autonomous } from "@botpress/runtime";
const { Tool } = Autonomous;
import { SubAgent } from "../subagent";

// ============================================
// Sales Tools
// ============================================
// All tool handlers return hardcoded mock data — in a real agent these would
// call a sales/CRM API. The schemas are what matter: they define the contract
// the AI uses to decide which tool to call and how to present the result.

const getPromotions = new Tool({
  name: "getPromotions",
  description: "Get current sales promotions and discounts",
  input: z.object({}),
  output: z.object({
    promotions: z.array(
      z.object({
        name: z.string(),
        discount: z.string(),
        code: z.string().optional(),
        validUntil: z.string(),
      })
    ),
  }),
  handler: async () => ({
    promotions: [
      { name: "Holiday Sale", discount: "25% off", code: "HOLIDAY25", validUntil: "2024-12-31" },
      { name: "New Customer", discount: "15% off first order", code: "WELCOME15", validUntil: "Ongoing" },
      { name: "Bulk Discount", discount: "10% off orders over $500", validUntil: "Ongoing" },
    ],
  }),
});

const getProductInfo = new Tool({
  name: "getProductInfo",
  description: "Get product information and pricing",
  input: z.object({
    productId: z.string().describe("Product ID or name"),
  }),
  output: z.object({
    product: z.object({
      id: z.string(),
      name: z.string(),
      price: z.number(),
      inStock: z.boolean(),
      description: z.string(),
    }),
  }),
  handler: async ({ productId }) => ({
    product: {
      id: productId,
      name: `Product ${productId}`,
      price: 99.99,
      inStock: true,
      description: "High-quality product with excellent features",
    },
  }),
});

const createQuote = new Tool({
  name: "createQuote",
  description: "Create a sales quote for a customer",
  input: z.object({
    customerName: z.string().describe("Customer name"),
    customerEmail: z.string().describe("Customer email"),
    items: z.array(
      z.object({
        productId: z.string(),
        quantity: z.number(),
      })
    ).describe("Items for the quote"),
    discountCode: z.string().optional().describe("Promotional code to apply"),
  }),
  output: z.object({
    quoteId: z.string(),
    subtotal: z.number(),
    discount: z.number(),
    total: z.number(),
    validDays: z.number(),
  }),
  handler: async ({ customerName, items, discountCode }) => {
    const subtotal = items.reduce((sum, item) => sum + 99.99 * item.quantity, 0);
    const discount = discountCode ? subtotal * 0.15 : 0;
    return {
      quoteId: `QT-${Date.now()}`,
      subtotal,
      discount,
      total: subtotal - discount,
      validDays: 30,
    };
  },
});

const checkOrderStatus = new Tool({
  name: "checkOrderStatus",
  description: "Check the status of an order",
  input: z.object({
    orderId: z.string().describe("Order ID"),
  }),
  output: z.object({
    orderId: z.string(),
    status: z.enum(["pending", "processing", "shipped", "delivered"]),
    estimatedDelivery: z.string().optional(),
    trackingNumber: z.string().optional(),
  }),
  handler: async ({ orderId }) => ({
    orderId,
    status: "shipped" as const,
    estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    trackingNumber: `TRK${orderId}`,
  }),
});

// ============================================
// Sales SubAgent Definition
// ============================================
// The description is what the orchestrator's AI reads to decide when to delegate.
// The instructions are what the subagent's own AI reads when running in worker mode.
// The needsInput pattern in instructions teaches the AI to ask for missing info
// rather than guessing — the orchestrator relays questions back to the user.

export const salesAgent = new SubAgent({
  name: "sales",
  description: `Delegate sales-related tasks to the Sales specialist.
Use for: promotions, product info, price quotes, order status.`,
  instructions: `You are a Sales specialist.

## Capabilities
- Get promotions (no requirements)
- Get product info (requires: productId)
- Create quote (requires: customerName, customerEmail, items)
- Check order status (requires: orderId)

## IMPORTANT: If you don't have required information
Return immediately with needsInput=true and list what you need:
\`\`\`
return { action: 'done', success: false, needsInput: true, result: 'Need more information', questions: ['What is your order ID?'] }
\`\`\`

## When you have all required info
Call the appropriate tool, then return the results:
\`\`\`
const result = await getPromotions({})
return { action: 'done', success: true, result: 'Here are current promotions', data: result }
\`\`\``,
  tools: [getPromotions, getProductInfo, createQuote, checkOrderStatus],
});
