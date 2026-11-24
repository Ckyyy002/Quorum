# ADR-0001: Modular monolith with layered modules

- Status: Accepted
- Date: 2026-11-24

## Context
Quorum is built by one developer in four weeks and graded on architecture and the ability to explain
the code. It has several domains (org, proker, task, document, meeting) with shared authorization rules.

## Decision
One NestJS application split into domain modules. Each module has Controller → Service → Domain → Repository
layers. Cross-module side effects go through in-process events.

## Alternatives considered
- Microservices — network, deployment and consistency overhead with no benefit at this scale.
- Plain MVC without a domain layer — business rules would leak into services/controllers and be hard to unit test.

## Consequences
- Domain logic is testable without Nest or Prisma.
- Module boundaries must be respected manually (no importing another module's repository).
- Can be split later if ever needed, because modules communicate through services and events.
