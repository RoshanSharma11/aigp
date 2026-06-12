import type {
  CapabilityGroupingInput,
  GroupingRouteInput,
} from "../reasoner/prompts/grouping.v1.js";
import type { LlmCompletionRequest } from "../reasoner/llm/types.js";
import { MockLlmProvider } from "../reasoner/llm/mock-provider.js";

export const ECOMMERCE_DOMAIN_CLASSIFICATION = {
  domain: "ecommerce",
  confidence: 0.95,
  primaryEntities: ["ProductEntity", "CartEntity", "SessionEntity"],
  suggestedCategories: ["catalog", "cart", "auth"],
} as const;

export const buildEcommerceMockGroupingRoutes = (): GroupingRouteInput[] => [
  {
    routeId: "products_list",
    method: "GET",
    path: "/api/products",
    intent: "list_products",
    description: "List all products in the catalog",
    databaseEntities: ["ProductEntity"],
    requiresAuth: false,
    riskLevel: "low",
    confidence: 0.95,
  },
  {
    routeId: "products_search",
    method: "GET",
    path: "/api/products/search",
    intent: "search_products",
    description: "Search products by query filters",
    databaseEntities: ["ProductEntity"],
    requiresAuth: false,
    riskLevel: "low",
    confidence: 0.94,
  },
  {
    routeId: "products_get_by_id",
    method: "GET",
    path: "/api/products/:productId",
    intent: "get_product",
    description: "Get a single product by ID",
    databaseEntities: ["ProductEntity"],
    requiresAuth: false,
    riskLevel: "low",
    confidence: 0.93,
  },
  {
    routeId: "cart_get",
    method: "GET",
    path: "/api/cart",
    intent: "get_cart",
    description: "Get the current user's shopping cart",
    databaseEntities: ["CartEntity"],
    requiresAuth: true,
    riskLevel: "low",
    confidence: 0.92,
  },
  {
    routeId: "cart_add_item",
    method: "POST",
    path: "/api/cart/items",
    intent: "add_cart_item",
    description: "Add an item to the shopping cart",
    databaseEntities: ["CartEntity"],
    requiresAuth: true,
    riskLevel: "medium",
    confidence: 0.91,
  },
  {
    routeId: "cart_update_item",
    method: "PATCH",
    path: "/api/cart/items/:productId",
    intent: "update_cart_item",
    description: "Update quantity for a cart line item",
    databaseEntities: ["CartEntity"],
    requiresAuth: true,
    riskLevel: "medium",
    confidence: 0.9,
  },
  {
    routeId: "auth_login",
    method: "POST",
    path: "/api/auth/login",
    intent: "login",
    description: "Authenticate a user and create a session",
    databaseEntities: ["SessionEntity"],
    requiresAuth: false,
    riskLevel: "medium",
    confidence: 0.96,
  },
];

const normalizeComparablePath = (routePath: string): string => {
  if (routePath.startsWith("/api/") || routePath === "/api") {
    return routePath;
  }

  return routePath.startsWith("/") ? `/api${routePath}` : `/api/${routePath}`;
};

const pathsMatch = (left: string, right: string): boolean =>
  normalizeComparablePath(left) === normalizeComparablePath(right);

const pathStartsWithPrefix = (routePath: string, prefix: string): boolean =>
  normalizeComparablePath(routePath).startsWith(normalizeComparablePath(prefix));

export const buildEcommerceMockGroupingResponse = (
  input: CapabilityGroupingInput,
): string => {
  const allGroups = [
    {
      id: "product_catalog",
      name: "Product Catalog",
      description: "Browse and search products in the store catalog",
      category: "catalog",
      routeIds: input.routes
        .filter((route) => pathStartsWithPrefix(route.path, "/api/products"))
        .map((route) => route.routeId),
      requiresAuth: false,
      confidence: 0.93,
    },
    {
      id: "cart_management",
      name: "Cart Management",
      description: "View and modify the shopping cart",
      category: "cart",
      routeIds: input.routes
        .filter((route) => pathStartsWithPrefix(route.path, "/api/cart"))
        .map((route) => route.routeId),
      prerequisites: ["account_access"],
      requiresAuth: true,
      confidence: 0.92,
    },
    {
      id: "account_access",
      name: "Account Access",
      description: "Authenticate users and establish sessions",
      category: "auth",
      routeIds: input.routes
        .filter((route) => pathStartsWithPrefix(route.path, "/api/auth"))
        .map((route) => route.routeId),
      requiresAuth: false,
      confidence: 0.95,
    },
    {
      id: "order_management",
      name: "Order Management",
      description: "Create and track customer orders",
      category: "orders",
      routeIds: input.routes
        .filter((route) => pathStartsWithPrefix(route.path, "/api/orders"))
        .map((route) => route.routeId),
      prerequisites: ["account_access"],
      requiresAuth: true,
      confidence: 0.91,
    },
    {
      id: "customer_management",
      name: "Customer Management",
      description: "Manage customer profiles and addresses",
      category: "customers",
      routeIds: input.routes
        .filter((route) => pathStartsWithPrefix(route.path, "/api/customers"))
        .map((route) => route.routeId),
      prerequisites: ["account_access"],
      requiresAuth: true,
      confidence: 0.90,
    },
    {
      id: "review_management",
      name: "Review Management",
      description: "Create and browse product reviews",
      category: "reviews",
      routeIds: input.routes
        .filter((route) => pathStartsWithPrefix(route.path, "/api/reviews"))
        .map((route) => route.routeId),
      requiresAuth: false,
      confidence: 0.89,
    },
    {
      id: "wishlist_management",
      name: "Wishlist Management",
      description: "Manage customer wishlists",
      category: "wishlist",
      routeIds: input.routes
        .filter((route) => pathStartsWithPrefix(route.path, "/api/wishlist"))
        .map((route) => route.routeId),
      prerequisites: ["account_access"],
      requiresAuth: true,
      confidence: 0.88,
    },
    {
      id: "payment_processing",
      name: "Payment Processing",
      description: "Process payments and manage payment methods",
      category: "payments",
      routeIds: input.routes
        .filter((route) => pathStartsWithPrefix(route.path, "/api/payments"))
        .map((route) => route.routeId),
      prerequisites: ["account_access"],
      requiresAuth: true,
      confidence: 0.91,
    },
    {
      id: "notification_management",
      name: "Notification Management",
      description: "Manage user notifications and preferences",
      category: "notifications",
      routeIds: input.routes
        .filter((route) => pathStartsWithPrefix(route.path, "/api/notifications"))
        .map((route) => route.routeId),
      prerequisites: ["account_access"],
      requiresAuth: true,
      confidence: 0.87,
    },
    {
      id: "admin_management",
      name: "Admin Management",
      description: "Administrative functions for managing the platform",
      category: "admin",
      routeIds: input.routes
        .filter((route) => pathStartsWithPrefix(route.path, "/api/admin"))
        .map((route) => route.routeId),
      prerequisites: ["account_access"],
      requiresAuth: true,
      confidence: 0.92,
    },
  ];

  return JSON.stringify({
    groups: allGroups.filter((group) => group.routeIds.length > 0),
  });
};

const inferSideEffects = (method: string): "read" | "write" => {
  if (method === "GET" || method === "HEAD") {
    return "read";
  }

  return "write";
};

export const createEcommerceFixtureMockProvider = (): MockLlmProvider =>
  new MockLlmProvider((request: LlmCompletionRequest) => {
    if (request.user.includes("package_name:")) {
      return JSON.stringify(ECOMMERCE_DOMAIN_CLASSIFICATION);
    }

    const parsed = JSON.parse(request.user) as Record<string, unknown>;

    if (Array.isArray(parsed.pre_clusters)) {
      return buildEcommerceMockGroupingResponse(
        parsed as unknown as CapabilityGroupingInput,
      );
    }

    if (Array.isArray(parsed.routes) && parsed.domain !== undefined) {
      const routes = parsed.routes as GroupingRouteInput[];

      return JSON.stringify({
        labels: routes.map((route) => {
          const mockRoute = buildEcommerceMockGroupingRoutes().find(
            (candidate) => pathsMatch(candidate.path, route.path),
          );

          return {
            routeId: route.routeId,
            intent: mockRoute?.intent ?? "unknown_route",
            description: mockRoute?.description ?? "Unknown route",
            sideEffects: inferSideEffects(route.method),
            requiresAuth: mockRoute?.requiresAuth ?? false,
            riskLevel: mockRoute?.riskLevel ?? "low",
            confidence: mockRoute?.confidence ?? 0.9,
          };
        }),
      });
    }

    if (Array.isArray(parsed.groups) && Array.isArray(parsed.issues)) {
      return JSON.stringify({
        groups: parsed.groups,
        resolvedIssueCodes: (
          parsed.issues as readonly { readonly code: string }[]
        ).map((issue) => issue.code),
      });
    }

    return JSON.stringify(ECOMMERCE_DOMAIN_CLASSIFICATION);
  });
