# Project Working Title

> **Original brainstorm.** For canonical project context use `project-overview.md`, `architecture.md`, `build-plan.md`, `glossary.md`.

Agent Interface Generation Platform (AIGP)

---

# One-Line Problem

AI agents are becoming major consumers of internet services, but websites are still designed primarily for humans, forcing agents to rely on fragile browser automation and scraping.

---

# One-Line Solution

A plug-and-play SDK that automatically generates and maintains an agent-operable capability layer for any website or application, enabling AI agents to interact through structured actions instead of browser automation.

---

# Vision

The internet currently has two layers:

1. Human Layer

   * HTML
   * CSS
   * JavaScript
   * Mobile Apps

2. Agent Layer (missing)

   * Capabilities
   * Actions
   * Permissions
   * Structured Responses

Our goal is to create the Agent Layer for the web.

---

# Core Thesis

Websites are optimized for humans.

AI agents need:

* structured capabilities
* structured data
* explicit actions
* reliable execution

Instead of making agents better at using websites, make websites easier for agents to use.

---

# Detailed Problem

## Current State

When an AI agent wants to:

* buy a product
* book a hotel
* submit a form
* create a support ticket
* pay an invoice

it often performs browser automation.

Example:

Agent
→ Open website
→ Wait for page load
→ Find search box
→ Type query
→ Find button
→ Click button
→ Wait
→ Parse UI
→ Continue

This creates:

* high latency
* high compute costs
* frequent failures
* brittle workflows
* poor scalability

---

## Why This Problem Gets Worse

AI traffic is growing rapidly.

Future internet consumers include:

* ChatGPT agents
* Claude agents
* Gemini agents
* Open-source agents
* Internal enterprise agents
* Autonomous workflows

The web was not designed for them.

The mismatch between agent needs and website interfaces will continue growing.

---

## Existing Alternatives

### Browser Automation

Examples:

* Browser Use
* Browserbase
* Steel
* OpenManus

Approach:

Make agents better at using websites.

Limitations:

* slow
* expensive
* fragile
* dependent on UI changes

---

### Scraping Platforms

Examples:

* Firecrawl
* Jina Reader
* Crawl4AI

Approach:

Make websites easier to read.

Limitations:

* solves information access
* does not solve action execution

---

### APIs

Approach:

Developers manually expose APIs.

Limitations:

* requires engineering effort
* inconsistent standards
* often unavailable

---

### MCP Servers

Approach:

Developers manually define agent tools.

Limitations:

* manual implementation
* manual maintenance
* duplicated effort

---

# Proposed Solution

Install SDK.

Example:

npm install @agent-layer/sdk

The SDK automatically analyzes:

* routes
* forms
* APIs
* user flows
* business actions
* authentication patterns

and generates an agent interface.

---

# Generated Outputs

## Agent Discovery Endpoint

/.well-known/agent.json

Allows agent discovery.

---

## Capability Registry

Example:

* search_products
* create_cart
* checkout
* track_order

---

## Structured Read Interface

Provides machine-readable content.

Alternative to scraping.

---

## Structured Action Interface

Allows agents to perform actions directly.

Example:

create_order()

instead of clicking buttons.

---

## MCP Endpoint

Automatically generated MCP server.

---

## OpenAPI Endpoint

Automatically generated OpenAPI specification.

---

## Agent Analytics

Shows:

* agent traffic
* capability usage
* failed actions
* agent types

---

# Example Flow

Today:

Agent
→ Browser
→ Website

Future:

Agent
→ Capability Layer
→ Website

No browser interaction required.

---

# Long-Term Vision

For agents:

robots.txt became discoverability.

sitemap.xml became navigation.

We want to become:

agent.json

The standard capability layer for agent interaction.

---

# Key Features

## Automatic Capability Discovery

Detects business actions automatically.

Examples:

* purchase product
* book appointment
* create ticket
* subscribe plan

---

## Automatic Synchronization

Updates capability layer whenever application changes.

No manual maintenance.

---

## Permission Controls

Developers can:

* approve
* deny
* restrict

specific capabilities.

---

## Authentication Layer

Supports:

* OAuth
* API keys
* delegated user access
* agent identity

---

## Agent Analytics

Track:

* which agents visit
* what they use
* failure rates
* opportunity insights

---

## Capability Governance

Audit logs.

Rate limits.

Approval workflows.

Policy enforcement.

---

# Ideal Initial Markets

1. Ecommerce

High transaction volume.

Clear actions.

Easy ROI.

---

2. SaaS Products

Tickets.

Projects.

Reports.

User management.

---

3. Marketplaces

Search.

Booking.

Payments.

Fulfillment.

---

# Markets To Avoid Initially

* Figma-like products
* Canva-like products
* CAD software
* Trading terminals
* Gaming platforms

These are heavily visual and difficult to abstract into capabilities.

---

# Competitive Landscape

Category:
Browser Automation

Players:
Browser Use, Browserbase, Steel

Position:
Make agents better browsers.

---

Category:
Scraping

Players:
Firecrawl, Crawl4AI, Jina Reader

Position:
Make websites easier to read.

---

Category:
APIs

Players:
Traditional APIs

Position:
Manual integration.

---

Category:
MCP

Players:
Custom MCP implementations

Position:
Manual capability exposure.

---

Our Position:

Automatically generate and maintain an agent-operable capability layer from existing applications.

---

# Adoption Challenges

## Challenge 1

Website owners may not yet see agent traffic as important.

Mitigation:

Start with analytics and visibility.

Provide immediate value.

---

## Challenge 2

Agent ecosystems are fragmented.

Mitigation:

Generate MCP, OpenAPI and REST simultaneously.

Avoid betting on one protocol.

---

## Challenge 3

Discovery Standard Does Not Exist

Mitigation:

Support existing standards while proposing a lightweight agent discovery specification.

---

## Challenge 4

Trust and Security

Mitigation:

Permissions.

Human approval.

Rate limits.

Audit trails.

---

# Technical Risks

## Risk

Automatic capability inference may be inaccurate.

Mitigation

Human review workflow before publishing capabilities.

---

## Risk

Complex websites may not be fully inferable.

Mitigation

Hybrid model:

80% automatic

20% manual overrides

---

## Risk

Authentication complexity.

Mitigation

Focus initially on read-only and low-risk actions.

Add transactional support later.

---

# Business Risks

## Risk

Browser automation becomes good enough.

Mitigation

Compete on speed, cost, reliability and scalability.

---

## Risk

Major AI companies create their own standards.

Mitigation

Become protocol-agnostic.

Generate all major formats.

---

# Open Questions

1. How should capability discovery work?

2. How should agents authenticate?

3. Should execution happen directly or require human approval?

4. How can agents discover supported websites automatically?

5. What is the minimal SDK required for adoption?

6. Is analytics the best initial wedge?

7. What percentage of capability generation can realistically be automated?

---

# Current Hypothesis

The future web will have two interfaces:

Human Interface

and

Agent Interface.

The winning platform may be the one that automatically creates and maintains the Agent Interface for every application.

